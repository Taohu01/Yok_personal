// Builds the export files in the office layout ("สต๊อกสินค้าออฟฟิศ"):
// title, a totals line (มือ 1 ทั้งหมด / มือ 2 ทั้งหมด / รวมทั้งหมด), the table, a grand total and a note.
import ExcelJS from 'exceljs';

export const CONDITION_TH = { new: 'มือ 1', used: 'มือ 2' };

export function thaiDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String((d.getFullYear() + 543) % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

export function reportTitle(date = new Date()) {
  return `สต๊อกสินค้าออฟฟิศ ${thaiDate(date)}`;
}

const NOTE = 'หมายเหตุ: รวมจำนวนตามยี่ห้อ รุ่น ความจุ ประเภท และสี จากรายงานสต๊อกต้นฉบับ ราคาที่แสดงคือราคาของเครื่องส่วนใหญ่ในกลุ่ม';

function priceNote(d) {
  const parts = [];
  const fmt = (n) => n.toLocaleString('th-TH');
  if (d.retailPrices.length > 1) parts.push(`ราคาปลีกหลายระดับ: ${d.retailPrices.map(fmt).join(' / ')}`);
  if (d.wholesalePrices.length > 1) parts.push(`ราคาส่งหลายระดับ: ${d.wholesalePrices.map(fmt).join(' / ')}`);
  return parts.join(' · ');
}

// ---------- CSV ----------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (n) => (n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function toCsv(summary, date = new Date()) {
  const { detail, totals } = summary;
  const W = 9;
  const pad = (cells) => [...cells, ...Array(Math.max(0, W - cells.length)).fill('')];
  const out = [
    pad([reportTitle(date)]),
    pad([]),
    pad(['มือ 1 ทั้งหมด', totals.newQty, 'มือ 2 ทั้งหมด', totals.usedQty, 'รวมทั้งหมด', totals.qty]),
    pad([]),
    ['ยี่ห้อ', 'รุ่นสินค้า', 'ความจุ', 'ประเภท', 'สี', 'จำนวน', 'ราคาขายปลีก', 'ราคาขายส่ง', 'หมายเหตุ'],
    ...detail.map((d) => [
      d.brand, d.model, d.capacity, CONDITION_TH[d.condition], d.color, d.qty, money(d.retail), money(d.wholesale), priceNote(d),
    ]),
    pad(['รวมทั้งหมด', '', '', '', '', totals.qty]),
    pad([]),
    pad([NOTE]),
  ];
  return '﻿' + out.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---------- XLSX ----------
const C = { cover: 'FF005A9C', deep: 'FF005A9C', page: 'FFEAEFEF', gold: 'FFFFCC00', ink: 'FF1D1416', seam: 'FFC9D3D3', usedTint: 'FFDBE8F4' };
const FONT = 'Tahoma'; // ships with Windows and Office and renders Thai cleanly
const thin = { style: 'thin', color: { argb: C.seam } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function styleTitle(ws, text, span) {
  ws.mergeCells(1, 1, 1, span);
  const c = ws.getCell(1, 1);
  c.value = text;
  c.font = { name: FONT, size: 16, bold: true, color: { argb: C.deep } };
  ws.getRow(1).height = 28;
}

function styleTotals(ws, rowNo, totals) {
  const row = ws.getRow(rowNo);
  row.values = ['มือ 1 ทั้งหมด', totals.newQty, 'มือ 2 ทั้งหมด', totals.usedQty, 'รวมทั้งหมด', totals.qty];
  row.eachCell((cell, col) => {
    const isNum = col % 2 === 0;
    cell.font = { name: FONT, size: isNum ? 13 : 11, bold: isNum, color: { argb: C.ink } };
    cell.alignment = { horizontal: isNum ? 'center' : 'left', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col === 6 ? C.gold : C.page } };
    cell.border = border;
  });
  row.height = 22;
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.cover } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });
  row.height = 22;
}

