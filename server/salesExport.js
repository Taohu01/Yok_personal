// Day summary export (สรุปยอดขายประจำวัน), same look as the stock export.
// Sheet 1: every receipt with its items; a bill-level discount is its own line so the
// amounts add up to the net. Sheet 2: totals per product.
import ExcelJS from 'exceljs';

const C = { cover: 'FF005A9C', page: 'FFEAEFEF', band: 'FFF4F7F7', gold: 'FFFFCC00', ink: 'FF1D1416', mute: 'FF6B6264', seam: 'FFC9D3D3', danger: 'FFA3122A' };
const FONT = 'Tahoma';
const thin = { style: 'thin', color: { argb: C.seam } };
const border = { top: thin, left: thin, bottom: thin, right: thin };
const round = (n) => Math.round(n * 100) / 100;

/** "2026-11-26" -> "26/11/2569" */
export function beDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : '';
}
export const dayTitle = (date) => `สรุปยอดขายประจำวันที่ ${beDate(date)}`;

export const HEADERS = ['ลำดับ', 'เวลา', 'เลขที่ใบเสร็จ', 'ชื่อผู้ซื้อ', 'รายการสินค้า', 'จำนวน', 'ราคา/หน่วย', 'ส่วนลด', 'จำนวนเงิน', 'ยอดสุทธิ', 'สลิป'];

const slipText = (s) => {
  if (!s.slips.length) return 'ไม่มีสลิป';
  const n = `${s.slips.length} รูป`;
  return s.slipTotal !== null ? `${n} · ${s.slipTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : n;
};

/** The rows of sheet 1, one block per receipt. */
export function dayRows(day) {
  const blocks = [];
  day.sales.forEach((s, n) => {
    const itemDisc = s.items.reduce((t, i) => t + (i.discount || 0), 0);
    const billDisc = round(s.discount - itemDisc);
    const lines = s.items.map((i) => ({ name: i.imei ? `${i.name} (${i.imei})` : i.name, qty: i.qty, price: i.price, discount: i.discount || null, amount: i.amount }));
    if (billDisc > 0.005) lines.push({ name: 'ส่วนลดท้ายบิล', qty: null, price: null, discount: billDisc, amount: -billDisc });
    if (!lines.length) lines.push({ name: '(ไม่มีรายการ)', qty: null, price: null, discount: s.discount || null, amount: s.net });
    blocks.push({
      sale: s,
      rows: lines.map((l, i) => [
        i === 0 ? n + 1 : '',
        i === 0 ? s.time : '',
        i === 0 ? s.receipt_no || '(ไม่มีเลขที่)' : '',
        i === 0 ? s.buyer : '',
        l.name,
        l.qty,
        l.price,
        l.discount,
        l.amount,
        i === 0 ? s.net : null,
        i === 0 ? slipText(s) : '',
      ]),
    });
  });
  return blocks;
}

// ---------- CSV ----------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fix = (v) => (typeof v === 'number' ? round(v).toFixed(2).replace(/\.00$/, '') : v);

export function dayCsv(day) {
  const t = day.totals;
  const out = [
    [dayTitle(day.date)],
    [],
    ['จำนวนบิล', t.bills, 'จำนวนชิ้น', t.qty, 'ส่วนลดรวม', fix(t.discount), 'ยอดสุทธิรวม', fix(t.net)],
    [],
    HEADERS,
    ...dayRows(day).flatMap((b) => b.rows.map((r) => r.map((v, i) => (i >= 6 && i <= 9 ? fix(v) : v)))),
    ['รวม', '', '', '', `${t.bills} บิล`, t.qty, '', fix(t.discount), fix(t.net), fix(t.net), t.noSlip ? `ไม่มีสลิป ${t.noSlip} บิล` : 'มีสลิปครบ'],
  ];
  return '﻿' + out.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------- XLSX ----------
function title(ws, text, span) {
  ws.mergeCells(1, 1, 1, span);
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font = { name: FONT, size: 16, bold: true, color: { argb: C.cover } };
  ws.getRow(1).height = 28;
}

function totalsLine(ws, rowNo, t) {
  const row = ws.getRow(rowNo);
  row.values = ['จำนวนบิล', t.bills, 'จำนวนชิ้น', t.qty, 'ส่วนลดรวม', t.discount, 'ยอดสุทธิรวม', t.net];
  row.eachCell((cell, col) => {
    const isNum = col % 2 === 0;
    cell.font = { name: FONT, size: isNum ? 13 : 11, bold: isNum, color: { argb: C.ink } };
    cell.alignment = { horizontal: isNum ? 'center' : 'left', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col === 8 ? C.gold : C.page } };
    cell.border = border;
    if (col === 6 || col === 8) cell.numFmt = '#,##0.00';
  });
  row.height = 22;
}

function header(row) {
  row.eachCell((cell) => {
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.cover } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });
  row.height = 22;
}

function grand(row, span) {
  for (let col = 1; col <= span; col++) {
    const cell = row.getCell(col);
    cell.font = { name: FONT, size: 12, bold: true, color: { argb: C.cover } };
    cell.border = { top: { style: 'medium', color: { argb: C.cover } }, bottom: { style: 'double', color: { argb: C.cover } } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.page } };
  }
}

function setup(ws, headerRow, landscape) {
  ws.pageSetup = {
    paperSize: 9, orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRow}:${headerRow}`,
  };
  ws.headerFooter.oddFooter = '&Lyok · สมุดงาน&Rหน้า &P / &N';
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
}

