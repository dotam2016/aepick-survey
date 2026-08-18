import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const RESULT_DIR = path.join(DATA_DIR, 'results');

for (const d of [DATA_DIR, UPLOAD_DIR, RESULT_DIR]) mkdirSync(d, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'aepick.sqlite'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'vi',
  status TEXT NOT NULL DEFAULT 'active',
  consents TEXT,
  nickname TEXT,
  age_group TEXT,
  avatar_id TEXT,
  mood TEXT,
  scores TEXT,
  subtypes TEXT,
  persona TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  core_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  score INTEGER NOT NULL,
  subtype TEXT NOT NULL,
  answered_at TEXT NOT NULL,
  UNIQUE(session_id, core_key)
);
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stored',
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS image_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  generator TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  error TEXT
);
CREATE TABLE IF NOT EXISTS results (
  token TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  persona TEXT NOT NULL,
  scores TEXT NOT NULL,
  image_paths TEXT,
  product_ids TEXT,
  coupon_code TEXT,
  expires_at TEXT NOT NULL,
  deleted_at TEXT,
  scan_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  device_id TEXT,
  type TEXT NOT NULL,
  payload TEXT,
  ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT,
  last_heartbeat TEXT,
  app_version TEXT,
  state TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
`);

export const now = () => new Date().toISOString();
export const todayPrefix = () => new Date().toISOString().slice(0, 10);
