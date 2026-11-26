import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { fileToGrid, fileKind } from './parse/grid.js';
import { parseStockGrid } from './parse/stock.js';
import { summarize, filterRows } from './summary.js';
import { toCsv, toXlsx, reportTitle } from './export.js';
import { salesRoutes } from './sales.js';

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('วันที่ไม่ถูกต้อง');
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
  return { ...importOut(i), ...t };
}

app.get('/api/imports', (req, res) => {
  const ids = db.prepare('SELECT id FROM imports ORDER BY id DESC').all();
  res.json(ids.map((r) => importWithTotals(r.id)));
});

app.post('/api/imports', upload.single('file'), async (req, res) => {
  if (!req.file) return fail(res, 400, 'ไม่ได้เลือกไฟล์');
  // multer gives latin1-decoded names; restore UTF-8 so Thai file names survive
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  if (!fileKind(filename)) return fail(res, 400, 'รองรับเฉพาะไฟล์ .xlsx .xls .csv และ .pdf');
  try {
    const { kind, grid } = await fileToGrid(filename, req.file.buffer);
    const parsed = parseStockGrid(grid);
    const insertImport = db.prepare(
      'INSERT INTO imports (filename, file_type, title, branches, line_count, skipped) VALUES (?,?,?,?,?,?)',
    );
    const insertRow = db.prepare(
      `INSERT INTO stock_rows (import_id, line, brand, model, capacity, category, condition, sku, color, supplier, qty, cost, retail, wholesale)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    db.exec('BEGIN');
    let id;
    try {
      id = Number(
        insertImport.run(filename, kind, parsed.title, parsed.branches, parsed.lineCount, JSON.stringify(parsed.skipped))
          .lastInsertRowid,
      );
      for (const r of parsed.rows) {
        insertRow.run(id, r.line, r.brand, r.model, r.capacity, r.category, r.condition, r.sku, r.color, r.supplier, r.qty, r.cost, r.retail, r.wholesale);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.status(201).json(importWithTotals(id));
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
  const all = loadRows(id);
  const rows = filterRows(all, req.query);
  const whole = summarize(all);
  res.json({ import: imp, title: reportTitle(), all: whole.totals, brandsAll: whole.brands, ...summarize(rows) });
});

app.get('/api/imports/:id/rows', (req, res) => {
  const id = Number(req.params.id);
  if (!importWithTotals(id)) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  res.json(filterRows(loadRows(id), req.query));
});

app.get('/api/imports/:id/export.:fmt', async (req, res) => {
  const id = Number(req.params.id);
  if (!importWithTotals(id)) return fail(res, 404, 'ไม่พบการนำเข้านี้');
  const summary = summarize(filterRows(loadRows(id), req.query));
  const name = `${reportTitle().replace(/\//g, '.')}`;
  const disp = (ext) => `attachment; filename="stock.${ext}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`;
  if (req.params.fmt === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', disp('csv'));
    return res.send(toCsv(summary));
  }
  if (req.params.fmt === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', disp('xlsx'));
    return res.send(await toXlsx(summary));
  }
  fail(res, 400, 'รูปแบบไฟล์ไม่รองรับ');
});

// ---------------------------------------------------------------- สรุปยอดรายวัน
salesRoutes(app, upload);

// ---------------------------------------------------------------- client
const dist = join(root, 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return fail(res, 413, 'ไฟล์ใหญ่เกิน 25 MB');
  console.error(err);
  fail(res, 500, 'เซิร์ฟเวอร์ผิดพลาด');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`yok api ready → http://localhost:${PORT}`);
});
