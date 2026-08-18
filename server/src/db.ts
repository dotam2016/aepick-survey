import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'aepick.sqlite'));
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  visitor_id TEXT,
  language TEXT NOT NULL DEFAULT 'vi',
  status TEXT NOT NULL DEFAULT 'active',
  consents TEXT,
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
CREATE TABLE IF NOT EXISTS results (
  token TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  persona TEXT NOT NULL,
  scores TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  visit_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pairings (
  code TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  visitor_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pairings_device ON pairings(device_id, status);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
`);

/*
 * 이미 운영 중인 PAD의 DB에 컬럼을 더할 때를 위한 방어적 마이그레이션.
 * node:sqlite 에는 IF NOT EXISTS 형태의 ADD COLUMN 이 없어 실패를 삼킨다.
 */
function addColumnIfMissing(table: string, column: string, decl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
addColumnIfMissing('sessions', 'visitor_id', 'TEXT');

export const now = () => new Date().toISOString();
export const todayPrefix = () => new Date().toISOString().slice(0, 10);