export async function dayXlsx(day, products, date = new Date()) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'yok สมุดงาน';
  wb.created = date;
  const t = day.totals;
  const span = HEADERS.length;

  const ws = wb.addWorksheet('สรุปยอดขาย', { properties: { tabColor: { argb: C.cover } } });
  ws.columns = [{ width: 7 }, { width: 8 }, { width: 17 }, { width: 20 }, { width: 44 }, { width: 8 }, { width: 13 }, { width: 11 }, { width: 14 }, { width: 15 }, { width: 16 }];
  title(ws, dayTitle(day.date), span);
  totalsLine(ws, 3, t);
  const h = ws.getRow(5);
  h.values = HEADERS;
  header(h);

  let r = 6;
  dayRows(day).forEach((b, n) => {
    const start = r;
    for (const values of b.rows) {
      const row = ws.getRow(r++);
      row.values = values;
      for (let col = 1; col <= span; col++) {
        const cell = row.getCell(col);
        cell.font = { name: FONT, size: 11, color: { argb: C.ink } };
        cell.border = border;
        cell.alignment = { vertical: 'top', horizontal: col >= 6 && col <= 10 ? 'right' : col <= 2 ? 'center' : 'left', wrapText: col === 5 };
        if (n % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.band } };
        if (col >= 7 && col <= 10) cell.numFmt = '#,##0.00';
      }
      if (values[4] === 'ส่วนลดท้ายบิล') row.getCell(5).font = { name: FONT, size: 11, italic: true, color: { argb: C.mute } };
    }
    const end = r - 1;
    if (end > start) for (const col of [1, 2, 3, 4, 10, 11]) ws.mergeCells(start, col, end, col);
    ws.getCell(start, 10).font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } };
    if (!b.sale.slips.length) ws.getCell(start, 11).font = { name: FONT, size: 11, bold: true, color: { argb: C.danger } };
  });
  const g = ws.getRow(r);
  g.values = ['รวม', '', '', '', `${t.bills} บิล`, t.qty, '', t.discount, t.net, t.net, t.noSlip ? `ไม่มีสลิป ${t.noSlip} บิล` : 'มีสลิปครบ'];
  grand(g, span);
  for (const col of [8, 9, 10]) g.getCell(col).numFmt = '#,##0.00';
  for (const col of [6, 8, 9, 10]) g.getCell(col).alignment = { horizontal: 'right' };
  ws.getCell(r + 2, 1).value = 'หมายเหตุ: จำนวนเงินของแต่ละรายการหักส่วนลดรายชิ้นแล้ว ส่วนลดท้ายบิลแสดงเป็นบรรทัดแยก ยอดในคอลัมน์จำนวนเงินจึงรวมได้เท่ากับยอดสุทธิ';
  ws.getCell(r + 2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: C.mute } };
  setup(ws, 5, true);

  const ps = wb.addWorksheet('สรุปตามสินค้า', { properties: { tabColor: { argb: C.gold } } });
  ps.columns = [{ width: 7 }, { width: 16 }, { width: 48 }, { width: 10 }, { width: 16 }];
  title(ps, dayTitle(day.date), 5);
  const ph = ps.getRow(3);
  ph.values = ['ลำดับ', 'รหัสสินค้า', 'รายการสินค้า', 'จำนวน', 'ยอดเงิน'];
  header(ph);
  r = 4;
  products.forEach((p, i) => {
    const row = ps.getRow(r++);
    row.values = [i + 1, p.sku, p.name, p.qty, p.amount];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: FONT, size: 11, color: { argb: C.ink } };
      cell.border = border;
      cell.alignment = { horizontal: col >= 4 ? 'right' : col === 1 ? 'center' : 'left' };
    });
    row.getCell(5).numFmt = '#,##0.00';
  });
  const pg = ps.getRow(r);
  pg.values = ['รวม', '', `${products.length} รายการ`, products.reduce((n, p) => n + p.qty, 0), round(products.reduce((n, p) => n + p.amount, 0))];
  grand(pg, 5);
  pg.getCell(5).numFmt = '#,##0.00';
  ps.getCell(r + 2, 1).value = 'หมายเหตุ: ยอดเงินตามรายการสินค้า ก่อนหักส่วนลดท้ายบิล';
  ps.getCell(r + 2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: C.mute } };
  setup(ps, 3, false);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
