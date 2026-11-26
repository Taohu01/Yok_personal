// Reads a sales receipt PDF: receipt number, date, buyer, items, discount and net total.
// No single layout is assumed. Labels are found by name (Thai or English), the item table
// by its header row, and amounts by the column they sit under. What cannot be read is
// left empty and listed in `issues`, so the page can ask for it.
import { pdfPages } from './grid.js';

const TONE = '[\\u0E47-\\u0E4E\\s]*';
const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A label pattern that survives PDF damage: tone marks may be missing, wrong or
 * spaced out ("ผู้ซื้อ" also matches "ผู้ซื่อ", "รวมทั้งสิ้น" also "รวมทั ่งสิ่น").
 */
function label(text) {
  const chars = [...text].filter((c) => !/[็-๎]/.test(c));
  return chars.map((c) => (c === ' ' ? '\\s*' : esc(c))).join(TONE);
}
const anyOf = (labels, flags = 'i') => new RegExp(`(?:${labels.map(label).join('|')})`, flags);

const pad = (n) => String(n).padStart(2, '0');
export function toISODate(s) {
  const m = String(s ?? '').match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return '';
  let y = Number(m[3]);
  if (y < 100) y += y > 50 ? 2500 : 2000;
  if (y > 2400) y -= 543;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const MONEY = /^-?\(?[\d,]*\d(?:\.\d+)?\)?$/;
export function money(s) {
  const t = String(s ?? '').trim();
  if (t === '-' || t === '–' || t === '') return null;
  if (!MONEY.test(t)) return null;
  const n = Number(t.replace(/[(),]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const text = (l) => l.items.map((i) => i.str).join('  ');

// ---------------------------------------------------------------- labelled fields
const L = {
  receiptNo: anyOf(['เลขที่ใบเสร็จรับเงิน', 'เลขที่ใบเสร็จ', 'ใบเสร็จเลขที่', 'Receipt No', 'Receipt #', 'เลขที่เอกสาร', 'Doc No', 'Document No', 'Invoice No', 'Inv. No', 'Bill No', 'เลขที่บิล']),
  receiptNoLoose: /(?:^|\s)(?:เลขที่|No\.?|#)\s*:?\s*/i,
  buyer: anyOf(['ชื่อผู้ซื้อ', 'นามผู้ซื้อ', 'ผู้ซื้อ', 'ชื่อลูกค้า', 'Customer Name', 'Buyer', 'Sold To', 'ลูกค้า']),
  net: anyOf(['ยอดสุทธิ', 'ยอดรวมสุทธิ', 'รวมสุทธิ', 'จำนวนเงินรวมทั้งสิ้น', 'รวมทั้งสิ้น', 'ยอดชำระ', 'Grand Total', 'Net Total', 'Net Amount', 'Total Amount']),
  sub: anyOf(['Sub Total', 'Subtotal', 'รวมเงิน', 'รวมเป็นเงิน', 'ยอดรวม']),
  discount: anyOf(['ส่วนลด', 'Discount']),
  vat: anyOf(['ภาษีมูลค่าเพิ่ม', 'VAT']),
};
const NOT_RECEIPT_NO = anyOf(['อ้างอิง', 'ใบสั่ง', 'ผู้เสียภาษี', 'ประจำตัว', 'Reference', 'Customer', 'Tax']);
const CODE = /^[A-Z0-9][A-Z0-9\-/_.]*\d[A-Z0-9\-/_.]*$/i;

/** Text after the label on that line, up to the next column gap. */
function valueAfter(lineText, m) {
  const rest = lineText.slice(m.index + m[0].length).replace(/^[\s:：.#]*/, '');
  return rest.split(/\s{2,}/)[0].trim();
}

function findReceiptNo(lines) {
  for (const l of lines) {
    const t = text(l);
    const m = t.match(L.receiptNo);
    if (!m) continue;
    const v = valueAfter(t, m).split(/\s/)[0];
    if (CODE.test(v)) return v;
  }
  for (const l of lines) {
    const t = text(l);
    const m = t.match(L.receiptNoLoose);
    if (!m) continue;
    const after = t.slice(m.index + m[0].length);
    if (NOT_RECEIPT_NO.test(after.slice(0, 20))) continue;
    const v = after.split(/\s+/)[0];
    if (CODE.test(v) && !toISODate(v)) return v;
  }
  return '';
}

function findDate(lines) {
  const all = lines.map(text).join('\n');
  const labelled = all.match(/(?:^|\s)(?:วันที่|Date)\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})(?:\s+(\d{1,2}[:.]\d{2}))?/im);
  if (labelled) return { date: toISODate(labelled[1]), time: labelled[2]?.replace('.', ':') || findTime(all) };
  const any = all.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/);
  return { date: any ? toISODate(any[1]) : '', time: findTime(all) };
}
function findTime(all) {
  const m = all.match(/(?:เวลา|Time)\s*:?\s*(\d{1,2}:\d{2})/i) || all.match(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/);
  return m ? m[1] : '';
}

function findBuyer(lines) {
  for (const l of lines) {
    const t = text(l);
    const m = t.match(L.buyer);
    if (!m) continue;
    if (/^\s*(?:No|Code|เลขที่|รหัส)/i.test(t.slice(m.index + m[0].length))) continue;
    const v = valueAfter(t, m);
    if (v && v !== '-' && v !== '—') return v;
  }
  return '';
}

/** The amount printed on a totals line: the last number on it. */
function lastNumber(l) {
  for (let i = l.items.length - 1; i >= 0; i--) {
    const parts = l.items[i].str.split(/\s+/).reverse();
    for (const p of parts) {
      const n = money(p);
      if (n !== null) return n;
    }
  }
  return null;
}

// ---------------------------------------------------------------- item table
const H = {
  no: anyOf(['Item', 'ลำดับ', 'No.', 'No', '#']),
  sku: anyOf(['Article Number', 'รหัสสินค้า', 'รหัส', 'SKU', 'Code']),
  desc: anyOf(['Article Description', 'Description', 'รายการสินค้า', 'รายการ', 'สินค้า']),
  qty: anyOf(['Qty', 'Quantity', 'จำนวน']),
  unit: anyOf(['Unit', 'หน่วย']),
  price: anyOf(['Price/Unit', 'Unit Price', 'ราคา/หน่วย', 'ราคาต่อหน่วย', 'Price', 'ราคา']),
  disc: anyOf(['Discount', 'ส่วนลด']),
  amount: anyOf(['Amount', 'จำนวนเงิน', 'รวมเงิน', 'Total', 'รวม']),
};

function headerColumns(line) {
  const cols = {};
  const used = new Set();
  // longer, more specific names first so "จำนวนเงิน" is not taken as "จำนวน"
  const order = ['amount', 'price', 'disc', 'sku', 'desc', 'qty', 'unit', 'no'];
  for (const key of order) {
    for (const r of line.items) {
      if (used.has(r)) continue;
      const s = r.str.trim();
      const m = s.match(H[key]);
      if (!m || m.index !== 0) continue;
      if (key === 'qty' && /จำนวน\s*เงิน|เงิน/.test(s)) continue;
      if (key === 'unit' && /ราคา|price/i.test(s)) continue;
      if (key === 'amount' && /ทั้งสิ้น|สุทธิ|sub/i.test(s)) continue;
      cols[key] = { x: r.x, w: r.w, mid: r.x + r.w / 2, right: r.x + r.w };
      used.add(r);
      break;
    }
  }
  return cols;
}

function isHeader(line) {
  const t = text(line);
  return (H.desc.test(t) || H.sku.test(t)) && (H.price.test(t) || H.amount.test(t)) && (H.qty.test(t) || H.amount.test(t));
}

function readItems(lines, start, end) {
  const cols = headerColumns(lines[start]);
  const body = lines.slice(start + 1, end).filter((l) => !isHeader(l));
  const numCols = ['qty', 'price', 'disc', 'amount'].filter((k) => cols[k]);
  if (!numCols.length) return [];
  const firstNum = Math.min(...numCols.map((k) => cols[k].x));
  const noRight = cols.no ? Math.min(cols.no.right + 6, (cols.sku || cols.desc)?.x ?? Infinity) : -Infinity;
  const skuRight = cols.sku && cols.desc ? cols.desc.x - 2 : -Infinity;

  const nearestNum = (r) => {
    const right = r.x + r.w;
    let best = null;
    for (const k of numCols) {
      const d = Math.min(Math.abs(right - cols[k].right), Math.abs(r.x + r.w / 2 - cols[k].mid));
      if (!best || d < best.d) best = { k, d };
    }
    return best.k;
  };

  // Rows start at an item number when the table has a number column; otherwise every
  // line that carries an amount is a row and text-only lines continue the one above.
  const anchors = cols.no
    ? body.filter((l) => l.items.some((i) => i.x + i.w <= noRight + 2 && /^\d{1,3}$/.test(i.str.trim()))).map((l) => ({ y: l.y, lines: [] }))
    : [];
  if (anchors.length) {
    for (const l of body) {
      let a = anchors[0];
      for (const c of anchors) if (Math.abs(c.y - l.y) < Math.abs(a.y - l.y)) a = c;
      if (Math.abs(a.y - l.y) <= 16) a.lines.push(l);
    }
  } else {
    let cur = null;
    for (const l of body) {
      const hasAmount = l.items.some((i) => i.x >= firstNum - 10 && money(i.str) !== null);
      if (hasAmount) anchors.push((cur = { y: l.y, lines: [l] }));
      else if (cur) cur.lines.push(l);
    }
  }

  const items = [];
  for (const a of anchors) {
    const it = { sku: '', name: [], imei: [], qty: null, price: null, discount: null, amount: null };
    for (const l of a.lines.sort((p, q) => q.y - p.y)) {
      for (const r of l.items) {
        const s = r.str.trim();
        if (!s) continue;
        if (r.x + r.w <= noRight + 2 && /^\d{1,3}$/.test(s)) continue; // the item number
        if (r.x >= firstNum - 10 && (money(s) !== null || s === '-')) {
          const k = nearestNum(r);
          const key = k === 'disc' ? 'discount' : k;
          if (it[key] === null) it[key] = money(s) ?? 0;
          continue;
        }
        if (cols.unit && Math.abs(r.x + r.w / 2 - cols.unit.mid) < 22 && r.x >= firstNum - 10) continue; // unit word
        const imei = s.match(/^(?:IMEI|S\/?N|Serial)[^:\d]*[:\s]\s*(.+)$/i);
        if (imei) it.imei.push(...imei[1].split(/[\s,]+/).filter(Boolean));
        else if (!it.sku && r.x + r.w <= skuRight + 2 && CODE.test(s)) it.sku = s;
        else it.name.push(s);
      }
    }
    const name = it.name.join(' ').trim();
    if (!name && !it.sku) continue;
    const qty = it.qty || 1;
    const discount = it.discount || 0;
    const amount = it.amount ?? (it.price !== null ? qty * it.price - discount : null);
    const price = it.price ?? (amount !== null ? (amount + discount) / qty : null);
    items.push({ line: items.length + 1, sku: it.sku, name: name || it.sku, imei: it.imei.join(', '), qty, price, discount, amount });
  }
  return items;
}

// ---------------------------------------------------------------- receipt
export function readReceipt(lines) {
  const issues = [];
  const head = lines.findIndex(isHeader);
  const isTotal = (l) => L.net.test(text(l)) || L.sub.test(text(l)) || L.vat.test(text(l)) || (L.discount.test(text(l)) && !isHeader(l));
  let end = head >= 0 ? lines.findIndex((l, i) => i > head && !isHeader(l) && isTotal(l) && lastNumber(l) !== null) : -1;
  if (end < 0) end = lines.length;
  const items = head >= 0 ? readItems(lines, head, end) : [];

  const totals = head >= 0 ? lines.slice(end) : lines;
  let net = null;
  let sub = null;
  let discount = null;
  for (const l of totals) {
    const t = text(l);
    const n = lastNumber(l);
    if (n === null) continue;
    if (L.net.test(t)) net ??= n;
    else if (L.sub.test(t)) sub ??= n;
    else if (L.discount.test(t) && !isHeader(l)) discount ??= n;
  }

  const itemsSum = items.reduce((s, i) => s + (i.amount || 0), 0);
  const itemDiscounts = items.reduce((s, i) => s + (i.discount || 0), 0);
  if (sub === null && items.length) sub = round(itemsSum);
  if (discount === null) discount = 0;
  if (net === null && sub !== null) {
    net = round(sub - discount);
    issues.push('ไม่พบยอดสุทธิในไฟล์ คำนวณจากรายการแทน');
  }

  const { date, time } = findDate(lines);
  const receipt = {
    receiptNo: findReceiptNo(lines),
    date,
    time,
    buyer: findBuyer(lines),
    items,
    subtotal: sub,
    discount: round(discount + itemDiscounts),
    billDiscount: discount,
    net,
    issues,
  };
  if (!receipt.receiptNo) issues.push('ไม่พบเลขที่ใบเสร็จ');
  if (!receipt.date) issues.push('ไม่พบวันที่');
  if (!items.length) issues.push('ไม่พบรายการสินค้า');
  if (net === null) issues.push('ไม่พบยอดสุทธิ');
  if (items.length && sub !== null && Math.abs(itemsSum - sub) > 0.5) issues.push(`ยอดรายการรวม ${itemsSum.toLocaleString('th-TH')} ไม่เท่ากับยอดรวมในใบ ${sub.toLocaleString('th-TH')}`);
  return receipt;
}

const round = (n) => Math.round(n * 100) / 100;

export async function parseReceiptPdf(buf) {
  const pages = await pdfPages(buf);
  const lines = pages.flatMap((p) => p.lines);
  if (!lines.length) {
    return { receiptNo: '', date: '', time: '', buyer: '', items: [], subtotal: null, discount: 0, billDiscount: 0, net: null, issues: ['PDF นี้ไม่มีข้อความให้อ่าน (อาจเป็นภาพสแกน) กรอกข้อมูลเองได้'] };
  }
  return readReceipt(lines);
}
