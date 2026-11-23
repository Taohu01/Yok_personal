import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { csvToGrid, decodeText } from '../parse/grid.js';
import { parseStockGrid, parseNumber } from '../parse/stock.js';
import { summarize, filterRows } from '../summary.js';
import { toCsv, toXlsx } from '../export.js';

// The fixtures are extracts of a real stock report, so they stay out of git.
// Put a report at server/test/fixtures/sample-report.csv (+ .xlsx/.pdf) to run these tests.
const fixture = new URL('./fixtures/sample-report.csv', import.meta.url);
if (!existsSync(fixture)) {
  test('stock fixtures not present on this machine', { skip: true }, () => {});
  process.exit(0);
}
const buf = readFileSync(fixture);
const parsed = parseStockGrid(csvToGrid(buf));
const sum = summarize(parsed.rows);
const all = [...sum.detail, ...sum.accessories];
const find = (model, color, condition) =>
  all.find((d) => d.model === model && d.color === color && (!condition || d.condition === condition));
const bySku = (sku, color) => all.find((d) => d.sku === sku && (color === undefined || d.color === color));

test('reads header meta and every data line', () => {
  assert.equal(parsed.title, 'รายงานสต็อกสินค้า (รวมตามรหัสสินค้า)');
  assert.match(parsed.branches, /บ้านท่อ/);
  assert.equal(parsed.lineCount, 28);
  assert.equal(parsed.rows.length, 28);
  assert.deepEqual(parsed.skipped, []);
});

test('totals reconcile with the source', () => {
  const sourceQty = parsed.rows.reduce((s, r) => s + r.qty, 0);
  assert.equal(sourceQty, 146);
  assert.equal(sum.totals.newQty, 138);
  assert.equal(sum.totals.usedQty, 8);
  assert.equal(sum.totals.qty, sourceQty);
});

test('continuation rows inherit model, capacity and condition', () => {
  const adapter = find('ADAPTER USB-C', 'White');
  assert.equal(adapter.qty, 85);
  assert.equal(adapter.condition, 'new');
  assert.equal(adapter.retail, 790);
  assert.equal(adapter.wholesale, 600);
});

test('grouping follows the product code, not the name', () => {
  // two codes with the same name stay separate
  assert.equal(bySku('SH260700013', 'Black Titanium').qty, 4);
  assert.equal(bySku('SH261000066', 'Black Titanium').qty, 1);
  assert.equal(bySku('194253687962').qty, 1);
  assert.equal(bySku('194253687962').retail, 3999);
  assert.equal(bySku('195949133671').qty, 5);
  // one code with two colours gives two lines
  assert.equal(bySku('195950823851', '').qty, 1);
  assert.equal(bySku('195950823851', 'Blue').qty, 1);
});

test('chargers and adapters go to their own table', () => {
  assert.deepEqual(sum.accessories.map((d) => d.model), ['ADAPTER USB-C']);
  assert.ok(!sum.detail.some((d) => d.model === 'ADAPTER USB-C'));
  assert.equal(sum.totals.accessoryQty, 85);
  assert.equal(sum.totals.deviceQty, 61);
  assert.equal(sum.totals.deviceQty + sum.totals.accessoryQty, sum.totals.qty);
});

test('colour case variants merge; "-" colour becomes blank', () => {
  assert.equal(find('IPAD GEN 11 WI-FI', 'Pink').qty, 4);
  assert.equal(find('IPAD AIR', '').qty, 1);
  assert.equal(find('IPHONE 17', 'White', 'used').qty, 1);
});

test('price is the one most units carry; others are listed', () => {
  const pm = bySku('SH260700013', 'Black Titanium');
  assert.deepEqual(pm.retailPrices, [25900, 27900]);
  assert.equal(pm.retail, 27900); // 2 units each: the tie goes to the higher price
  assert.equal(pm.wholesale, null);
  assert.equal(bySku('195949133671').retail, 2990);
});

test('zero retail means no price', () => {
  assert.equal(find('APPLE IPAD 10 WI-FI + CELLULAR', 'Yellow').retail, null);
});

test('per-model summary like the office sheet', () => {
  const m = sum.models.find((x) => x.model === 'IPHONE 17');
  assert.deepEqual([m.newQty, m.usedQty, m.qty], [2, 1, 3]);
});

