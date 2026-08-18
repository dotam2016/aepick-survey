import type { FastifyInstance } from 'fastify';
import { randomUUID, randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import {
  AXES,
  determinePersona,
  personaPercentile,
  scoreCare,
  scoreLocalFit,
  scoreRepick,
  scoreTrend,
  scoreTrust,
  scoreValue,
  type Axis,
  type GameResult,
  type PersonaId,
  type Scores,
} from '@aepick/shared';
import { db, now, todayPrefix, UPLOAD_DIR, RESULT_DIR } from './db.js';
import { enqueueImageJob } from './imageJob.js';
import { PRODUCTS, recommend } from './products.js';
import { recommendBrands } from './brands.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

const SCORERS: Record<Axis, (a: never) => GameResult> = {
  repick: scoreRepick as never,
  value: scoreValue as never,
  care: scoreCare as never,
  trend: scoreTrend as never,
  localFit: scoreLocalFit as never,
  trust: scoreTrust as never,
};

const RESULT_TTL_HOURS = Number(process.env.RESULT_TTL_HOURS ?? 48);
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? '';

interface SessionRow {
  id: string; device_id: string; language: string; status: string;
  consents: string | null; nickname: string | null; avatar_id: string | null;
  scores: string | null; persona: string | null; started_at: string;
}

export function registerRoutes(app: FastifyInstance) {
  /* ── 1. 세션 생성 ── */
  app.post('/api/sessions', async (req) => {
    const { deviceId, language } = (req.body ?? {}) as { deviceId?: string; language?: string };
    const id = randomUUID();
    db.prepare(`INSERT INTO sessions (id, device_id, language, started_at) VALUES (?, ?, ?, ?)`)
      .run(id, deviceId ?? 'unknown', language ?? 'vi', now());
    db.prepare(`INSERT INTO events (session_id, device_id, type, ts) VALUES (?, ?, 'session.started', ?)`)
      .run(id, deviceId ?? 'unknown', now());
    return ok({ sessionId: id });
  });

  /* ── 2. 동의 ── */
  app.patch('/api/sessions/:id/consent', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { consents?: object; nickname?: string; ageGroup?: string; avatarId?: string };
    const res = db.prepare(
      `UPDATE sessions SET consents=?, nickname=?, age_group=?, avatar_id=? WHERE id=?`,
    ).run(JSON.stringify(body.consents ?? {}), body.nickname ?? null, body.ageGroup ?? null, body.avatarId ?? null, id);
    if (res.changes === 0) return reply.code(404).send(err('not_found', 'session not found'));
    return ok({});
  });

  /* ── 3. 사진 업로드 ── */
  app.post('/api/sessions/:id/photo', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = db.prepare(`SELECT id FROM sessions WHERE id=?`).get(id);
    if (!session) return reply.code(404).send(err('not_found', 'session not found'));

    let mood = 'soft';
    let saved: string | null = null;
    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'photo') {
        const file = path.join(UPLOAD_DIR, `${id}.jpg`);
        await pipeline(part.file, createWriteStream(file));
        saved = file;
      } else if (part.type === 'field' && part.fieldname === 'mood') {
        mood = String(part.value);
      }
    }
    if (!saved) return reply.code(400).send(err('bad_request', 'photo file missing'));
    db.prepare(`INSERT INTO photos (session_id, file_path) VALUES (?, ?)`).run(id, saved);
    db.prepare(`UPDATE sessions SET mood=? WHERE id=?`).run(mood, id);
    return ok({ photoId: id });
  });

  /* ── 4. 게임 답변 ── */
  app.post('/api/sessions/:id/answers/:coreKey', async (req, reply) => {
    const { id, coreKey } = req.params as { id: string; coreKey: Axis };
    if (!AXES.includes(coreKey)) return reply.code(400).send(err('bad_request', `unknown coreKey ${coreKey}`));
    try {
      const result = SCORERS[coreKey](req.body as never);
      db.prepare(
        `INSERT INTO answers (session_id, core_key, payload, score, subtype, answered_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id, core_key) DO UPDATE SET payload=excluded.payload, score=excluded.score, subtype=excluded.subtype, answered_at=excluded.answered_at`,
      ).run(id, coreKey, JSON.stringify(req.body), result.score, result.subtype, now());
      return ok(result);
    } catch (e) {
      return reply.code(400).send(err('invalid_answer', (e as Error).message));
    }
  });

  /* ── 5. 완료: 스코어 확정 + 페르소나 + 토큰 + 이미지 잡 ── */
  app.post('/api/sessions/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = db.prepare(`SELECT * FROM sessions WHERE id=?`).get(id) as SessionRow | undefined;
    if (!session) return reply.code(404).send(err('not_found', 'session not found'));

    const answers = db.prepare(`SELECT core_key, score, subtype FROM answers WHERE session_id=?`).all(id) as
      { core_key: Axis; score: number; subtype: string }[];
    const scores = Object.fromEntries(AXES.map((a) => [a, 50])) as Scores;
    const subtypes: Record<string, string> = {};
    for (const a of answers) { scores[a.core_key] = a.score; subtypes[a.core_key] = a.subtype; }

    const { personaId, topAxes } = determinePersona(scores);

    // 오늘 페르소나 분포 → 희소성
    const rows = db.prepare(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at LIKE ? GROUP BY persona`,
    ).all(`${todayPrefix()}%`) as { persona: string; n: number }[];
    const counts = Object.fromEntries(rows.map((r) => [r.persona, r.n]));
    counts[personaId] = (counts[personaId] ?? 0) + 1;
    const percentile = personaPercentile(counts, personaId);

    // 결과 토큰 + 쿠폰
    const existing = db.prepare(`SELECT token FROM results WHERE session_id=?`).get(id) as { token: string } | undefined;
    const token = existing?.token ?? randomBytes(24).toString('base64url');
    const coupon = `AEPICK-${token.slice(0, 6).toUpperCase()}`;
    const products = recommend(personaId, topAxes);
    const expiresAt = new Date(Date.now() + RESULT_TTL_HOURS * 3600_000).toISOString();

    if (!existing) {
      db.prepare(
        `INSERT INTO results (token, session_id, persona, scores, product_ids, coupon_code, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(token, id, personaId, JSON.stringify(scores), JSON.stringify(products.map((p) => p.id)), coupon, expiresAt);
    }
    db.prepare(`UPDATE sessions SET status='completed', scores=?, subtypes=?, persona=?, completed_at=? WHERE id=?`)
      .run(JSON.stringify(scores), JSON.stringify(subtypes), personaId, now(), id);

    enqueueImageJob({
      sessionId: id, token, persona: personaId, scores,
      nickname: session.nickname ?? '', avatarId: session.avatar_id,
    });

    // 태블릿이 접속한 주소(스킴+호스트)를 그대로 QR에 넣는다.
    // → 같은 네트워크의 휴대폰이 바로 열 수 있고, HTTPS 시연에서도 스킴이 맞는다.
    const base = PUBLIC_BASE || `${req.protocol}://${req.headers.host ?? `localhost:${process.env.PORT ?? 8787}`}`;
    const resultUrl = `${base}/r/${token}`;
    const qrPngUrl = await QRCode.toDataURL(resultUrl, { width: 480, margin: 1 });
    db.prepare(`INSERT INTO events (session_id, type, ts) VALUES (?, 'qr.issued', ?)`).run(id, now());

    return ok({
      scores, persona: personaId, percentile, resultToken: token, qrPngUrl, resultUrl,
      products: products.map((p) => ({ id: p.id, name: p.name, category: p.category, reasonKey: p.reasonKey })),
    });
  });

  /* ── 6. 이미지 상태 ── */
  app.get('/api/sessions/:id/image-status', async (req) => {
    const { id } = req.params as { id: string };
    const job = db.prepare(`SELECT status FROM image_jobs WHERE session_id=?`).get(id) as { status: string } | undefined;
    const result = db.prepare(`SELECT image_paths FROM results WHERE session_id=?`).get(id) as { image_paths: string | null } | undefined;
    const images = result?.image_paths ? JSON.parse(result.image_paths) : null;
    const status = job?.status ?? 'queued';
    return ok({ status, imageUrl: images?.story916 ?? undefined });
  });

  /* ── 7. 오늘 통계 (Attract·게임 내 표시) ── */
  app.get('/api/stats/today', async () => {
    const prefix = `${todayPrefix()}%`;
    const total = (db.prepare(`SELECT COUNT(*) n FROM sessions WHERE status='completed' AND started_at LIKE ?`).get(prefix) as { n: number }).n;
    const top = db.prepare(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at LIKE ? GROUP BY persona ORDER BY n DESC LIMIT 1`,
    ).get(prefix) as { persona: PersonaId } | undefined;

    // 코인 평균 최다 슬롯
    const valueAnswers = db.prepare(
      `SELECT payload FROM answers WHERE core_key='value' AND answered_at LIKE ?`,
    ).all(prefix) as { payload: string }[];
    const coinSum: Record<string, number> = {};
    for (const a of valueAnswers) {
      const coins = JSON.parse(a.payload).coins ?? {};
      for (const [k, v] of Object.entries(coins)) coinSum[k] = (coinSum[k] ?? 0) + Number(v);
    }
    const topCoinSlot = Object.entries(coinSum).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // 트렌드 투표 분포
    const trendAnswers = db.prepare(`SELECT payload FROM answers WHERE core_key='trend' AND answered_at LIKE ?`).all(prefix) as { payload: string }[];
    const trendVotes: Record<string, Record<string, number>> = {};
    for (const a of trendAnswers) {
      const swipes = JSON.parse(a.payload).swipes ?? {};
      for (const [card, dir] of Object.entries(swipes)) {
        trendVotes[card] = trendVotes[card] ?? {};
        trendVotes[card][dir as string] = (trendVotes[card][dir as string] ?? 0) + 1;
      }
    }

    // 리뷰 선택 분포
    const trustAnswers = db.prepare(`SELECT payload FROM answers WHERE core_key='trust' AND answered_at LIKE ?`).all(prefix) as { payload: string }[];
    const reviewVotes: Record<string, number> = {};
    for (const a of trustAnswers) {
      const picked = JSON.parse(a.payload).picked;
      if (picked) reviewVotes[picked] = (reviewVotes[picked] ?? 0) + 1;
    }

    return ok({ totalParticipants: total, topPersona: top?.persona ?? null, topCoinSlot, trendVotes, reviewVotes });
  });

  /* ── 8. 이벤트 배치 ── */
  app.post('/api/events', async (req) => {
    const { events } = (req.body ?? {}) as { events?: { type: string; sessionId?: string; payload?: object; ts?: string }[] };
    const deviceId = String(req.headers['x-device-id'] ?? 'unknown');
    const insert = db.prepare(`INSERT INTO events (session_id, device_id, type, payload, ts) VALUES (?, ?, ?, ?, ?)`);
    for (const e of events ?? []) insert.run(e.sessionId ?? null, deviceId, e.type, JSON.stringify(e.payload ?? {}), e.ts ?? now());
    return ok({});
  });

  /* ── 10. 결과 데이터 (모바일 웹) ── */
  app.get('/api/results/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const row = db.prepare(`SELECT * FROM results WHERE token=?`).get(token) as {
      session_id: string; persona: PersonaId; scores: string; image_paths: string | null;
      product_ids: string; coupon_code: string; expires_at: string; deleted_at: string | null; scan_count: number;
    } | undefined;
    // 브랜드 추천은 저장하지 않고 조회 시 계산 — 카탈로그를 바꾸면 기존 결과에도 즉시 반영된다
    if (!row || row.deleted_at) return reply.code(410).send(err('gone', 'result deleted'));
    if (new Date(row.expires_at) < new Date()) return reply.code(410).send(err('gone', 'result expired'));

    if (row.scan_count === 0) {
      db.prepare(`INSERT INTO events (session_id, type, ts) VALUES (?, 'result.scanned', ?)`).run(row.session_id, now());
    }
    db.prepare(`UPDATE results SET scan_count=scan_count+1 WHERE token=?`).run(token);

    const session = db.prepare(`SELECT nickname, language FROM sessions WHERE id=?`).get(row.session_id) as
      { nickname: string | null; language: string } | undefined;
    const ids = JSON.parse(row.product_ids) as string[];
    const products = ids.map((pid) => PRODUCTS.find((p) => p.id === pid)).filter(Boolean).map((p) => ({
      id: p!.id, name: p!.name, category: p!.category, reasonKey: p!.reasonKey, shopUrl: p!.shopUrl,
    }));

    const scores = JSON.parse(row.scores) as Scores;
    const { topAxes } = determinePersona(scores);
    const brands = recommendBrands(row.persona, topAxes).map((b) => ({
      id: b.id, name: b.name, tagline: b.tagline, emoji: b.emoji,
      products: b.products,
    }));

    return ok({
      persona: row.persona,
      nickname: session?.nickname ?? '',
      language: session?.language ?? 'vi',
      scores,
      images: row.image_paths ? JSON.parse(row.image_paths) : null,
      products,
      brands,
      coupon: row.coupon_code,
      expiresAt: row.expires_at,
    });
  });

  /* ── 11. 다운로드 ── */
  app.get('/api/results/:token/download/:variant', async (req, reply) => {
    const { token, variant } = req.params as { token: string; variant: string };
    const map: Record<string, string> = { story: 'story916.jpg', feed: 'feed45.jpg', plain: 'plain.jpg', card: 'card.jpg' };
    const file = map[variant];
    const row = db.prepare(`SELECT session_id, deleted_at FROM results WHERE token=?`).get(token) as
      { session_id: string; deleted_at: string | null } | undefined;
    if (!row || row.deleted_at || !file) return reply.code(404).send(err('not_found', 'not found'));
    const full = path.join(RESULT_DIR, token, file);
    if (!existsSync(full)) return reply.code(404).send(err('not_found', 'image not ready'));
    db.prepare(`UPDATE results SET download_count=download_count+1 WHERE token=?`).run(token);
    db.prepare(`INSERT INTO events (session_id, type, payload, ts) VALUES (?, 'result.downloaded', ?, ?)`)
      .run(row.session_id, JSON.stringify({ variant }), now());
    return reply
      .header('Content-Disposition', `attachment; filename="aepick-beauty-dna-${variant}.jpg"`)
      .type('image/jpeg')
      .send(await import('node:fs').then((fs) => fs.createReadStream(full)));
  });

  /* ── 12. 즉시 삭제 ── */
  app.delete('/api/results/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const row = db.prepare(`SELECT token FROM results WHERE token=? AND deleted_at IS NULL`).get(token);
    if (!row) return reply.code(404).send(err('not_found', 'not found'));
    deleteResult(token);
    return ok({});
  });
}

/** 결과 이미지+레코드 삭제 (즉시 삭제·만료 공용) */
export function deleteResult(token: string) {
  const dir = path.join(RESULT_DIR, token);
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  db.prepare(`UPDATE results SET deleted_at=?, image_paths=NULL WHERE token=?`).run(now(), token);
}

/** 만료 스케줄러 — 10분 주기 (결과 만료 + 잔존 업로드 정리) */
export function startExpiryScheduler() {
  const sweep = () => {
    const expired = db.prepare(`SELECT token FROM results WHERE deleted_at IS NULL AND expires_at < ?`).all(now()) as { token: string }[];
    for (const r of expired) deleteResult(r.token);
    if (expired.length) console.log(`[expiry] deleted ${expired.length} expired results`);

    // 삭제 재시도 실패로 남은 업로드 원본 정리 (30분 초과분)
    try {
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const f of readdirSync(UPLOAD_DIR)) {
        const full = path.join(UPLOAD_DIR, f);
        if (statSync(full).mtimeMs < cutoff) {
          try { rmSync(full, { force: true }); console.log('[expiry] swept orphan upload:', f); } catch { /* next sweep */ }
        }
      }
    } catch { /* ignore */ }
  };
  sweep();
  setInterval(sweep, 10 * 60 * 1000);
}
