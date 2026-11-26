import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.YOK_DB || join(root, 'data', 'yok.db');
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS cards (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    detail      TEXT    NOT NULL DEFAULT '',
    work_date   TEXT    NOT NULL,              -- YYYY-MM-DD (ค.ศ.)
    status      TEXT    NOT NULL DEFAULT 'doing' CHECK (status IN ('doing','done')),
    priority    TEXT    NOT NULL DEFAULT 'mid'   CHECK (priority IN ('high','mid','low')),
    minutes     INTEGER NOT NULL DEFAULT 0,
    tags        TEXT    NOT NULL DEFAULT '[]', -- JSON array
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS imports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    filename     TEXT    NOT NULL,
    file_type    TEXT    NOT NULL,
    title        TEXT    NOT NULL DEFAULT '',
    branches     TEXT    NOT NULL DEFAULT '',
    line_count   INTEGER NOT NULL DEFAULT 0,
    skipped      TEXT    NOT NULL DEFAULT '[]', -- JSON array of {line, reason, text}
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS stock_rows (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id  INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    line       INTEGER NOT NULL,
    brand      TEXT    NOT NULL,
    model      TEXT    NOT NULL,
    capacity   TEXT    NOT NULL DEFAULT '',
    category   TEXT    NOT NULL DEFAULT '',
    condition  TEXT    NOT NULL CHECK (condition IN ('new','used')),
    sku        TEXT    NOT NULL DEFAULT '',
    color      TEXT    NOT NULL DEFAULT '',
    supplier   TEXT    NOT NULL DEFAULT '',
    qty        INTEGER NOT NULL,
    cost       REAL,
    retail     REAL,
    wholesale  REAL
  );
  CREATE INDEX IF NOT EXISTS stock_rows_import ON stock_rows(import_id);

  -- สรุปยอดรายวัน: one row per sales receipt (ใบเสร็จ)
  CREATE TABLE IF NOT EXISTS sales (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no  TEXT    NOT NULL DEFAULT '',
    sale_date   TEXT    NOT NULL,               -- YYYY-MM-DD (ค.ศ.)
    sale_time   TEXT    NOT NULL DEFAULT '',    -- HH:MM from the receipt, if printed
    buyer       TEXT    NOT NULL DEFAULT '',
    discount    REAL    NOT NULL DEFAULT 0,     -- all discounts on the bill (items + bill)
    net         REAL,                           -- ยอดสุทธิ
    note        TEXT    NOT NULL DEFAULT '',
    file_name   TEXT    NOT NULL DEFAULT '',    -- the receipt PDF as uploaded
    file_path   TEXT    NOT NULL DEFAULT '',    -- stored under data/files
    issues      TEXT    NOT NULL DEFAULT '[]',  -- JSON: what the reader could not find
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS sales_receipt_no ON sales(receipt_no) WHERE receipt_no != '';
  CREATE INDEX IF NOT EXISTS sales_date ON sales(sale_date);

  CREATE TABLE IF NOT EXISTS sale_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id   INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    line      INTEGER NOT NULL,
    sku       TEXT    NOT NULL DEFAULT '',
    name      TEXT    NOT NULL,
    imei      TEXT    NOT NULL DEFAULT '',
    qty       REAL    NOT NULL DEFAULT 1,
    price     REAL,
    discount  REAL    NOT NULL DEFAULT 0,
    amount    REAL
  );
  CREATE INDEX IF NOT EXISTS sale_items_sale ON sale_items(sale_id);

  -- customer transfer slips; one receipt can have several
  CREATE TABLE IF NOT EXISTS sale_slips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    file_name   TEXT    NOT NULL,
    file_path   TEXT    NOT NULL,
    mime        TEXT    NOT NULL DEFAULT '',
    amount      REAL,                           -- typed in by hand when wanted
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS sale_slips_sale ON sale_slips(sale_id);
`);

/** Uploaded receipts and slips live here (data/ is not in git). */
export const filesDir = process.env.YOK_FILES || join(dbPath === ':memory:' ? join(root, 'data') : dirname(dbPath), 'files');
