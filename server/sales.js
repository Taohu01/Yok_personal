// สรุปยอดรายวัน API: receipts (PDF, read automatically, editable), transfer slips, day summaries and exports.
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { db, filesDir } from './db.js';
import { parseReceiptPdf } from './parse/receipt.js';
import { dayCsv, dayXlsx, dayTitle } from './salesExport.js';
import { amount, isDate } from './util.js';

const fail = (res, status, message) => res.status(status).json({ error: message });
const utf8Name = (f) => Buffer.from(f.originalname, 'latin1').toString('utf8');
const isISO = isDate;
const round = (n) => Math.round(n * 100) / 100;

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SLIP_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|pdf)$/i;
const isPdf = (f) => /\.pdf$/i.test(utf8Name(f)) || f.mimetype === 'application/pdf';
const isImage = (f) => (f.mimetype || '').startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(utf8Name(f));

// ---------------------------------------------------------------- files
function saveFile(kind, buf, originalName) {
  const dir = join(filesDir, kind);
  mkdirSync(dir, { recursive: true });
  const ext = (extname(originalName) || '.bin').toLowerCase().replace(/[^.a-z0-9]/g, '');
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  writeFileSync(join(dir, name), buf);
  return `${kind}/${name}`;
}
/** A stored upload, or a clear 404 when it has been removed from disk. */
function sendStored(res, rel, type, asciiName, name) {
  const full = resolve(filesDir, rel);
  if (!full.startsWith(resolve(filesDir)) || !existsSync(full)) {
    return res.status(404).json({ error: 'ไม่พบไฟล์นี้ในเครื่องแล้ว (อาจถูกลบหรือย้ายออกจากโฟลเดอร์ data/files)' });
  }
  res.setHeader('Content-Disposition', `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.type(type).sendFile(full);
}

function removeFile(rel) {
  if (!rel) return;
  const full = resolve(filesDir, rel);
  if (full.startsWith(resolve(filesDir)) && existsSync(full)) rmSync(full, { force: true });
}

// ---------------------------------------------------------------- reading
function slipOut(s) {
  return { id: s.id, file_name: s.file_name, mime: s.mime, amount: s.amount, url: `/api/slips/${s.id}/file`, image: s.mime.startsWith('image/') && !/hei[cf]/.test(s.mime) };
}

function saleOut(s, items, slips) {
  const its = items.get(s.id) || [];
  const sl = slips.get(s.id) || [];
  const qty = its.reduce((n, i) => n + i.qty, 0);
  const slipTotal = sl.some((x) => x.amount !== null) ? round(sl.reduce((n, x) => n + (x.amount || 0), 0)) : null;
  return {
    ...s,
    issues: JSON.parse(s.issues || '[]'),
    items: its,
    slips: sl.map(slipOut),
    qty,
    gross: s.net === null ? null : round(s.net + s.discount),
    slipTotal,
    time: s.sale_time || s.created_at.slice(11, 16),
    pdf_url: s.file_path ? `/api/sales/${s.id}/file` : '',
  };
}

function load(where = '', ...args) {
  const sales = db.prepare(`SELECT * FROM sales ${where} ORDER BY sale_date DESC, created_at ASC, id ASC`).all(...args);
  if (!sales.length) return [];
  // Same filter as a sub-query, not a list of ids: SQLite allows at most 32766 bound values,
  // and a year of bills passes that.
  const picked = `SELECT id FROM sales ${where}`;
  const items = new Map();
  for (const i of db.prepare(`SELECT * FROM sale_items WHERE sale_id IN (${picked}) ORDER BY sale_id, line`).all(...args)) {
    (items.get(i.sale_id) || items.set(i.sale_id, []).get(i.sale_id)).push(i);
  }
  const slips = new Map();
  for (const s of db.prepare(`SELECT * FROM sale_slips WHERE sale_id IN (${picked}) ORDER BY id`).all(...args)) {
    (slips.get(s.sale_id) || slips.set(s.sale_id, []).get(s.sale_id)).push(s);
  }
  return sales.map((s) => saleOut(s, items, slips));
}
export const oneSale = (id) => load('WHERE id = ?', id)[0] || null;

export function dayTotals(sales) {
  const t = { bills: sales.length, qty: 0, gross: 0, discount: 0, net: 0, noSlip: 0, slipTotal: 0, issues: 0 };
  for (const s of sales) {
    t.qty += s.qty;
    t.discount += s.discount;
    t.net += s.net || 0;
    t.gross += s.gross || 0;
    t.slipTotal += s.slipTotal || 0;
    if (!s.slips.length) t.noSlip++;
    if (s.net === null || s.issues.length) t.issues++;
  }
  for (const k of ['gross', 'discount', 'net', 'slipTotal']) t[k] = round(t[k]);
  return t;
}

/** Per product for the export's second sheet. */
export function byProduct(sales) {
  const m = new Map();
  for (const s of sales) {
    for (const i of s.items) {
      const key = `${i.sku.toUpperCase()}\u0001${i.name.toUpperCase()}`;
      const p = m.get(key) || { sku: i.sku, name: i.name, qty: 0, amount: 0 };
      p.qty += i.qty;
      p.amount = round(p.amount + (i.amount || 0));
      m.set(key, p);
    }
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'th'));
}

export function listDays({ from, to } = {}) {
  const where = [];
  const args = [];
  if (isISO(from)) {
    where.push('sale_date >= ?');
    args.push(from);
  }
  if (isISO(to)) {
    where.push('sale_date <= ?');
    args.push(to);
  }
  const sales = load(where.length ? `WHERE ${where.join(' AND ')}` : '', ...args);
  const days = [];
  for (const s of sales) {
    const last = days.at(-1);
    if (last && last.date === s.sale_date) last.sales.push(s);
    else days.push({ date: s.sale_date, sales: [s] });
  }
  for (const d of days) d.totals = dayTotals(d.sales);
  return days;
}

// ---------------------------------------------------------------- writing
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i, n) => {
      const name = String(i.name ?? '').trim();
      const at = `รายการที่ ${n + 1}${name ? ` (${name.slice(0, 30)})` : ''}`;
      // amounts arrive as typed: "27,180" must stay 27180, not become empty
      const qty = amount(i.qty, `จำนวน ${at}`) ?? 1;
      const price = amount(i.price, `ราคา ${at}`);
      const discount = amount(i.discount, `ส่วนลด ${at}`) ?? 0;
      let total = amount(i.amount, `จำนวนเงิน ${at}`);
      if (total === null && price !== null) total = round(qty * price - discount);
      return {
        sku: String(i.sku ?? '').trim().slice(0, 60),
        name: name.slice(0, 300),
        imei: String(i.imei ?? '').trim().slice(0, 300),
        qty,
        price,
        discount,
        amount: total,
      };
    })
    .filter((i) => i.name || i.sku);
}

function receiptNoTaken(no, exceptId = 0) {
  return no && db.prepare('SELECT id FROM sales WHERE receipt_no = ? AND id != ?').get(no, exceptId);
}

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

const insertItem = db.prepare('INSERT INTO sale_items (sale_id, line, sku, name, imei, qty, price, discount, amount) VALUES (?,?,?,?,?,?,?,?,?)');
function writeItems(id, items) {
  db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
  items.forEach((i, n) => insertItem.run(id, n + 1, i.sku, i.name, i.imei, i.qty, i.price, i.discount, i.amount));
}

export function createSale(r, file) {
  const no = String(r.receiptNo ?? r.receipt_no ?? '').trim().slice(0, 60);
  const taken = receiptNoTaken(no);
  if (taken) {
    const e = new Error(`มีใบเสร็จ ${no} อยู่แล้ว`);
    e.status = 409;
    e.existingId = taken.id;
    throw e;
  }
  const items = cleanItems(r.items);
  const discount = amount(r.discount, 'ส่วนลดรวม') ?? 0;
  const net = amount(r.net, 'ยอดสุทธิ');
  return tx(() => {
    const id = Number(
      db
        .prepare('INSERT INTO sales (receipt_no, sale_date, sale_time, buyer, discount, net, note, file_name, file_path, issues) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(
          no,
          isISO(r.date ?? r.sale_date) ? (r.date ?? r.sale_date) : todayISO(),
          String(r.time ?? r.sale_time ?? '').slice(0, 5),
          String(r.buyer ?? '').trim().slice(0, 200),
          discount,
          net,
          String(r.note ?? '').slice(0, 1000),
          file?.name || '',
          file?.path || '',
          JSON.stringify(r.issues || []),
        ).lastInsertRowid,
    );
    writeItems(id, items);
    return id;
  });
}

export function addSlips(id, files) {
  const ins = db.prepare('INSERT INTO sale_slips (sale_id, file_name, file_path, mime) VALUES (?,?,?,?)');
  for (const f of files) {
    const name = utf8Name(f);
    const mime = f.mimetype && f.mimetype !== 'application/octet-stream' ? f.mimetype : /\.pdf$/i.test(name) ? 'application/pdf' : `image/${extname(name).slice(1).toLowerCase().replace('jpg', 'jpeg')}`;
    ins.run(id, name, saveFile('slips', f.buffer, name), mime);
  }
}

// ---------------------------------------------------------------- routes
export function salesRoutes(app, upload) {
  app.get('/api/sales', (req, res) => res.json({ today: todayISO(), days: listDays(req.query) }));

  app.get('/api/sales/today', (req, res) => {
    const [d] = listDays({ from: todayISO(), to: todayISO() });
    res.json(d ? d.totals : dayTotals([]));
  });

  /** Receipt PDF(s) and slip image(s) in one drop. One receipt + slips = a pair. */
  app.post('/api/sales', upload.array('files', 30), async (req, res) => {
    const files = req.files || [];
    const pdfs = files.filter(isPdf);
    const images = files.filter((f) => !isPdf(f) && isImage(f));
    const other = files.filter((f) => !isPdf(f) && !isImage(f));
    if (!pdfs.length) return fail(res, 400, 'ไม่มีใบเสร็จ (PDF) ในไฟล์ที่เลือก ถ้าจะแนบสลิป กด "แนบสลิป" ที่บิลนั้น');
    const out = { created: [], duplicates: [], slips: 0, unattached: images.length && pdfs.length > 1 ? images.length : 0, skipped: other.map(utf8Name) };
    for (const f of pdfs) {
      const name = utf8Name(f);
      let parsed;
      try {
        parsed = await parseReceiptPdf(f.buffer);
      } catch {
        parsed = { receiptNo: '', date: '', items: [], net: null, discount: 0, issues: ['อ่านไฟล์ PDF นี้ไม่ได้ กรอกข้อมูลเองได้'] };
      }
      if (receiptNoTaken(parsed.receiptNo)) {
        out.duplicates.push(parsed.receiptNo);
        continue;
      }
      const path = saveFile('receipts', f.buffer, name);
      let id;
      try {
        id = createSale(parsed, { name, path });
      } catch (e) {
        removeFile(path); // nothing points at it any more
        if (e.status === 409) {
          out.duplicates.push(parsed.receiptNo);
          continue;
        }
        throw e;
      }
      if (pdfs.length === 1 && images.length) {
        addSlips(id, images);
        out.slips = images.length;
      }
      out.created.push(oneSale(id));
    }
    res.status(out.created.length ? 201 : 409).json(out.created.length ? out : { ...out, error: `มีใบเสร็จ ${out.duplicates.join(', ')} อยู่แล้ว` });
  });

  app.post('/api/sales/manual', (req, res) => {
    try {
      res.status(201).json(oneSale(createSale(req.body)));
    } catch (e) {
      fail(res, e.status || 400, e.message);
    }
  });

  app.patch('/api/sales/:id', (req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!cur) return fail(res, 404, 'ไม่พบใบเสร็จนี้');
    const b = req.body;
    const set = {};
    if ('receipt_no' in b) {
      const no = String(b.receipt_no ?? '').trim().slice(0, 60);
      if (receiptNoTaken(no, id)) return fail(res, 409, `มีใบเสร็จ ${no} อยู่แล้ว`);
      set.receipt_no = no;
    }
    if ('sale_date' in b) {
      if (!isISO(b.sale_date)) return fail(res, 400, 'วันที่ไม่ถูกต้อง');
      set.sale_date = b.sale_date;
    }
    if ('sale_time' in b) set.sale_time = String(b.sale_time ?? '').slice(0, 5);
    if ('buyer' in b) set.buyer = String(b.buyer ?? '').trim().slice(0, 200);
    if ('note' in b) set.note = String(b.note ?? '').slice(0, 1000);
    let items;
    try {
      if ('discount' in b) set.discount = amount(b.discount, 'ส่วนลดรวม') ?? 0;
      if ('net' in b) set.net = amount(b.net, 'ยอดสุทธิ');
      if ('items' in b) items = cleanItems(b.items);
    } catch (e) {
      return fail(res, e.status || 400, e.message);
    }
    if (Object.keys(set).length || items) set.issues = '[]'; // checked by a person now
    tx(() => {
      const keys = Object.keys(set);
      if (keys.length) db.prepare(`UPDATE sales SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => set[k]), id);
      if (items) writeItems(id, items);
    });
    res.json(oneSale(id));
  });

  app.delete('/api/sales/:id', (req, res) => {
    const id = Number(req.params.id);
    const s = db.prepare('SELECT file_path FROM sales WHERE id = ?').get(id);
    if (!s) return fail(res, 404, 'ไม่พบใบเสร็จนี้');
    const slips = db.prepare('SELECT file_path FROM sale_slips WHERE sale_id = ?').all(id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    removeFile(s.file_path);
    for (const x of slips) removeFile(x.file_path);
    res.status(204).end();
  });

  app.get('/api/sales/:id/file', (req, res) => {
    const s = db.prepare('SELECT file_name, file_path FROM sales WHERE id = ?').get(Number(req.params.id));
    if (!s?.file_path) return fail(res, 404, 'ไม่มีไฟล์ใบเสร็จ');
    sendStored(res, s.file_path, 'application/pdf', 'receipt.pdf', s.file_name);
  });

  app.post('/api/sales/:id/slips', upload.array('files', 10), (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM sales WHERE id = ?').get(id)) return fail(res, 404, 'ไม่พบใบเสร็จนี้');
    const files = (req.files || []).filter((f) => SLIP_EXT.test(utf8Name(f)) || isImage(f));
    if (!files.length) return fail(res, 400, 'สลิปต้องเป็นรูป (.jpg .png .webp .heic) หรือ PDF');
    addSlips(id, files);
    res.status(201).json(oneSale(id));
  });

  app.get('/api/slips/:id/file', (req, res) => {
    const s = db.prepare('SELECT * FROM sale_slips WHERE id = ?').get(Number(req.params.id));
    if (!s) return fail(res, 404, 'ไม่พบสลิปนี้');
    sendStored(res, s.file_path, s.mime || 'application/octet-stream', `slip${extname(s.file_path)}`, s.file_name);
  });

  app.patch('/api/slips/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM sale_slips WHERE id = ?').get(Number(req.params.id));
    if (!s) return fail(res, 404, 'ไม่พบสลิปนี้');
    let value;
    try {
      value = amount(req.body.amount, 'ยอดในสลิป');
    } catch (e) {
      return fail(res, 400, e.message);
    }
    db.prepare('UPDATE sale_slips SET amount = ? WHERE id = ?').run(value, s.id);
    res.json(oneSale(s.sale_id));
  });

  app.delete('/api/slips/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM sale_slips WHERE id = ?').get(Number(req.params.id));
    if (!s) return fail(res, 404, 'ไม่พบสลิปนี้');
    db.prepare('DELETE FROM sale_slips WHERE id = ?').run(s.id);
    removeFile(s.file_path);
    res.json(oneSale(s.sale_id));
  });

  app.get('/api/sales/day/:date/export.:fmt', async (req, res) => {
    const date = req.params.date;
    if (!isISO(date)) return fail(res, 400, 'วันที่ไม่ถูกต้อง');
    const [day] = listDays({ from: date, to: date });
    const data = day || { date, sales: [], totals: dayTotals([]) };
    const name = dayTitle(date).replace(/\//g, '.');
    const disp = (ext) => `attachment; filename="sales.${ext}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`;
    if (req.params.fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', disp('csv'));
      return res.send(dayCsv(data));
    }
    if (req.params.fmt === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', disp('xlsx'));
      return res.send(await dayXlsx(data, byProduct(data.sales)));
    }
    fail(res, 400, 'รูปแบบไฟล์ไม่รองรับ');
  });
}
