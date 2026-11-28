// IMEI list ("รายงานสินค้าราคาขายปลีกและขายส่ง") joined to the stock report by product code.
// The first tests use made-up rows; the last one reads the real pair of files when they are on this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isImeiGrid, parseImeiGrid } from '../parse/imei.js';
import { excelToGrid } from '../parse/grid.js';
import { parseStockGrid } from '../parse/stock.js';
import { summarize, filterRows, attachImeis } from '../summary.js';
import { toCsv, toXlsx, imeiLines } from '../export.js';

const fx = (n) => join(dirname(fileURLToPath(import.meta.url)), 'fixtures', n);

const IMEI_GRID = [
  ['ออฟฟิศ'],
  ['รายงานสินค้าราคาขายปลีกและขายส่ง'],
  ['เครื่องที่มีในสต๊อก 2 รหัสสินค้า · ราคาส่ง: มือสองยึดตาม IMEI จากเอกสารรับ · ดูรหัสสินค้า'],
  [],
  ['รุ่น / IMEI', 'รหัสสินค้า', 'ประเภทสต๊อก', 'สาขา', 'ราคาขายปลีก', 'ราคาขายส่ง', 'หมายเหตุ'],
  ['TESTBRAND TAB 1 128GB Silver', 'TB0001', 'เครื่องใหม่', 'ออฟฟิศ', '', '', ''],
  ['SERIALAAA01', '', '', '', 9900, 9500, ''],
  ['SERIALAAA02', '', '', '', 9900, 9500, ''],
  ['TESTBRAND PHONE X 256GB Black', 'SH0001', 'มือสอง', 'ออฟฟิศ', '', '', ''],
  [350000000000777, '', '', '', 12900, 11200, 'เปลี่ยนแบต'],
];

const STOCK_GRID = [
  ['ออฟฟิศ'],
  ['รายงานสต็อกสินค้า (รวมตามรหัสสินค้า)'],
  [],
  ['ยี่ห้อ', 'รุ่น', 'ความจุ', 'ประเภทสินค้า', 'ประเภทสต๊อก', 'รหัสสินค้า', 'สี', 'Supplier', 'จำนวน', 'ราคาทุน', 'ราคาขาย', 'ราคาส่ง'],
  ['TESTBRAND', 'TAB 1', '128GB', 'แท็บเล็ต', 'เครื่องใหม่', 'TB0001', 'Silver', 'S', 2, 9000, 9900, 9500],
  ['TESTBRAND', 'PHONE X', '256GB', 'มือถือ', 'มือสอง', 'SH0001', 'Black', 'S', 1, 10000, 12900, ''],
  ['TESTBRAND', 'PHONE Y', '128GB', 'มือถือ', 'เครื่องใหม่', 'NB0001', 'Red', 'S', 1, 5000, 5900, 5500],
];

test('an IMEI list is told apart from a stock report', () => {
  assert.equal(isImeiGrid(IMEI_GRID), true);
  assert.equal(isImeiGrid(STOCK_GRID), false);
});

test('reads model lines and units; a numeric IMEI keeps every digit', () => {
  const { units } = parseImeiGrid(IMEI_GRID);
  assert.equal(units.length, 3);
  assert.deepEqual(
    units.map((u) => [u.sku, u.imei, u.condition, u.retail, u.wholesale, u.note]),
    [
      ['TB0001', 'SERIALAAA01', 'new', 9900, 9500, ''],
      ['TB0001', 'SERIALAAA02', 'new', 9900, 9500, ''],
      ['SH0001', '350000000000777', 'used', 12900, 11200, 'เปลี่ยนแบต'],
    ],
  );
  assert.equal(units[0].name, 'TESTBRAND TAB 1 128GB Silver');
});

test('joined by product code; missing codes and count differences are reported', () => {
  const { units } = parseImeiGrid(IMEI_GRID);
  const sum = summarize(parseStockGrid(STOCK_GRID).rows);
  const check = attachImeis(sum, units);
  const tab = sum.detail.find((d) => d.sku === 'TB0001');
  assert.deepEqual(tab.imeis.map((u) => u.imei), ['SERIALAAA01', 'SERIALAAA02']);
  assert.equal(check.matched, 3);
  assert.deepEqual(check.missing.map((m) => m.sku), ['NB0001'], 'stock line with no IMEI');
  assert.deepEqual(check.diff, []);
});

test('search finds the product by IMEI', () => {
  const { units } = parseImeiGrid(IMEI_GRID);
  const rows = parseStockGrid(STOCK_GRID).rows;
  const hit = filterRows(rows, { q: '000777' }, units);
  assert.deepEqual(hit.map((r) => r.sku), ['SH0001']);
});

test('exports carry an IMEI sheet / section with the per-unit wholesale price', async () => {
  const { units } = parseImeiGrid(IMEI_GRID);
  const sum = summarize(parseStockGrid(STOCK_GRID).rows);
  attachImeis(sum, units);
  const lines = imeiLines(sum);
  assert.equal(lines.length, 3);
  assert.equal(lines.find((l) => l.imei === '350000000000777').wholesale, 11200, 'used unit: its own wholesale, not "ขายส่งตามEIMI"');

  const csv = toCsv(sum);
  assert.ok(csv.includes('รายการ IMEI'));
  assert.ok(csv.includes('SERIALAAA02'));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await toXlsx(sum));
  const ws = wb.getWorksheet('รายการ IMEI');
  assert.ok(ws, 'third sheet exists');
  assert.equal(ws.getCell('B5').value, 'TESTBRAND PHONE X 256GB Black', 'same order as the stock table (brand, model)');
  assert.equal(ws.getCell('C5').value, '350000000000777');
  assert.equal(ws.getCell('G5').value, 11200);
  // no IMEI list imported: the workbook stays as before
  const plain = new ExcelJS.Workbook();
  await plain.xlsx.load(await toXlsx(summarize(parseStockGrid(STOCK_GRID).rows)));
  assert.equal(plain.getWorksheet('รายการ IMEI'), undefined);
});

test('real pair: by-barcode stock report + retail/wholesale IMEI list', (t) => {
  if (!existsSync(fx('imei-price-list.xlsx')) || !existsSync(fx('stock-by-barcode-9.xlsx'))) return t.skip('real files not on this machine');
  const { units } = parseImeiGrid(excelToGrid(readFileSync(fx('imei-price-list.xlsx'))));
  const stock = parseStockGrid(excelToGrid(readFileSync(fx('stock-by-barcode-9.xlsx'))));
  const sum = summarize(stock.rows);
  const check = attachImeis(sum, units);
  assert.equal(units.length, 184);
  assert.equal(sum.totals.qty, 184);
  assert.equal(check.matched, 184, 'every unit lands on a stock line');
  assert.deepEqual([check.missing, check.diff, check.extra], [[], [], []]);
  const ipad = sum.detail.find((d) => d.sku === '195950086294');
  assert.equal(ipad.qty, 5);
  assert.deepEqual(ipad.imeis.map((u) => u.imei), ['SGC6NXWLX7V', 'SHJQF6KW6KM', 'SK1VWGP4XG3', 'SLXQN2L9G9D', 'SM2N6RDXTQ9']);
});
