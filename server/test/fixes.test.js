// Regression tests for bugs found in the 28 Nov bug hunt. Made-up data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const files = mkdtempSync(join(tmpdir(), 'yok-fixes-'));
process.env.YOK_DB = ':memory:';
process.env.YOK_FILES = files;
const { isDate, amount } = await import('../util.js');
const { summarize, filterRows, attachImeis, colorsBySku } = await import('../summary.js');
const { reportTitle, importDate, branchLabel } = await import('../export.js');
const { conditionOf } = await import('../parse/stock.js');
const { createSale, oneSale, listDays } = await import('../sales.js');
const { toISODate, readReceipt } = await import('../parse/receipt.js');
const { db } = await import('../db.js');

test.after(() => rmSync(files, { recursive: true, force: true }));

test('dates must exist on the calendar', () => {
  assert.equal(isDate('2026-11-28'), true);
  assert.equal(isDate('2028-02-29'), true, 'leap day');
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('2026-13-45'), false);
  assert.equal(isDate('28/11/2026'), false);
});

test('amounts typed with thousands separators keep their value', () => {
  assert.equal(amount('26,180'), 26180);
  assert.equal(amount('฿1,000.50'), 1000.5);
  assert.equal(amount(' 300 '), 300);
  assert.equal(amount('1,000 บาท'), 1000);
  assert.equal(amount(''), null);
  assert.equal(amount(null), null);
  assert.throws(() => amount('abc', 'ยอดสุทธิ'), /ยอดสุทธิ "abc" ไม่ใช่ตัวเลข/);
});

test('a bill typed with commas is saved with its numbers, not emptied', () => {
  const id = createSale({ receipt_no: 'FIX-1', sale_date: '2026-11-28', discount: '1,000', net: '26,180', items: [{ name: 'เครื่อง', qty: '1', price: '27,180', discount: '0' }] });
  const s = oneSale(id);
  assert.equal(s.net, 26180);
  assert.equal(s.discount, 1000);
  assert.equal(s.items[0].price, 27180);
  assert.equal(s.items[0].amount, 27180);
  assert.throws(() => createSale({ receipt_no: 'FIX-2', net: 'ไม่รู้', items: [] }), /ยอดสุทธิ/);
  assert.throws(() => createSale({ receipt_no: 'FIX-3', net: 1, items: [{ name: 'x', price: 'สิบ' }] }), /ราคา รายการที่ 1/);
});

// one code in three colours, one unit each; "Glacier Blue" also ends with "Blue"
const row = (color, line) => ({ line, brand: 'T', model: 'M', capacity: '128GB', category: 'มือถือ', condition: 'new', sku: 'C1', color, supplier: '', qty: 1, cost: 1, retail: 10, wholesale: 9 });
const ROWS = [row('Black', 1), row('Blue', 2), row('Glacier Blue', 3)];
const IMEIS = [
  { sku: 'C1', name: 'T M 128GB Black', imei: '111' },
  { sku: 'C1', name: 'T M 128GB Blue', imei: '222' },
  { sku: 'C1', name: 'T M 128GB Glacier Blue', imei: '333' },
];
const show = (s) => Object.fromEntries(s.detail.map((d) => [d.color, d.imeis.map((u) => u.imei).join(',')]));

test('each colour gets only its own units, "Blue" is not "Glacier Blue"', () => {
  const s = summarize(ROWS);
  attachImeis(s, IMEIS);
  assert.deepEqual(show(s), { Black: '111', Blue: '222', 'Glacier Blue': '333' });
});

test('a filter that hides a colour does not move its units onto another colour', () => {
  const s = summarize(filterRows(ROWS, { q: 'blue' }, IMEIS));
  attachImeis(s, IMEIS, colorsBySku(ROWS));
  assert.deepEqual(show(s), { Blue: '222', 'Glacier Blue': '333' });
});

test('an IMEI search keeps only the colour line holding that unit', () => {
  const s = summarize(filterRows(ROWS, { q: '222' }, IMEIS));
  assert.deepEqual(s.detail.map((d) => d.color), ['Blue']);
});

test('export title: the branch of the report and the day it was imported', () => {
  assert.equal(branchLabel('ออฟฟิศ'), 'ออฟฟิศ');
  assert.equal(branchLabel(''), 'ออฟฟิศ');
  assert.equal(branchLabel('ลีโมบาย สาขาบ้านท่อ · ขนส่งอุดร · บ้านดู่'), 'รวมหลายสาขา');
  assert.equal(reportTitle(importDate('2026-11-20 09:15:00'), 'ออฟฟิศ'), 'สต๊อกสินค้าออฟฟิศ 20/11/69');
});

test('receipt dates with the month spelled out land on the right day', () => {
  assert.equal(toISODate('วันที่ 26 พ.ย. 2569'), '2026-11-26');
  assert.equal(toISODate('26 พฤศจิกายน 2569'), '2026-11-26');
  assert.equal(toISODate('3 มี.ค. 69'), '2026-03-03');
  assert.equal(toISODate('Date: 26 Nov 2026'), '2026-11-26');
  assert.equal(toISODate('Nov 26, 2026'), '2026-11-26');
  assert.equal(toISODate('Tel 0812345678'), '', 'a phone number is not a date');
});

test('a discount printed as -100.00 or (100.00) is a discount of 100', () => {
  const L = (y, ...r) => ({ y, h: 9, items: r.map(([x, s]) => ({ x, w: s.length * 4.2, str: s })) });
  for (const printed of ['-100.00', '(100.00)']) {
    const r = readReceipt([
      L(800, [30, 'เลขที่ใบเสร็จ: R-9']),
      L(790, [30, 'วันที่ 26 พ.ย. 2569']),
      L(760, [30, 'รายการ'], [200, 'จำนวน'], [260, 'ราคา'], [330, 'จำนวนเงิน']),
      L(740, [30, 'เคส'], [210, '1'], [260, '1,000.00'], [330, '1,000.00']),
      L(720, [30, 'ยอดรวม'], [330, '1,000.00']),
      L(710, [30, 'ส่วนลด'], [330, printed]),
      L(700, [30, 'ยอดสุทธิ'], [330, '900.00']),
    ]);
    assert.equal(r.discount, 100, printed);
    assert.equal(r.date, '2026-11-26');
    assert.deepEqual(r.issues, []);
  }
});

test('a year of bills still loads (more than SQLite\'s 32766 bound values)', () => {
  const ins = db.prepare('INSERT INTO sales (sale_date, net) VALUES (?, ?)');
  db.exec('BEGIN');
  for (let i = 0; i < 33000; i++) ins.run('2025-01-15', 1);
  db.exec('COMMIT');
  const [day] = listDays({ from: '2025-01-15', to: '2025-01-15' });
  assert.equal(day.sales.length, 33000);
  assert.ok(listDays().length >= 1);
});

test('refurbished stock counts as มือ 2 in the stock report too', () => {
  assert.equal(conditionOf('Refurbished'), 'used');
  assert.equal(conditionOf('มือสอง'), 'used');
  assert.equal(conditionOf('เครื่องใหม่'), 'new');
});
