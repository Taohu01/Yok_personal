// Reads "ใบโอนสินค้าออกระหว่างสาขา" (inter-branch transfer invoice) PDFs from the shop system.
// One PDF may hold several invoices; pages with the same Inv. No. are one invoice.
import { pdfPages } from './grid.js';
import { toISODate } from './receipt.js';

const lineText = (l) => l.items.map((i) => i.str).join('  ');

/** Text after `label` on the first line that has it, up to the next column gap. */
function after(lines, label) {
  for (const l of lines) {
    const t = lineText(l);
    const m = t.match(label);
    if (!m) continue;
    const value = t.slice(m.index + m[0].length).replace(/^\s*:?\s*/, '').split(/\s{2,}/)[0].trim();
    if (value && value !== ':' && value !== '—' && value !== '-') return value;
  }
  return '';
}

const mid = (r) => r.x + r.w / 2;

function readItems(lines) {
  const hi = lines.findIndex((l) => /Article\s*Number/i.test(lineText(l)));
  if (hi < 0) return [];
  const find = (re) => lines[hi].items.find((i) => re.test(i.str));
  const cols = { item: find(/^Item/i), article: find(/Article\s*Number/i), qty: find(/^Qty/i), unit: find(/^Unit$/i), price: find(/Price/i) };
  if (!cols.article || !cols.qty) return [];
  // the Item column ends at its header's right edge; codes may start left of "Article Number"
  const skuLeft = cols.item ? Math.min(cols.item.x + cols.item.w + 4, cols.article.x - 2) : cols.article.x - 8;
  const descLeft = cols.article.x + cols.article.w + 2;
  const descRight = cols.qty.x - 4;
  const qtyRight = cols.unit ? cols.unit.x - 2 : cols.qty.x + cols.qty.w + 20;
  const unitRight = cols.price ? cols.price.x - 2 : Infinity;

  const end = lines.findIndex((l, i) => i > hi && /ได้รับสินค้า|Sub\s*Total|Received the above|รวมเงิน/i.test(lineText(l)));
  const body = lines.slice(hi + 1, end < 0 ? undefined : end);

  // a row starts where the Item column holds a whole number
  const anchors = [];
  for (const l of body) {
    const no = l.items.find((i) => i.x < skuLeft && /^\d{1,4}$/.test(i.str.trim()));
    if (no) anchors.push({ y: l.y, line: Number(no.str), sku: '', qty: 0, unit: '', desc: [], imei: [] });
  }
  if (!anchors.length) return [];
  const top = anchors[0].y + 14; // above this is the Thai header line

  for (const l of body) {
    if (l.y > top) continue;
    let a = anchors[0];
    for (const c of anchors) if (Math.abs(c.y - l.y) < Math.abs(a.y - l.y)) a = c;
    for (const r of l.items) {
      const s = r.str.trim();
      const x = mid(r);
      if (r.x < skuLeft) continue;
      if (x < descLeft && !a.sku && /^[A-Z0-9][A-Z0-9-]{3,}$/i.test(s)) a.sku = s;
      else if (r.x >= descLeft - 4 && r.x < descRight) {
        const imei = s.match(/^(?:IMEI|S\/?N|Serial)[^:\d]*[:\s]\s*(.+)$/i);
        if (imei) a.imei.push(...imei[1].split(/[\s,]+/).filter(Boolean));
        else a.desc.push(s);
      } else if (x >= descRight && x < qtyRight && /^[\d,.]+$/.test(s)) a.qty = Number(s.replace(/,/g, ''));
      else if (x >= qtyRight && x < unitRight && !a.unit) a.unit = s;
    }
  }
  return anchors.map((a) => ({ line: a.line, sku: a.sku, description: a.desc.join(' '), qty: a.qty || 1, unit: a.unit, imei: a.imei.join(', ') }));
}

function readPage(lines) {
  const invNo = after(lines, /Inv\.?\s*No\.?/i).split(/\s/)[0];
  if (!invNo) return null;
  const all = lines.map(lineText).join('\n');
  const date = all.match(/(?:^|\s)Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/m);
  const time = all.match(/Time\s*:\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
  const title = lines.length ? lineText(lines[0]).replace(/\s{2,}/g, ' ').trim() : '';
  return {
    invNo,
    invDate: date ? toISODate(date[1]) : '',
    invTime: time ? time[1] : '',
    issuer: /Inv\.?\s*No/i.test(title) ? '' : title,
    customerNo: after(lines, /Customer\s*No\.?/i).split(/\s/)[0],
    customerName: after(lines, /Customer\s*Name/i),
    refNo: after(lines, /Reference\s*No\.?[^:]*:/i).split(/\s/)[0],
    salesman: after(lines, /Salesman\s*Code[^:]*:/i).split(/\s/)[0],
    items: readItems(lines),
  };
}

export async function parseInvoicePdf(buf) {
  const pages = await pdfPages(buf);
  const byNo = new Map();
  for (const p of pages) {
    const inv = readPage(p.lines);
    if (!inv) continue;
    const prev = byNo.get(inv.invNo);
    if (prev) prev.items.push(...inv.items);
    else byNo.set(inv.invNo, inv);
  }
  if (!byNo.size) throw new Error('ไม่พบเลขที่ใบ Inv ในไฟล์นี้ ต้องเป็น PDF ใบโอนสินค้าที่ส่งออกจากระบบ');
  return [...byNo.values()];
}
