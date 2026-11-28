// ติดตามสินค้า: invoices waiting under their customer, shipments, statuses set by hand.
// Tracking numbers are made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'yok-track-'));
process.env.YOK_DB = ':memory:';
process.env.YOK_FILES = join(dir, 'files');
const { saveInvoices, ship, addParcels, setState, view, splitTrackings } = await import('../tracking.js');
const { parseInvoicePdf } = await import('../parse/invoice.js');

test.after(() => rmSync(dir, { recursive: true, force: true }));

test('tracking numbers: scanned or typed, several at once', () => {
  assert.deepEqual(splitTrackings('800000000001, 800000000002\n800000000001'), ['800000000001', '800000000002']);
  assert.throws(() => splitTrackings('123'), /ไม่ใช่เลขพัสดุ/);
});

const inv = (invNo, customerNo, customerName, imei) => ({
  invNo, invDate: '2026-11-28', invTime: '10:00:00', customerNo, customerName, salesman: 'ทดสอบ', refNo: `REF-${invNo}`, issuer: 'ร้านทดสอบ',
  items: [{ line: 1, sku: 'SKU1', description: 'TEST PHONE 128GB', qty: 1, unit: 'เครื่อง', imei }],
});

test('invoices wait under their customer; a tracking number seals them into one shipment', async () => {
  const r = saveInvoices([inv('INV-T1', 'B01', 'สาขาทดสอบ', '350000000000001'), inv('INV-T2', 'B01', 'สาขาทดสอบ', '350000000000002'), inv('INV-T3', 'B02', 'สาขาอื่น', '350000000000003')], 'a.pdf');
  assert.deepEqual(r.added, ['INV-T1', 'INV-T2', 'INV-T3']);
  assert.deepEqual(saveInvoices([inv('INV-T1', 'B01', 'สาขาทดสอบ', 'x')], 'a.pdf').duplicates, ['INV-T1']);

  let v = view();
  assert.equal(v.pending.length, 2);
  assert.equal(v.pending.find((g) => g.customer_no === 'B01').invoices.length, 2);

  const id = ship({ customer_no: 'B01', customer_name: 'สาขาทดสอบ', trackings: '800000000001 800000000009' });
  v = view();
  assert.deepEqual(v.pending.map((g) => g.customer_no), ['B02'], 'B01 has nothing waiting any more');
  const s = v.shipments.find((x) => x.id === id);
  assert.equal(s.invoices.length, 2);
  assert.deepEqual(s.parcels.map((p) => p.tracking), ['800000000001', '800000000009']);

  // a new invoice for the same customer starts a new waiting group
  saveInvoices([inv('INV-T4', 'B01', 'สาขาทดสอบ', '350000000000004')], 'b.pdf');
  assert.equal(view().pending.find((g) => g.customer_no === 'B01').invoices.length, 1);

  addParcels(id, '800000000010');
  const parcels = () => view().shipments.find((x) => x.id === id).parcels;
  assert.ok(parcels().every((p) => p.state === 'new'), 'a new number is "not looked at yet"');
  assert.equal(view().shipments.find((x) => x.id === id).state, 'moving');

  // status read off J&T's page, set by hand
  const byNo = (n) => parcels().find((p) => p.tracking === n);
  assert.equal(setState(byNo('800000000001').id, 'delivered'), 1);
  assert.equal(byNo('800000000001').state, 'delivered');
  assert.ok(byNo('800000000001').checked_at, 'when it was set is kept');
  assert.equal(view().shipments.find((x) => x.id === id).state, 'moving', 'not every box is delivered yet');
  setState([byNo('800000000009').id, byNo('800000000010').id], 'delivered');
  assert.equal(view().shipments.find((x) => x.id === id).state, 'delivered');
  setState(byNo('800000000010').id, 'returned');
  assert.equal(view().shipments.find((x) => x.id === id).state, 'problem', 'a returned box flags the send-out');
  assert.throws(() => setState(byNo('800000000010').id, 'lost'), /สถานะไม่ถูกต้อง/);
  assert.equal(setState(999999, 'delivered'), 0);
});

test('real transfer invoice PDF (on this machine only)', async (t) => {
  const pdf = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'invoice-sample.pdf');
  if (!existsSync(pdf)) return t.skip('fixtures/invoice-sample.pdf not here');
  // the expected values are real business data, so they stay next to the PDF (not in git)
  const expected = JSON.parse(readFileSync(pdf.replace(/\.pdf$/, '.expected.json'), 'utf8'));
  const [v] = await parseInvoicePdf(readFileSync(pdf));
  assert.deepEqual([v.invNo, v.invDate, v.invTime, v.customerNo, v.customerName, v.salesman, v.refNo, v.items.length], expected);
  assert.ok(v.items.every((i) => i.sku && /^\d{15}$/.test(i.imei)));
});
