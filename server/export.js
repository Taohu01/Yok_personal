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

/** The branch line above the report's header: one name, or several joined by " · ". */
export function branchLabel(branches) {
  const b = String(branches ?? '').trim();
  if (!b) return 'ออฟฟิศ';
  if (b.includes('·') || b.includes(',') || b.length > 30) return 'รวมหลายสาขา';
  return b;
}

/** "สต๊อกสินค้าออฟฟิศ 28/11/69": the branch of the report and the day its data was taken. */
export function reportTitle(date = new Date(), branches = '') {
  return `สต๊อกสินค้า${branchLabel(branches)} ${thaiDate(date)}`;
}

/** SQLite "2026-11-28 22:46:42" -> that day as a local Date. */
export function importDate(createdAt) {
  const m = String(createdAt ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
}

const NOTE = 'หมายเหตุ: รวมจำนวนตามรหัสสินค้าและสี จากรายงานสต๊อกต้นฉบับ ราคาที่แสดงคือราคาของเครื่องส่วนใหญ่ในกลุ่ม';

/** Shown instead of a wholesale price when the source has none. */
export const NO_WHOLESALE = 'ขายส่งตามEIMI';
export const ACCESSORY_TITLE = 'สายชาร์จ / อะแดปเตอร์';

const HEADERS = ['ยี่ห้อ', 'รหัสสินค้า', 'รุ่นสินค้า', 'ความจุ', 'ประเภท', 'สี', 'จำนวน', 'ราคาขายปลีก', 'ราคาขายส่ง', 'หมายเหตุ'];
const QTY_COL = 7;

function priceNote(d) {
  const parts = [];
  const fmt = (n) => n.toLocaleString('th-TH');
  if (d.retailPrices.length > 1) parts.push(`ราคาปลีกหลายระดับ: ${d.retailPrices.map(fmt).join(' / ')}`);
  if (d.wholesalePrices.length > 1) parts.push(`ราคาส่งหลายระดับ: ${d.wholesalePrices.map(fmt).join(' / ')}`);
  return parts.join(' · ');
}

// ---------- IMEI list (one line per unit) ----------
export const IMEI_TITLE = 'รายการ IMEI';
export const IMEI_HEADERS = ['ลำดับ', 'รุ่นสินค้า', 'IMEI / Serial', 'รหัสสินค้า', 'ประเภท', 'ราคาขายปลีก', 'ราคาขายส่ง', 'หมายเหตุ'];

/** Units in the order of the stock table (devices, then chargers/adapters). */
export function imeiLines(summary) {
  const out = [];
  for (const d of [...summary.detail, ...summary.accessories]) {
    for (const u of d.imeis || []) {
      out.push({
        d,
        name: u.name || [d.brand, d.model, d.capacity, d.color].filter(Boolean).join(' '),
        imei: u.imei,
        retail: u.retail ?? d.retail,
        wholesale: u.wholesale ?? (d.condition === 'new' ? d.wholesale : null),
        note: u.note,
      });
    }
  }
  return out;
}

// ---------- CSV ----------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (n) => (n == null ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function toCsv(summary, date = new Date(), branches = '') {
  const { detail, accessories, totals } = summary;
  const W = HEADERS.length;
  const pad = (cells) => [...cells, ...Array(Math.max(0, W - cells.length)).fill('')];
  const line = (d) => [
    d.brand, d.sku, d.model, d.capacity, CONDITION_TH[d.condition], d.color, d.qty,
    money(d.retail), d.wholesale == null ? NO_WHOLESALE : money(d.wholesale), priceNote(d),
  ];
  const total = (label, qty) => pad([label, '', '', '', '', '', qty]);
  const out = [
    pad([reportTitle(date, branches)]),
    pad([]),
    pad(['มือ 1 ทั้งหมด', totals.newQty, 'มือ 2 ทั้งหมด', totals.usedQty, 'รวมทั้งหมด', totals.qty]),
  ];
  // a filter can leave only chargers/adapters: then there is no (empty) device table
  if (detail.length || !accessories.length) out.push(pad([]), HEADERS, ...detail.map(line), total('รวมเครื่อง', totals.deviceQty));
  if (accessories.length) {
    out.push(pad([]), pad([ACCESSORY_TITLE]), HEADERS, ...accessories.map(line), total('รวมสายชาร์จ/อะแดปเตอร์', totals.accessoryQty));
  }
  out.push(pad([]), pad([NOTE]));
  const units = imeiLines(summary);
  if (units.length) {
    out.push(pad([]), pad([IMEI_TITLE]), pad(IMEI_HEADERS));
    units.forEach((u, i) =>
      out.push(pad([i + 1, u.name, u.imei, u.d.sku, CONDITION_TH[u.d.condition], money(u.retail), u.wholesale == null ? NO_WHOLESALE : money(u.wholesale), u.note])),
    );
    out.push(pad(['รวม', `${units.length} เครื่อง`]));
  }
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

export async function toXlsx(summary, date = new Date(), branches = '') {
  const { detail, accessories, models, totals } = summary;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'yok สมุดงาน';
  wb.created = date;

  // Sheet 1: full detail, the layout the user asked for; accessories in their own table after the devices.
  const ws = wb.addWorksheet('สต๊อกสินค้า', { properties: { tabColor: { argb: C.cover } } });
  const span = HEADERS.length;
  ws.columns = [
    { width: 12 }, { width: 16 }, { width: 30 }, { width: 13 }, { width: 9 }, { width: 18 },
    { width: 9 }, { width: 14 }, { width: 16 }, { width: 36 },
  ];
  styleTitle(ws, reportTitle(date, branches), span);
  styleTotals(ws, 3, totals);

  const writeTable = (startRow, items, totalLabel, totalQty) => {
    const h = ws.getRow(startRow);
    h.values = HEADERS;
    styleHeader(h);
    let r = startRow + 1;
    for (const d of items) {
      const row = ws.getRow(r++);
      row.values = [
        d.brand, d.sku, d.model, d.capacity, CONDITION_TH[d.condition], d.color, d.qty,
        d.retail, d.wholesale == null ? NO_WHOLESALE : d.wholesale, priceNote(d),
      ];
      styleBody(row, [7, 8, 9], d.condition === 'used' ? C.usedTint : null);
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).font = { name: FONT, size: 10, color: { argb: 'FF6B6264' } };
    }
    const g = ws.getRow(r);
    g.values = [totalLabel, '', '', '', '', '', totalQty];
    styleGrand(g, span);
    g.getCell(QTY_COL).alignment = { horizontal: 'right' };
    return r;
  };

  let r;
  const onlyAccessories = !detail.length && accessories.length > 0; // a filter left no devices
  if (!onlyAccessories) {
    r = writeTable(5, detail, 'รวมเครื่อง', totals.deviceQty);
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: r - 1, column: span } };
  }
  if (accessories.length) {
    const start = onlyAccessories ? 4 : r + 2;
    const t = ws.getCell(start, 1);
    t.value = ACCESSORY_TITLE;
    t.font = { name: FONT, size: 13, bold: true, color: { argb: C.deep } };
    r = writeTable(start + 1, accessories, 'รวมสายชาร์จ/อะแดปเตอร์', totals.accessoryQty);
    if (onlyAccessories) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: r - 1, column: span } };
  }
  ws.getCell(r + 2, 1).value = NOTE;
  ws.getCell(r + 2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF6B6264' } };
  pageSetup(ws, 5, true);

  // Sheet 2: per model, exactly like the office sheet.
  const ms = wb.addWorksheet('สรุปตามรุ่น', { properties: { tabColor: { argb: C.gold } } });
  ms.columns = [{ width: 14 }, { width: 32 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 10 }];
  styleTitle(ms, reportTitle(date, branches), 5);
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

  // Sheet 3: every unit with its IMEI / serial, when an IMEI list was imported.
  const units = imeiLines(summary);
  if (units.length) {
    const is = wb.addWorksheet(IMEI_TITLE, { properties: { tabColor: { argb: C.cover } } });
    is.columns = [{ width: 7 }, { width: 44 }, { width: 24 }, { width: 16 }, { width: 9 }, { width: 14 }, { width: 16 }, { width: 34 }];
    styleTitle(is, `${reportTitle(date, branches)} · ${IMEI_TITLE}`, IMEI_HEADERS.length);
    is.getCell(2, 1).value = `${units.length} เครื่อง · ราคาส่งของมือ 2 เป็นราคาตาม IMEI ของเครื่องนั้น`;
    is.getCell(2, 1).font = { name: FONT, size: 10, italic: true, color: { argb: 'FF6B6264' } };
    const ih = is.getRow(4);
    ih.values = IMEI_HEADERS;
    styleHeader(ih);
    r = 5;
    units.forEach((u, i) => {
      const row = is.getRow(r++);
      row.values = [i + 1, u.name, u.imei, u.d.sku, CONDITION_TH[u.d.condition], u.retail, u.wholesale == null ? NO_WHOLESALE : u.wholesale, u.note];
      styleBody(row, [1, 6, 7], u.d.condition === 'used' ? C.usedTint : null);
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      for (const c of [3, 4]) row.getCell(c).numFmt = '@';
      for (const c of [6, 7]) row.getCell(c).numFmt = '#,##0.00';
      row.getCell(8).font = { name: FONT, size: 10, color: { argb: 'FF6B6264' } };
    });
    const ig = is.getRow(r);
    ig.values = ['รวม', `${units.length} เครื่อง`];
    styleGrand(ig, IMEI_HEADERS.length);
    is.autoFilter = { from: { row: 4, column: 1 }, to: { row: r - 1, column: IMEI_HEADERS.length } };
    pageSetup(is, 4, true);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
