import express from 'express';
import multer from 'multer';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { fileToGrid, fileKind } from './parse/grid.js';
import { parseStockGrid } from './parse/stock.js';
import { isImeiGrid, parseImeiGrid } from './parse/imei.js';
import { summarize, filterRows, attachImeis, colorsBySku } from './summary.js';
import { toCsv, toXlsx, reportTitle, importDate } from './export.js';
import { salesRoutes } from './sales.js';
import { trackingRoutes } from './tracking.js';
import { isDate } from './util.js';

const PORT = Number(process.env.PORT) || 3001;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json({ limit: '1mb' }));

const fail = (res, status, message) => res.status(status).json({ error: message });

// ---------------------------------------------------------------- cards
const cardOut = (c) => c && { ...c, tags: JSON.parse(c.tags || '[]') };
const STATUSES = ['doing', 'done'];
const PRIORITIES = ['high', 'mid', 'low'];

function cardIn(body, partial = false) {
  const out = {};
  if (!partial || 'title' in body) {
    const t = String(body.title ?? '').trim();
    if (!t) throw new Error('กรุณาใส่หัวข้องาน');
    out.title = t.slice(0, 200);
  }
  if (!partial || 'detail' in body) out.detail = String(body.detail ?? '').slice(0, 5000);
  if (!partial || 'work_date' in body) {
    const d = String(body.work_date ?? '');
    if (!isDate(d)) throw new Error('วันที่ไม่ถูกต้อง');
    out.work_date = d;
  }
  if (!partial || 'status' in body) {
    out.status = STATUSES.includes(body.status) ? body.status : 'doing';
  }
  if (!partial || 'priority' in body) {
    out.priority = PRIORITIES.includes(body.priority) ? body.priority : 'mid';
  }
  if (!partial || 'minutes' in body) {
    const m = Math.round(Number(body.minutes) || 0);
    out.minutes = Math.max(0, Math.min(m, 100000));
  }
  if (!partial || 'tags' in body) {
    const tags = Array.isArray(body.tags) ? body.tags : [];
    out.tags = JSON.stringify([...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 12));
  }
  return out;
}

app.get('/api/cards', (req, res) => {
  const rows = db.prepare('SELECT * FROM cards ORDER BY work_date DESC, id DESC').all();
  res.json(rows.map(cardOut));
});

app.post('/api/cards', (req, res) => {
  try {
    const c = cardIn(req.body);
    const r = db
      .prepare('INSERT INTO cards (title, detail, work_date, status, priority, minutes, tags) VALUES (?,?,?,?,?,?,?)')
      .run(c.title, c.detail, c.work_date, c.status, c.priority, c.minutes, c.tags);
    res.status(201).json(cardOut(db.prepare('SELECT * FROM cards WHERE id = ?').get(r.lastInsertRowid)));
  } catch (e) {
    fail(res, 400, e.message);
  }
});

app.patch('/api/cards/:id', (req, res) => {
  try {
    const c = cardIn(req.body, true);
    const keys = Object.keys(c);
    if (!keys.length) return fail(res, 400, 'ไม่มีข้อมูลให้แก้ไข');
    const sql = `UPDATE cards SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = ?`;
    const r = db.prepare(sql).run(...keys.map((k) => c[k]), Number(req.params.id));
    if (!r.changes) return fail(res, 404, 'ไม่พบการ์ดนี้');
    res.json(cardOut(db.prepare('SELECT * FROM cards WHERE id = ?').get(Number(req.params.id))));
  } catch (e) {
    fail(res, 400, e.message);
  }
});

