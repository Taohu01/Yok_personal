// Reads "รายงานสินค้าราคาขายปลีกและขายส่ง": a model line per product code, then one line
// per unit with its IMEI / serial and that unit's retail and wholesale price.
//
//   รุ่น / IMEI                        | รหัสสินค้า   | ประเภทสต๊อก | สาขา   | ราคาขายปลีก | ราคาขายส่ง | หมายเหตุ
//   APPLE IPAD GEN11 128GB WI-FI Silver | 195950086294 | เครื่องใหม่  | ออฟฟิศ |             |            |
//   SGC6NXWLX7V                         |              |             |        | 16900       | 16200      |

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const HEAD = {
  name: /รุ่น|imei|serial/i,
  sku: /รหัสสินค้า|barcode|sku/i,
  condition: /ประเภทสต็?๊?อก|ประเภทสต๊อก|สภาพ/,
  branch: /สาขา|branch/i,
  retail: /ราคาขายปลีก|ปลีก|retail/i,
  wholesale: /ราคาขายส่ง|ราคาส่ง|ส่ง|wholesale/i,
  note: /หมายเหตุ|note|remark/i,
};

function findHeader(grid) {
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const row = grid[i].map(clean);
    // header cells are short labels; a sentence that mentions both words is a note, not a header
    const label = (re) => row.findIndex((c) => c.length <= 30 && re.test(c));
    const imeiCol = label(/imei|serial/i);
    const skuCol = label(HEAD.sku);
    if (imeiCol < 0 || skuCol < 0 || imeiCol === skuCol) continue;
    if (row.some((c) => c === 'ยี่ห้อ')) continue; // a stock report, not an IMEI list
    const cols = {};
    row.forEach((c, j) => {
      if (!c) return;
      for (const k of ['sku', 'condition', 'branch', 'retail', 'wholesale', 'note', 'name']) {
        if (cols[k] === undefined && HEAD[k].test(c)) {
          cols[k] = j;
          break;
        }
      }
    });
    if (cols.name === undefined) cols.name = 0;
    return { at: i, cols };
  }
  return null;
}

/** True when the grid is an IMEI list rather than a stock report. */
export const isImeiGrid = (grid) => !!findHeader(grid);

const price = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** An IMEI cell may come back from Excel as a number; keep every digit. */
function imeiText(v) {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? String(v) : v.toLocaleString('fullwide', { useGrouping: false });
  return clean(v);
}

export function parseImeiGrid(grid) {
  const head = findHeader(grid);
  if (!head) throw new Error('ไม่พบหัวตาราง IMEI (ต้องมีคอลัมน์ "รุ่น / IMEI" และ "รหัสสินค้า")');
  const { cols } = head;
  const title = grid.slice(0, head.at).map((r) => r.map(clean).filter(Boolean).join(' ')).filter(Boolean);
  const units = [];
  const skipped = [];
  let group = null;
  for (let i = head.at + 1; i < grid.length; i++) {
    const r = grid[i];
    const first = clean(r[cols.name]);
    const sku = clean(r[cols.sku]);
    if (!first && !sku) continue;
    if (/^(รวม|total)/i.test(first)) continue;
    if (sku) {
      const cond = clean(r[cols.condition]);
      group = { sku, name: first, condition: /มือสอง|มือ\s*2|used|refurb/i.test(cond) ? 'used' : 'new', branch: clean(r[cols.branch]) };
      continue;
    }
    if (!group) {
      skipped.push({ line: i + 1, reason: 'IMEI อยู่ก่อนบรรทัดรุ่นสินค้า', text: first });
      continue;
    }
    units.push({
      line: i + 1,
      sku: group.sku,
      name: group.name,
      condition: group.condition,
      branch: group.branch,
      imei: imeiText(r[cols.name]),
      retail: cols.retail === undefined ? null : price(r[cols.retail]),
      wholesale: cols.wholesale === undefined ? null : price(r[cols.wholesale]),
      note: cols.note === undefined ? '' : clean(r[cols.note]),
    });
  }
  if (!units.length) throw new Error('ไม่พบเลข IMEI ในไฟล์นี้');
  return { title, units, skipped };
}
