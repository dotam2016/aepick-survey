/**
 * 시연용 시드 데이터 — 대기화면 통계(참여자 수·인기 DNA)와 게임 내 집계를 채운다.
 * 통계가 0이면 Attract 화면이 비어 보이므로, 시연 직전에 한 번 실행한다.
 *
 *   node tools/seed-demo.mjs [건수]     기본 24건
 *   node tools/seed-demo.mjs --clear    오늘 시드 데이터 삭제
 */
import '../server/src/loadEnv.js';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const DEVICE = 'SEED-DEMO';

if (process.argv.includes('--clear')) {
  const a = await pool.query(`DELETE FROM answers WHERE session_id IN (SELECT id FROM sessions WHERE device_id=$1)`, [DEVICE]);
  const s = await pool.query(`DELETE FROM sessions WHERE device_id=$1`, [DEVICE]);
  const e = await pool.query(`DELETE FROM events WHERE device_id=$1`, [DEVICE]);
  console.log(`시드 삭제 — sessions ${s.rowCount}, answers ${a.rowCount}, events ${e.rowCount}`);
  await pool.end();
  process.exit(0);
}

const COUNT = Number(process.argv[2]) || 24;
const PERSONAS = ['trendMuse', 'localBeautyExpert', 'trustGuardian', 'smartBeautyCurator', 'loyalGlowKeeper', 'beautyExplorer'];
const WEIGHTS = [5, 4, 4, 3, 2, 2];
const LANGS = ['vi', 'vi', 'vi', 'en', 'ko'];

const pickWeighted = (arr, w, r) => {
  let acc = 0;
  const total = w.reduce((a, b) => a + b, 0);
  const t = r * total;
  for (let i = 0; i < arr.length; i++) { acc += w[i]; if (t <= acc) return arr[i]; }
  return arr[arr.length - 1];
};

const now = Date.now();

const COIN_SETS = [
  { effect: 4, ingredient: 2, price: 3, volume: 1, gift: 0, brand: 0, package: 0, kol: 0 },
  { effect: 3, ingredient: 3, price: 2, volume: 1, gift: 1, brand: 0, package: 0, kol: 0 },
  { effect: 2, ingredient: 1, price: 4, volume: 2, gift: 1, brand: 0, package: 0, kol: 0 },
];
const TREND_SETS = [
  { glassSkin: 'love', softMatte: 'next', naturalPeach: 'love', boldColor: 'notme', minimalSkin: 'next', y2k: 'notme' },
  { glassSkin: 'next', softMatte: 'love', naturalPeach: 'next', boldColor: 'next', minimalSkin: 'love', y2k: 'next' },
  { glassSkin: 'love', softMatte: 'notme', naturalPeach: 'love', boldColor: 'love', minimalSkin: 'notme', y2k: 'love' },
];
const REVIEWS = ['B', 'B', 'B', 'A', 'C'];

let made = 0;
for (let i = 0; i < COUNT; i++) {
  const r = (i * 0.37 + 0.11) % 1;
  const persona = pickWeighted(PERSONAS, WEIGHTS, r);
  const lang = LANGS[i % LANGS.length];
  const startedAt = new Date(now - (COUNT - i) * 6 * 60 * 1000).toISOString();
  const completedAt = new Date(now - (COUNT - i) * 6 * 60 * 1000 + 4.6 * 60 * 1000).toISOString();
  const id = randomUUID();
  const scores = {
    repick: 55 + Math.round(r * 40), value: 50 + Math.round(((r * 3) % 1) * 45),
    care: 55 + Math.round(((r * 7) % 1) * 40), trend: 45 + Math.round(((r * 11) % 1) * 50),
    localFit: 55 + Math.round(((r * 13) % 1) * 45), trust: 50 + Math.round(((r * 17) % 1) * 45),
  };

  await pool.query(
    `INSERT INTO sessions (id, device_id, language, status, consents, scores, persona, started_at, completed_at)
     VALUES ($1, $2, $3, 'completed', '{}', $4, $5, $6, $7)`,
    [id, DEVICE, lang, JSON.stringify(scores), persona, startedAt, completedAt],
  );
  await pool.query(
    `INSERT INTO answers (session_id, core_key, payload, score, subtype, answered_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, 'value', JSON.stringify({ coins: COIN_SETS[i % 3] }), 70, 'practical', completedAt],
  );
  await pool.query(
    `INSERT INTO answers (session_id, core_key, payload, score, subtype, answered_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, 'trend', JSON.stringify({ swipes: TREND_SETS[i % 3] }), scores.trend, 'pioneer', completedAt],
  );
  await pool.query(
    `INSERT INTO answers (session_id, core_key, payload, score, subtype, answered_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, 'trust', JSON.stringify({ picked: REVIEWS[i % 5], cluesViewed: [] }), scores.trust, 'detail', completedAt],
  );
  await pool.query(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, '{}', $4)`, [id, DEVICE, 'session.started', startedAt]);
  await pool.query(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, '{}', $4)`, [id, DEVICE, 'session.completed', completedAt]);
  await pool.query(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, '{}', $4)`, [id, DEVICE, 'qr.issued', completedAt]);
  if (i % 2 === 0) await pool.query(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, '{}', $4)`, [id, DEVICE, 'result.scanned', completedAt]);
  if (i % 3 === 0) await pool.query(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, '{}', $4)`, [id, DEVICE, 'result.downloaded', completedAt]);
  made++;
}

const { rows } = await pool.query(`SELECT persona, COUNT(*) n FROM sessions WHERE device_id=$1 GROUP BY persona ORDER BY n DESC LIMIT 1`, [DEVICE]);
const top = rows[0];
console.log(`✅ 시드 ${made}건 생성 — 인기 DNA: ${top.persona} (${top.n}명)`);
console.log('   대기화면 통계와 대시보드에 즉시 반영됩니다. 삭제: node tools/seed-demo.mjs --clear');
await pool.end();