test('filters', () => {
  assert.equal(summarize(filterRows(parsed.rows, { condition: 'used' })).totals.qty, 8);
  assert.equal(summarize(filterRows(parsed.rows, { brand: 'OPPO' })).totals.qty, 33);
  assert.equal(summarize(filterRows(parsed.rows, { q: 'a6c' })).totals.qty, 30);
});

test('numbers', () => {
  assert.equal(parseNumber('"7,587.50"'.replace(/"/g, '')), 7587.5);
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(12), 12);
});

test('windows-874 csv decodes', () => {
  const tis = Buffer.from([0xc2, 0xd5, 0xe8, 0xcb, 0xe9, 0xcd]); // "ยี่ห้อ" in TIS-620
  assert.equal(decodeText(tis), 'ยี่ห้อ');
});

test('csv export keeps the office layout', () => {
  const csv = toCsv(sum, new Date(2026, 10, 21));
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.match(lines[0], /^สต๊อกสินค้าออฟฟิศ 21\/11\/69/);
  assert.match(lines[2], /^มือ 1 ทั้งหมด,138,มือ 2 ทั้งหมด,8,รวมทั้งหมด,146/);
  assert.match(lines[4], /^ยี่ห้อ,รหัสสินค้า,รุ่นสินค้า,ความจุ,ประเภท,สี,จำนวน,ราคาขายปลีก,ราคาขายส่ง/);
  assert.ok(!csv.includes('ราคาทุน'), 'export must not carry cost');
  assert.ok(!csv.includes('476.15'), 'cost values must not leak');
  const pmLine = lines.find((l) => l.includes('SH260700013'));
  assert.match(pmLine, /ขายส่งตามEIMI/);
  const acc = lines.indexOf('สายชาร์จ / อะแดปเตอร์,,,,,,,,,');
  assert.ok(acc > lines.findIndex((l) => l.startsWith('รวมเครื่อง,')), 'accessory table comes after the devices');
  assert.match(lines[acc + 2], /^APPLE,195949942310,ADAPTER USB-C/);
});

test('xlsx export has both sheets and the right totals', async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await toXlsx(sum, new Date(2026, 10, 21)));
  const [detail, models] = wb.worksheets;
  assert.equal(detail.name, 'สต๊อกสินค้า');
  assert.equal(models.name, 'สรุปตามรุ่น');
  assert.equal(detail.getCell('F3').value, 146);
  assert.equal(detail.getCell('A5').value, 'ยี่ห้อ');
  assert.equal(detail.getCell('B5').value, 'รหัสสินค้า');
  const values = [];
  detail.eachRow((row) => row.eachCell((c) => values.push(c.value)));
  assert.ok(values.includes('สายชาร์จ / อะแดปเตอร์'));
  assert.ok(values.includes('ขายส่งตามEIMI'));
  assert.ok(!values.includes('ราคาทุน') && !values.includes(476.15));
  const lastModel = models.getRow(5 + sum.models.length + 1);
  assert.equal(lastModel.getCell(5).value, 146);
});

test('xlsx and pdf imports give the same totals as csv', async () => {
  const { fileToGrid, fixThai } = await import('../parse/grid.js');
  for (const name of ['sample-report.xlsx', 'sample-report.pdf']) {
    const b = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
    const { grid } = await fileToGrid(name, b);
    const p = parseStockGrid(grid);
    const t = summarize(p.rows).totals;
    assert.deepEqual([p.rows.length, t.newQty, t.usedQty, t.qty], [28, 138, 8, 146], name);
  }
  assert.equal(fixThai('จํานวน'), 'จำนวน');
  assert.equal(fixThai('ยี\u0000ห้อ'), 'ยี่ห้อ');
});

const office = new URL('./fixtures/office-by-barcode.csv', import.meta.url);
test('office report by barcode', { skip: !existsSync(office) }, () => {
  const p = parseStockGrid(csvToGrid(readFileSync(office)));
  const t = summarize(p.rows).totals;
  assert.equal(p.branches, 'ออฟฟิศ');
  assert.deepEqual([p.rows.length, p.skipped.length], [99, 0]);
  assert.deepEqual([t.newQty, t.usedQty, t.qty], [174, 68, 242]);
  assert.deepEqual([t.deviceQty, t.accessoryQty], [147, 95]);
});