function styleBody(row, numericCols, tint) {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { name: FONT, size: 11, color: { argb: C.ink } };
    cell.border = border;
    cell.alignment = { vertical: 'middle', horizontal: numericCols.includes(col) ? 'right' : 'left' };
    if (tint) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tint } };
  });
}

function styleGrand(row, span) {
  for (let col = 1; col <= span; col++) {
    const cell = row.getCell(col);
    cell.font = { name: FONT, size: 12, bold: true, color: { argb: C.deep } };
    cell.border = { top: { style: 'medium', color: { argb: C.deep } }, bottom: { style: 'double', color: { argb: C.deep } } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.page } };
  }
}

function pageSetup(ws, headerRow, landscape) {
  ws.pageSetup = {
    paperSize: 9, orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRow}:${headerRow}`,
  };
  ws.headerFooter.oddFooter = '&Lyok · สมุดงาน&Rหน้า &P / &N';
  ws.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
}

export async function toXlsx(summary, date = new Date()) {
  const { detail, models, totals } = summary;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'yok สมุดงาน';
  wb.created = date;

  // Sheet 1: full detail, the layout the user asked for.
  const ws = wb.addWorksheet('สต๊อกสินค้า', { properties: { tabColor: { argb: C.cover } } });
  ws.columns = [
    { width: 12 }, { width: 30 }, { width: 13 }, { width: 9 }, { width: 18 },
    { width: 9 }, { width: 14 }, { width: 14 }, { width: 38 },
  ];
  styleTitle(ws, reportTitle(date), 9);
  styleTotals(ws, 3, totals);
  const h = ws.getRow(5);
  h.values = ['ยี่ห้อ', 'รุ่นสินค้า', 'ความจุ', 'ประเภท', 'สี', 'จำนวน', 'ราคาขายปลีก', 'ราคาขายส่ง', 'หมายเหตุ'];
  styleHeader(h);
  let r = 6;
  for (const d of detail) {
    const row = ws.getRow(r++);
    row.values = [d.brand, d.model, d.capacity, CONDITION_TH[d.condition], d.color, d.qty, d.retail, d.wholesale, priceNote(d)];
    styleBody(row, [6, 7, 8], d.condition === 'used' ? C.usedTint : null);
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(8).numFmt = '#,##0.00';
    row.getCell(9).font = { name: FONT, size: 10, color: { argb: 'FF6B6264' } };
  }
  const g = ws.getRow(r);
  g.values = ['รวมทั้งหมด', '', '', '', '', totals.qty];
  styleGrand(g, 9);
  g.getCell(6).alignment = { horizontal: 'right' };
  ws.getCell(r + 2, 1).value = NOTE;
  ws.getCell(r + 2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF6B6264' } };
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: r - 1, column: 9 } };
  pageSetup(ws, 5, true);

  // Sheet 2: per model, exactly like the office sheet.
  const ms = wb.addWorksheet('สรุปตามรุ่น', { properties: { tabColor: { argb: C.gold } } });
  ms.columns = [{ width: 14 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }];
  styleTitle(ms, reportTitle(date), 5);
  styleTotals(ms, 3, totals);
  const mh = ms.getRow(5);
  mh.values = ['ยี่ห้อ', 'รุ่นสินค้า', 'มือ 1 คงเหลือ', 'มือ 2 คงเหลือ', 'รวมคงเหลือ'];
  styleHeader(mh);
  r = 6;
  for (const m of models) {
    const row = ms.getRow(r++);
    row.values = [m.brand, m.model, m.newQty, m.usedQty, m.qty];
    styleBody(row, [3, 4, 5]);
  }
  const mg = ms.getRow(r);
  mg.values = ['รวมทั้งหมด', '', totals.newQty, totals.usedQty, totals.qty];
  styleGrand(mg, 5);
  ms.getCell(r + 2, 1).value = 'หมายเหตุ: รวมจำนวนตามยี่ห้อและชื่อรุ่น โดยนับจำนวนรายการ/เครื่องจากข้อมูลสต็อกต้นฉบับ';
  ms.getCell(r + 2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF6B6264' } };
  pageSetup(ms, 5, false);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
