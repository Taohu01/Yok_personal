// Reads the "รายงานสต็อกสินค้า (รวมตามรหัสสินค้า)" layout from a grid.
// Rules taken from the real report:
// - one header row with ยี่ห้อ, รุ่น, ความจุ, ประเภทสินค้า, ประเภทสต๊อก, รหัสสินค้า, สี, Supplier, จำนวน, ราคาทุน, ราคาขาย, ราคาส่ง
// - continuation rows leave ยี่ห้อ…รหัสสินค้า blank and belong to the row above
// - numbers may carry thousands separators ("7,587.50"); 0.00 means "no price"

const ALIASES = {
  brand: ['ยี่ห้อ', 'แบรนด์', 'brand'],
  model: ['รุ่น', 'รุ่นสินค้า', 'model'],
  capacity: ['ความจุ', 'capacity'],
  category: ['ประเภทสินค้า'],
  stockType: ['ประเภทสต๊อก', 'ประเภทสต็อก', 'ประเภทสตอก', 'สภาพ'],
  sku: ['รหัสสินค้า', 'barcode', 'sku'],
  color: ['สี', 'color'],
  supplier: ['supplier', 'ผู้จำหน่าย'],
  qty: ['จำนวน', 'qty'],
  cost: ['ราคาทุน', 'ทุน', 'cost'],
  retail: ['ราคาขาย', 'ราคาปลีก', 'ราคาขายปลีก', 'retail'],
  wholesale: ['ราคาส่ง', 'ราคาขายส่ง', 'wholesale'],
};
const INHERITED = ['brand', 'model', 'capacity', 'category', 'stockType', 'sku'];

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v) => clean(v).toLowerCase().replace(/\s/g, '');

export function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = clean(v).replace(/[,฿\s]/g, '');
  if (s === '' || s === '-' || s === '—') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function conditionOf(stockType) {
  const s = norm(stockType);
  if (/มือสอง|มือ2|used|second/.test(s)) return 'used';
  return 'new';
}

function findHeader(grid) {
  for (let r = 0; r < grid.length; r++) {
    const cells = grid[r].map(norm);
    if (!cells.includes('ยี่ห้อ') || !cells.some((c) => c === 'จำนวน' || c.startsWith('จำนวน'))) continue;
    const map = {};
    for (const [key, names] of Object.entries(ALIASES)) {
      const idx = cells.findIndex((c) => names.some((n) => c === norm(n)));
      if (idx >= 0) map[key] = idx;
    }
    return { row: r, map };
  }
  return null;
}

/**
 * @returns {{ title: string, branches: string, rows: object[], skipped: object[], lineCount: number }}
 */
export function parseStockGrid(grid) {
  const header = findHeader(grid);
  if (!header) {
    throw new Error('ไม่พบหัวตาราง (ต้องมีคอลัมน์ "ยี่ห้อ" และ "จำนวน") ไฟล์นี้อาจไม่ใช่รายงานสต๊อก');
  }
  const { map } = header;
  for (const need of ['model', 'qty']) {
    if (map[need] === undefined) throw new Error(`ไม่พบคอลัมน์ "${ALIASES[need][0]}" ในหัวตาราง`);
  }

  const before = grid.slice(0, header.row).map((r) => r.map(clean).filter(Boolean).join(' ')).filter(Boolean);
  const title = before.find((l) => l.includes('รายงาน')) || '';
  const branches = before.find((l) => l !== title) || '';

  const get = (row, key) => (map[key] === undefined ? '' : row[map[key]]);
  const rows = [];
  const skipped = [];
  let prev = null;
  let lineCount = 0;

  for (let r = header.row + 1; r < grid.length; r++) {
    const raw = grid[r];
    const text = raw.map(clean).filter(Boolean).join(' | ');
    if (!text) continue;
    const line = r + 1;
    const firstCell = clean(raw.find((c) => clean(c)) ?? '');
    if (/^(รวม|total|หมายเหตุ)/i.test(firstCell)) continue;
    lineCount++;

    const rec = {};
    for (const k of Object.keys(ALIASES)) rec[k] = get(raw, k);
    const isContinuation = !clean(rec.brand) && !clean(rec.model) && !clean(rec.sku);

    if (isContinuation) {
      if (!prev) {
        skipped.push({ line, reason: 'ไม่มีรุ่นสินค้าในบรรทัดก่อนหน้าให้อ้างอิง', text });
        continue;
      }
      for (const k of INHERITED) rec[k] = prev[k];
    }

    const qty = parseNumber(rec.qty);
    if (qty === null) {
      skipped.push({ line, reason: 'จำนวนไม่ใช่ตัวเลข', text });
      continue;
    }
    if (!clean(rec.model)) {
      skipped.push({ line, reason: 'ไม่มีชื่อรุ่น', text });
      continue;
    }

    const retail = parseNumber(rec.retail);
    const wholesale = parseNumber(rec.wholesale);
    const row = {
      line,
      brand: clean(rec.brand).toUpperCase() || 'ไม่ระบุยี่ห้อ',
      model: clean(rec.model),
      capacity: clean(rec.capacity),
      category: clean(rec.category),
      condition: conditionOf(rec.stockType),
      sku: clean(rec.sku),
      color: clean(rec.color) === '-' ? '' : clean(rec.color),
      supplier: clean(rec.supplier),
      qty: Math.round(qty),
      cost: parseNumber(rec.cost),
      retail: retail ? retail : null,
      wholesale: wholesale ? wholesale : null,
    };
    rows.push(row);
    prev = { ...rec, brand: rec.brand, model: rec.model };
  }

  if (!rows.length) throw new Error('พบหัวตาราง แต่ไม่มีแถวสินค้าที่อ่านได้');
  return { title, branches, rows, skipped, lineCount };
}
