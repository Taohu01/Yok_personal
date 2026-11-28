// ติดตามสินค้า API.
// Transfer invoices (PDF) wait under their customer until a tracking number is typed in next to
// the customer's name; that seals them into a shipment. No carrier API: the page opens J&T's own
// tracking page with the numbers filled in, and the status seen there is set here by hand.
import { db } from './db.js';
import { parseInvoicePdf } from './parse/invoice.js';
import { fileKind } from './parse/grid.js';

const fail = (res, status, message) => res.status(status).json({ error: message });
const utf8Name = (f) => Buffer.from(f.originalname, 'latin1').toString('utf8');

/** Statuses a parcel can be set to; 'new' = not looked at yet. */
export const STATES = ['new', 'moving', 'delivered', 'returned', 'problem'];

function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** A customer is its Customer No.; the name is used when a PDF has no number. */
export const customerKey = (no, name) => (String(no ?? '').trim() ? `no:${String(no).trim().toUpperCase()}` : `name:${String(name ?? '').trim()}`);

/** Tracking numbers as typed or scanned: several per box allowed, split on spaces/commas/new lines. */
export function splitTrackings(input) {
  const list = (Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/))
    .map((t) => String(t).toUpperCase().replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  const bad = list.find((t) => t.length < 8 || t.length > 30);
  if (bad) {
    const e = new Error(`"${bad}" ไม่ใช่เลขพัสดุ (ต้องเป็นตัวอักษรหรือตัวเลข 8–30 ตัว)`);
    e.status = 400;
    throw e;
  }
  return [...new Set(list)];
}

// ---------------------------------------------------------------- reading
function parcelOut(p) {
  return { ...p, events: JSON.parse(p.events || '[]') };
}

export function view() {
  const invoices = db.prepare('SELECT * FROM track_invoices ORDER BY inv_date, inv_time, id').all();
  const items = new Map();
  for (const i of db.prepare('SELECT * FROM track_items ORDER BY invoice_id, line').all()) {
    (items.get(i.invoice_id) || items.set(i.invoice_id, []).get(i.invoice_id)).push(i);
  }
  const withItems = invoices.map((v) => {
    const its = items.get(v.id) || [];
    return { ...v, items: its, qty: its.reduce((n, i) => n + i.qty, 0) };
  });

  const pendingMap = new Map();
  for (const v of withItems.filter((x) => !x.shipment_id)) {
    const k = customerKey(v.customer_no, v.customer_name);
    const g = pendingMap.get(k) || { key: k, customer_no: v.customer_no, customer_name: v.customer_name, invoices: [] };
    g.invoices.push(v);
    pendingMap.set(k, g);
  }
  const pending = [...pendingMap.values()].map((g) => ({ ...g, qty: g.invoices.reduce((n, v) => n + v.qty, 0) }));
  pending.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'th'));

  const parcels = new Map();
  for (const p of db.prepare('SELECT * FROM track_parcels ORDER BY id').all()) {
    (parcels.get(p.shipment_id) || parcels.set(p.shipment_id, []).get(p.shipment_id)).push(parcelOut(p));
  }
  const shipments = db
    .prepare('SELECT * FROM track_shipments ORDER BY id DESC')
    .all()
    .map((s) => {
      const ps = parcels.get(s.id) || [];
      const invs = withItems.filter((v) => v.shipment_id === s.id);
      const state = !ps.length ? 'none' : ps.every((p) => p.state === 'delivered') ? 'delivered' : ps.some((p) => p.state === 'problem' || p.state === 'returned') ? 'problem' : 'moving';
      return { ...s, parcels: ps, invoices: invs, qty: invs.reduce((n, v) => n + v.qty, 0), state };
    });
  return { pending, shipments };
}

