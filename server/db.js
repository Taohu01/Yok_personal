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
`);