app.delete('/api/cards/:id', (req, res) => {
  const r = db.prepare('DELETE FROM cards WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return fail(res, 404, 'ไม่พบการ์ดนี้');
  res.status(204).end();
});

// ---------------------------------------------------------------- stock imports
const importOut = (i) =>
  i && {
    ...i,
    skipped: JSON.parse(i.skipped || '[]'),
  };

function importWithTotals(id) {
  const i = db.prepare('SELECT * FROM imports WHERE id = ?').get(id);
  if (!i) return null;
  const t = db
    .prepare(
      `SELECT COUNT(*) AS rows, COALESCE(SUM(qty),0) AS qty,
              COALESCE(SUM(CASE WHEN condition='new' THEN qty END),0) AS newQty,
              COALESCE(SUM(CASE WHEN condition='used' THEN qty END),0) AS usedQty
       FROM stock_rows WHERE import_id = ?`,
    )
    .get(id);
  const imei_count = db.prepare('SELECT COUNT(*) AS n FROM stock_imeis WHERE import_id = ?').get(id).n;
  return { ...importOut(i), ...t, imei_count };
}

const loadImeis = (id) => db.prepare('SELECT * FROM stock_imeis WHERE import_id = ? ORDER BY line').all(id);

function saveStock(filename, kind, parsed) {
  const insertImport = db.prepare('INSERT INTO imports (filename, file_type, title, branches, line_count, skipped) VALUES (?,?,?,?,?,?)');
  const insertRow = db.prepare(
    `INSERT INTO stock_rows (import_id, line, brand, model, capacity, category, condition, sku, color, supplier, qty, cost, retail, wholesale)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  db.exec('BEGIN');
  try {
    const id = Number(insertImport.run(filename, kind, parsed.title, parsed.branches, parsed.lineCount, JSON.stringify(parsed.skipped)).lastInsertRowid);
    for (const r of parsed.rows) {
      insertRow.run(id, r.line, r.brand, r.model, r.capacity, r.category, r.condition, r.sku, r.color, r.supplier, r.qty, r.cost, r.retail, r.wholesale);
    }
    db.exec('COMMIT');
    return id;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** Replaces the IMEI list of a stock import. */
function saveImeis(importId, filename, units) {
  const ins = db.prepare('INSERT INTO stock_imeis (import_id, line, sku, name, condition, branch, imei, retail, wholesale, note) VALUES (?,?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM stock_imeis WHERE import_id = ?').run(importId);
    for (const u of units) ins.run(importId, u.line, u.sku, u.name, u.condition, u.branch, u.imei, u.retail, u.wholesale, u.note);
    db.prepare('UPDATE imports SET imei_file = ? WHERE id = ?').run(filename, importId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** The whole import with IMEIs attached, plus how well the two files agree. */
function fullSummary(id) {
  const rows = loadRows(id);
  const imeis = loadImeis(id);
  const whole = summarize(rows);
  const check = imeis.length ? attachImeis(whole, imeis) : null;
  return { rows, imeis, whole, check };
}

app.get('/api/imports', (req, res) => {
  const ids = db.prepare('SELECT id FROM imports ORDER BY id DESC').all();
  res.json(ids.map((r) => importWithTotals(r.id)));
});

/**
 * One or more files: stock reports become imports; an IMEI list ("รายงานสินค้าราคาขายปลีกและขายส่ง")
 * is attached to the stock report sent with it, else to `importId`, else to the newest import.
 */
app.post('/api/imports', upload.any(), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return fail(res, 400, 'ไม่ได้เลือกไฟล์');
  try {
    // Read and check every file first; save only when all of them are good, so a bad
    // second file does not leave the first one half-imported behind an error message.
    const stock = [];
    const imeiFiles = [];
    for (const f of files) {
      // multer gives latin1-decoded names; restore UTF-8 so Thai file names survive
      const filename = Buffer.from(f.originalname, 'latin1').toString('utf8');
      if (!fileKind(filename)) throw new Error(`${filename}: รองรับเฉพาะไฟล์ .xlsx .xls .csv และ .pdf`);
      const { kind, grid } = await fileToGrid(filename, f.buffer);
      const named = (fn) => {
        try {
          return fn();
        } catch (e) {
          throw new Error(files.length > 1 ? `${filename}: ${e.message}` : e.message);
        }
      };
      if (isImeiGrid(grid)) imeiFiles.push({ filename, units: named(() => parseImeiGrid(grid).units) });
      else stock.push({ filename, kind, parsed: named(() => parseStockGrid(grid)) });
    }
    let target = null;
    if (imeiFiles.length && !stock.length) {
      const asked = Number(req.body?.importId);
      target = (asked && db.prepare('SELECT id FROM imports WHERE id = ?').get(asked)?.id) || db.prepare('SELECT id FROM imports ORDER BY id DESC LIMIT 1').get()?.id;
      if (!target) throw new Error('ไฟล์นี้เป็นรายการ IMEI ต้องนำเข้ารายงานสต็อกสินค้า (รวมตามรหัสสินค้า) ก่อน หรือเลือกทั้งสองไฟล์พร้อมกัน');
    }
    let id = null;
    for (const s of stock) id = saveStock(s.filename, s.kind, s.parsed);
    if (imeiFiles.length) {
      const f = imeiFiles.at(-1);
      id = id ?? target;
      saveImeis(id, f.filename, f.units);
    }
    const out = importWithTotals(id);
    out.imeiAttached = imeiFiles.length > 0;
    out.stockAdded = stock.length > 0;
    if (out.imei_count) out.imeiCheck = fullSummary(id).check;
    res.status(201).json(out);
  } catch (e) {
    fail(res, 422, e.message || 'อ่านไฟล์ไม่สำเร็จ');
  }
});

app.delete('/api/imports/:id', (req, res) => {
  const r = db.prepare('DELETE FROM imports WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  res.status(204).end();
});

function loadRows(id) {
  return db.prepare('SELECT * FROM stock_rows WHERE import_id = ? ORDER BY line').all(id);
}

app.get('/api/imports/:id/summary', (req, res) => {
  const id = Number(req.params.id);
  const imp = importWithTotals(id);
  if (!imp) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  const { rows: all, imeis, whole, check } = fullSummary(id);
  const part = summarize(filterRows(all, req.query, imeis));
  if (imeis.length) attachImeis(part, imeis, colorsBySku(all));
  res.json({ import: imp, title: reportTitle(importDate(imp.created_at), imp.branches), all: whole.totals, brandsAll: whole.brands, imeiCheck: check, ...part });
});

app.get('/api/imports/:id/rows', (req, res) => {
  const id = Number(req.params.id);
  if (!importWithTotals(id)) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  res.json(filterRows(loadRows(id), req.query));
});

app.get('/api/imports/:id/export.:fmt', async (req, res) => {
  const id = Number(req.params.id);
  const imp = importWithTotals(id);
  if (!imp) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  const rows = loadRows(id);
  const imeis = loadImeis(id);
  const summary = summarize(filterRows(rows, req.query, imeis));
  if (imeis.length) attachImeis(summary, imeis, colorsBySku(rows));
  const date = importDate(imp.created_at);
  const name = reportTitle(date, imp.branches).replace(/\//g, '.');
  const disp = (ext) => `attachment; filename="stock.${ext}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`;
  if (req.params.fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', disp('csv'));
    return res.send(toCsv(summary, date, imp.branches));
  }
  if (req.params.fmt === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', disp('xlsx'));
    return res.send(await toXlsx(summary, date, imp.branches));
  }
  fail(res, 400, 'รูปแบบไฟล์ไม่รองรับ');
});

// ---------------------------------------------------------------- สรุปยอดรายวัน
salesRoutes(app, upload);

// ---------------------------------------------------------------- ติดตามสินค้า (J&T)
trackingRoutes(app, upload);

// ---------------------------------------------------------------- client
const dist = join(root, 'dist');

/** Changes whenever the page is rebuilt; an open tab compares it to know it is out of date. */
app.get('/api/version', (req, res) => {
  const index = join(dist, 'index.html');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ build: existsSync(index) ? String(Math.round(statSync(index).mtimeMs)) : null });
});
if (existsSync(dist)) {
  // index.html is always re-checked so a rebuilt page is picked up; hashed assets can be cached
  const noCache = (res) => res.setHeader('Cache-Control', 'no-cache');
  app.use(express.static(dist, { setHeaders: (res, path) => path.endsWith('index.html') && noCache(res) }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    noCache(res);
    res.sendFile(join(dist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'ไฟล์ใหญ่เกิน 25 MB');
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') return fail(res, 400, 'เลือกไฟล์มากเกินไปในครั้งเดียว ลองแบ่งเป็นหลายรอบ');
    return fail(res, 400, `อัพโหลดไม่สำเร็จ (${err.code})`);
  }
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  if (err.type === 'entity.too.large') return fail(res, 413, 'ข้อมูลที่ส่งมาใหญ่เกินไป');
  if (err.status && err.status < 500) return fail(res, err.status, err.message);
  console.error(err);
  fail(res, 500, 'เซิร์ฟเวอร์ผิดพลาด');
});

// Express 5 also calls this back when listening fails; only report success on success
const server = app.listen(PORT, '127.0.0.1', (err) => {
  if (!err) console.log(`yok api ready → http://localhost:${PORT}`);
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nพอร์ต ${PORT} ถูกโปรแกรมอื่นใช้อยู่ ปิดโปรแกรมนั้นก่อน หรือเปิดหน้าต่างสมุดงานที่ค้างอยู่แล้วปิด แล้วลองใหม่`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