// ---------------------------------------------------------------- writing
export function saveInvoices(invoices, filename) {
  const added = [];
  const duplicates = [];
  const insInv = db.prepare(
    'INSERT INTO track_invoices (inv_no, inv_date, inv_time, customer_no, customer_name, salesman, ref_no, issuer, filename) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  const insItem = db.prepare('INSERT INTO track_items (invoice_id, line, sku, description, qty, unit, imei) VALUES (?,?,?,?,?,?,?)');
  tx(() => {
    for (const v of invoices) {
      if (db.prepare('SELECT 1 FROM track_invoices WHERE inv_no = ?').get(v.invNo)) {
        duplicates.push(v.invNo);
        continue;
      }
      const id = Number(insInv.run(v.invNo, v.invDate, v.invTime, v.customerNo, v.customerName, v.salesman, v.refNo, v.issuer, filename).lastInsertRowid);
      for (const it of v.items) insItem.run(id, it.line, it.sku, it.description, it.qty, it.unit, it.imei);
      added.push(v.invNo);
    }
  });
  return { added, duplicates };
}

/** Seals a customer's waiting invoices (or the given ones) into a shipment with its tracking numbers. */
export function ship({ customer_no = '', customer_name = '', invoiceIds, trackings }) {
  const codes = splitTrackings(trackings);
  if (!codes.length) {
    const e = new Error('ใส่เลขพัสดุก่อน');
    e.status = 400;
    throw e;
  }
  const key = customerKey(customer_no, customer_name);
  const waiting = db
    .prepare('SELECT id, customer_no, customer_name FROM track_invoices WHERE shipment_id IS NULL')
    .all()
    .filter((v) => customerKey(v.customer_no, v.customer_name) === key && (!invoiceIds?.length || invoiceIds.map(Number).includes(v.id)));
  if (!waiting.length) {
    const e = new Error('ไม่มีใบ Inv ที่รอเลขพัสดุของสาขานี้');
    e.status = 404;
    throw e;
  }
  return tx(() => {
    const id = Number(db.prepare('INSERT INTO track_shipments (customer_no, customer_name) VALUES (?, ?)').run(waiting[0].customer_no, waiting[0].customer_name).lastInsertRowid);
    const set = db.prepare('UPDATE track_invoices SET shipment_id = ? WHERE id = ?');
    for (const v of waiting) set.run(id, v.id);
    const add = db.prepare('INSERT OR IGNORE INTO track_parcels (shipment_id, tracking) VALUES (?, ?)');
    for (const c of codes) add.run(id, c);
    return id;
  });
}

export function addParcels(shipmentId, trackings) {
  const codes = splitTrackings(trackings);
  const add = db.prepare('INSERT OR IGNORE INTO track_parcels (shipment_id, tracking) VALUES (?, ?)');
  tx(() => codes.forEach((c) => add.run(shipmentId, c)));
  return codes;
}

/** Sets the status read off J&T's page, for the given parcels. Returns how many changed. */
export function setState(ids, state) {
  if (!STATES.includes(state)) {
    const e = new Error('สถานะไม่ถูกต้อง');
    e.status = 400;
    throw e;
  }
  const list = [].concat(ids ?? []).map(Number).filter(Number.isInteger);
  if (!list.length) return 0;
  const upd = db.prepare("UPDATE track_parcels SET state = ?, error = '', checked_at = datetime('now','localtime') WHERE id = ?");
  return tx(() => list.reduce((n, id) => n + Number(upd.run(state, id).changes), 0));
}

// ---------------------------------------------------------------- routes
export function trackingRoutes(app, upload) {
  const safe = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      fail(res, e.status || (e.code ? 502 : 500), e.message || 'เกิดข้อผิดพลาด');
    }
  };

  app.get('/api/tracking', (req, res) => res.json(view()));

  app.post('/api/tracking/invoices', upload.array('files', 50), safe(async (req, res) => {
    const files = req.files || [];
    if (!files.length) return fail(res, 400, 'ไม่ได้เลือกไฟล์');
    const out = { added: [], duplicates: [], errors: [] };
    for (const f of files) {
      const name = utf8Name(f);
      if (fileKind(name) !== 'pdf') {
        out.errors.push({ filename: name, error: 'ใบ Inv ต้องเป็นไฟล์ PDF' });
        continue;
      }
      try {
        const r = saveInvoices(await parseInvoicePdf(f.buffer), name);
        out.added.push(...r.added);
        out.duplicates.push(...r.duplicates);
      } catch (e) {
        out.errors.push({ filename: name, error: e.message || 'อ่านไฟล์ไม่สำเร็จ' });
      }
    }
    const any = out.added.length || out.duplicates.length;
    res.status(any ? 201 : 422).json(any ? { ...out, view: view() } : { ...out, error: out.errors.map((e) => `${e.filename}: ${e.error}`).join(' · ') });
  }));

  app.delete('/api/tracking/invoices/:id', (req, res) => {
    const r = db.prepare('DELETE FROM track_invoices WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'ไม่พบใบ Inv นี้');
    db.prepare('DELETE FROM track_shipments WHERE id NOT IN (SELECT shipment_id FROM track_invoices WHERE shipment_id IS NOT NULL)').run();
    res.json(view());
  });

  /** Moves one invoice back to "waiting for a tracking number". */
  app.post('/api/tracking/invoices/:id/unship', (req, res) => {
    const r = db.prepare('UPDATE track_invoices SET shipment_id = NULL WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'ไม่พบใบ Inv นี้');
    db.prepare('DELETE FROM track_shipments WHERE id NOT IN (SELECT shipment_id FROM track_invoices WHERE shipment_id IS NOT NULL)').run();
    res.json(view());
  });

  app.post('/api/tracking/ship', safe(async (req, res) => {
    const id = ship(req.body || {});
    res.status(201).json({ shipmentId: id, view: view() });
  }));

  app.post('/api/tracking/shipments/:id/parcels', safe(async (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM track_shipments WHERE id = ?').get(id)) return fail(res, 404, 'ไม่พบรอบส่งนี้');
    addParcels(id, req.body?.trackings);
    res.status(201).json({ view: view() });
  }));

  app.delete('/api/tracking/parcels/:id', (req, res) => {
    const r = db.prepare('DELETE FROM track_parcels WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'ไม่พบเลขพัสดุนี้');
    res.json(view());
  });

  /** Undo a send-out: its invoices wait for a tracking number again. */
  app.post('/api/tracking/shipments/:id/unship', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM track_shipments WHERE id = ?').get(id)) return fail(res, 404, 'ไม่พบรอบส่งนี้');
    tx(() => {
      db.prepare('UPDATE track_invoices SET shipment_id = NULL WHERE shipment_id = ?').run(id);
      db.prepare('DELETE FROM track_shipments WHERE id = ?').run(id);
    });
    res.json(view());
  });

  /** Status seen on J&T's page, for one parcel. */
  app.patch('/api/tracking/parcels/:id', safe(async (req, res) => {
    if (!setState(req.params.id, req.body?.state)) return fail(res, 404, 'ไม่พบเลขพัสดุนี้');
    res.json(view());
  }));

  /** Same status for every parcel of a send-out (e.g. all delivered). */
  app.post('/api/tracking/shipments/:id/state', safe(async (req, res) => {
    const ids = db.prepare('SELECT id FROM track_parcels WHERE shipment_id = ?').all(Number(req.params.id)).map((p) => p.id);
    if (!ids.length) return fail(res, 404, 'รอบส่งนี้ยังไม่มีเลขพัสดุ');
    setState(ids, req.body?.state);
    res.json(view());
  }));
}
