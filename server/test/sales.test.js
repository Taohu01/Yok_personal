// สรุปยอดรายวัน: reading receipts in three layouts, day totals, slips, and the export.
// The sample receipts in ./samples are made up (see make-receipts.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const files = mkdtempSync(join(tmpdir(), 'yok-files-'));
process.env.YOK_DB = ':memory:';
process.env.YOK_FILES = files;
const { parseReceiptPdf, readReceipt } = await import('../parse/receipt.js');
const { createSale, addSlips, listDays, byProduct, oneSale } = await import('../sales.js');
const { dayCsv, dayXlsx, dayRows } = await import('../salesExport.js');

const here = dirname(fileURLToPath(import.meta.url));
const sample = (n) => readFileSync(join(here, 'samples', `${n}.pdf`));
const asUpload = (name, buffer, mimetype) => ({ originalname: Buffer.from(name, 'utf8').toString('latin1'), buffer, mimetype });

test.after(() => rmSync(files, { recursive: true, force: true }));

test('shop-system layout: header fields, IMEI, item and bill discounts', async () => {
  const r = await parseReceiptPdf(sample('receipt-system'));
  assert.equal(r.receiptNo, 'RCTEST0001');
  assert.equal(r.date, '2026-11-26');
  assert.equal(r.buyer, 'คุณทดสอบ หนึ่ง');
  assert.deepEqual(r.issues, []);
  assert.deepEqual(
    r.items.map((i) => [i.sku, i.name, i.imei, i.qty, i.price, i.discount, i.amount]),
    [
      ['SH261100501', 'APPLE IPHONE 15 128GB Black', '350000000000101', 1, 18990, 0, 18990],
      ['SH261100502', 'APPLE IPHONE 13 128GB Blue', '350000000000102', 1, 6990, 0, 6990],
      ['AC000000123', 'ADAPTER 20W USB-C', '', 2, 390, 80, 700],
    ],
  );
  assert.equal(r.net, 26180);
  assert.equal(r.billDiscount, 500);
  assert.equal(r.discount, 580, 'item discount 80 + bill discount 500');
});

test('plain Thai receipt: labels with damaged tone marks still found', async () => {
  const r = await parseReceiptPdf(sample('receipt-thai'));
  assert.equal(r.receiptNo, 'R-2569-0002');
  assert.equal(r.buyer, 'คุณทดสอบ สอง', '"ชื่อผู้ซื้อ" arrives as "ชื่อผู้ซื่อ"');
  assert.equal(r.items.length, 3);
  assert.equal(r.items[1].qty, 2);
  assert.equal(r.items[1].amount, 300);
  assert.equal(r.net, 7280);
  assert.equal(r.discount, 300);
});

test('POS slip: no item numbers, "รวมทั้งสิ้น" as the net, Christian-era date', async () => {
  const r = await parseReceiptPdf(sample('receipt-pos'));
  assert.equal(r.receiptNo, 'RC/0003');
  assert.equal(r.date, '2026-11-25');
  assert.equal(r.time, '18:20');
  assert.equal(r.buyer, 'คุณทดสอบ สาม');
  assert.deepEqual(r.items.map((i) => [i.name, i.qty, i.amount]), [['หูฟัง Bluetooth', 1, 590], ['สายชาร์จ USB-C 1m', 2, 240]]);
  assert.equal(r.net, 830);
});

test('missing pieces are reported, not guessed', () => {
  const line = (y, ...runs) => ({ y, h: 8, items: runs.map(([x, str]) => ({ x, w: str.length * 4, str })) });
  const r = readReceipt([line(700, [20, 'ใบเสร็จรับเงิน']), line(680, [20, 'ขอบคุณที่ใช้บริการ'])]);
  assert.equal(r.net, null);
  assert.ok(r.issues.includes('ไม่พบเลขที่ใบเสร็จ'));
  assert.ok(r.issues.includes('ไม่พบยอดสุทธิ'));
});

test('a day: receipts, slips, totals, export', async () => {
  const a = await parseReceiptPdf(sample('receipt-system'));
  const b = await parseReceiptPdf(sample('receipt-thai'));
  const c = await parseReceiptPdf(sample('receipt-pos'));
  const ida = createSale(a);
  const idb = createSale(b);
  createSale(c); // the day before
  assert.throws(() => createSale(a), /มีใบเสร็จ RCTEST0001 อยู่แล้ว/);

  addSlips(ida, [asUpload('สลิป 1.jpg', Buffer.from('jpg'), 'image/jpeg'), asUpload('สลิป 2.png', Buffer.from('png'), 'image/png')]);
  assert.equal(readdirSync(join(files, 'slips')).length, 2, 'slips are stored as files');
  assert.equal(oneSale(ida).slips.length, 2);
  assert.equal(oneSale(ida).slips[0].image, true);

  const days = listDays();
  assert.deepEqual(days.map((d) => d.date), ['2026-11-26', '2026-11-25'], 'newest day first');
  const day = days[0];
  assert.deepEqual(day.sales.map((s) => s.id), [ida, idb], 'within a day, in the order they were added');
  assert.equal(day.totals.bills, 2);
  assert.equal(day.totals.qty, 4 + 4);
  assert.equal(day.totals.net, 26180 + 7280);
  assert.equal(day.totals.discount, 580 + 300);
  assert.equal(day.totals.noSlip, 1);

  // sheet rows: amounts in each receipt add up to its net
  for (const blk of dayRows(day)) {
    const sum = blk.rows.reduce((t, r) => t + (r[8] || 0), 0);
    assert.equal(Math.round(sum * 100) / 100, blk.sale.net);
  }

  const csv = dayCsv(day);
  assert.ok(csv.startsWith('﻿สรุปยอดขายประจำวันที่ 26/11/2569'));
  assert.ok(csv.includes('ส่วนลดท้ายบิล'));
  assert.ok(csv.includes('ไม่มีสลิป'));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await dayXlsx(day, byProduct(day.sales)));
  const ws = wb.getWorksheet('สรุปยอดขาย');
  assert.equal(ws.getCell('H3').value, 33460, 'ยอดสุทธิรวม in the totals line');
  assert.equal(ws.getCell('C6').value, 'RCTEST0001');
  const ps = wb.getWorksheet('สรุปตามสินค้า');
  assert.equal(ps.getCell('C4').value, 'APPLE IPHONE 15 128GB Black', 'best seller by amount first');
});
