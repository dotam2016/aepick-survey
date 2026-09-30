import type { FastifyInstance } from 'fastify';
import { randomUUID, randomBytes } from 'node:crypto';
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
import { one, many, run, now, todayPrefix } from './db.js';
import { recommendBrands, recommendProducts, type CatalogProduct } from './catalog.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

// 이벤트 체크인 시스템(Zalo)에서 QR로 받은 전화번호로 이름·성별·생년월일을 조회한다.
// 브라우저에서 직접 부르면 이 람다의 CORS가 운영 프론트 origin 하나만 허용해
// 로컬 개발(localhost) 등 다른 origin에서는 항상 실패한다 — 서버를 거쳐 대신 호출한다.
const PHONE_LOOKUP_URL = 'https://qjqcjuvb3x5uqdebkjtcvu52vq0lulze.lambda-url.ap-southeast-1.on.aws/';
const PHONE_RE = /^0\d{9}$/;

interface PhoneLookupResponse {
  ok: boolean;
  data?: {
    name?: string | null;
    gender?: string | null;
    dob?: string | null;
    data?: { full_name?: string | null; gender?: string | null; dob?: string | null } | null;
  };
}

function mapGender(raw: string | null | undefined): 'male' | 'female' | 'other' | null {
  if (!raw) return null;
  const v = raw.toLowerCase().trim();
  if (v === 'nam' || v === 'male') return 'male';
  if (v === 'nữ' || v === 'nu' || v === 'female') return 'female';
  return 'other';
}

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
  scores: string | null; persona: string | null; started_at: string;
}

export function registerRoutes(app: FastifyInstance) {
  /*
   * 0. 세션 생성 (익명).
   * QR 페어링을 없애기로 하면서 app 계정 연동이 사라졌다. 투표 1인 1회 제한
   * (votes.visitor_id UNIQUE)이 계속 동작하도록 세션마다 임시 visitor_id를
   * 새로 발급한다 — 다만 이제는 계정 기준이 아니라 세션 기준 중복 방지라
   * 같은 사람이 다시 시작하면 또 투표할 수 있다.
   * ponytail: 재방문자 식별(진짜 계정 연동) 필요해지면 여기부터 다시 붙인다.
   */
  app.post('/api/sessions', async (req) => {
    const { deviceId, language } = (req.body ?? {}) as { deviceId?: string; language?: string };
    const sessionId = randomUUID();
    const visitorId = randomUUID();
    const ts = now();
    await run(`INSERT INTO visitors (id, visit_count, first_seen_at, last_seen_at) VALUES ($1, 1, $2, $3)`, [visitorId, ts, ts]);
    await run(
      `INSERT INTO sessions (id, device_id, visitor_id, language, started_at) VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, deviceId ?? 'unknown', visitorId, language ?? 'vi', ts],
    );
    return ok({ sessionId });
  });

  /* 1. 언어 확정 */
  app.patch('/api/sessions/:id/language', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { language } = (req.body ?? {}) as { language?: string };
    if (!language) return reply.code(400).send(err('bad_request', 'language required'));
    const res = await run(`UPDATE sessions SET language=$1 WHERE id=$2`, [language, id]);
    if (res.rowCount === 0) return reply.code(404).send(err('not_found', 'session not found'));
    return ok({ language });
  });

  /* 1b. 동의 화면(또는 QR 스캔)에서 얻은 이름·성별·연령대·전화번호 저장 */
  app.patch('/api/sessions/:id/profile', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { fullName, gender, ageGroup, phone } = (req.body ?? {}) as {
      fullName?: string; gender?: 'male' | 'female' | 'other'; ageGroup?: string; phone?: string;
    };
    if (gender !== undefined && gender !== 'male' && gender !== 'female' && gender !== 'other')
      return reply.code(400).send(err('bad_request', 'gender must be male, female or other'));
    const res = await run(
      `UPDATE sessions SET full_name=$1, gender=$2, age_group=$3, phone=$4 WHERE id=$5`,
      [fullName?.trim() || null, gender ?? null, ageGroup ?? null, phone?.trim() || null, id],
    );
    if (res.rowCount === 0) return reply.code(404).send(err('not_found', 'session not found'));
    return ok({ fullName, gender, ageGroup, phone });
  });

  /* 1c. QR로 읽은 전화번호로 체크인 정보(이름·성별·생년월일) 조회 — 동의 화면 QR 스캔 전용 */
  app.get('/api/qr-lookup', async (req, reply) => {
    const { phone } = (req.query ?? {}) as { phone?: string };
    if (!phone || !PHONE_RE.test(phone.trim()))
      return reply.code(400).send(err('bad_request', 'phone must be 8-11 digits'));

    let json: PhoneLookupResponse;
    try {
      const url = new URL(PHONE_LOOKUP_URL);
      url.searchParams.set('phone', phone.trim());
      const res = await fetch(url.toString());
      if (!res.ok) return reply.code(502).send(err('lookup_failed', `upstream HTTP ${res.status}`));
      json = (await res.json()) as PhoneLookupResponse;
    } catch {
      return reply.code(502).send(err('lookup_failed', 'upstream unreachable'));
    }
    if (!json.ok || !json.data) return reply.code(404).send(err('not_found', 'no matching check-in for this phone'));

    const d = json.data;
    const fullName = (d.data?.full_name ?? d.name ?? '').trim();
    const gender = mapGender(d.data?.gender ?? d.gender);
    // 별도 컬럼을 늘리지 않고, 기존 age_group 컬럼에 생년월일 원본 문자열을 그대로 저장한다
    // (수동 입력 폼에서만 teen/twenties 같은 버킷 값이 들어간다 — QR 스캔 값과 포맷이 다르다).
    const ageGroup = d.data?.dob ?? d.dob ?? null;
    return ok({ fullName, gender, ageGroup, phone: phone.trim() });
  });

  /* 4. 게임 답변 */
  app.post('/api/sessions/:id/answers/:coreKey', async (req, reply) => {
    const { id, coreKey } = req.params as { id: string; coreKey: Axis };
    if (!AXES.includes(coreKey)) return reply.code(400).send(err('bad_request', `unknown coreKey ${coreKey}`));
    try {
      const result = SCORERS[coreKey](req.body as never);
      await run(
        `INSERT INTO answers (session_id, core_key, payload, score, subtype, answered_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id, core_key) DO UPDATE SET payload=excluded.payload, score=excluded.score, subtype=excluded.subtype, answered_at=excluded.answered_at`,
        [id, coreKey, JSON.stringify(req.body), result.score, result.subtype, now()],
      );
      return ok(result);
    } catch (e) {
      return reply.code(400).send(err('invalid_answer', (e as Error).message));
    }
  });

  /* 5. 완료: 스코어 확정 + 페르소나 + 토큰 + 이미지 잡 */
  app.post('/api/sessions/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = await one<SessionRow>(`SELECT * FROM sessions WHERE id=$1`, [id]);
    if (!session) return reply.code(404).send(err('not_found', 'session not found'));

    const answers = await many<{ core_key: Axis; score: number; subtype: string }>(
      `SELECT core_key, score, subtype FROM answers WHERE session_id=$1`, [id],
    );
    const scores = Object.fromEntries(AXES.map((a) => [a, 50])) as Scores;
    const subtypes: Record<string, string> = {};
    for (const a of answers) { scores[a.core_key] = a.score; subtypes[a.core_key] = a.subtype; }

    const { personaId, topAxes } = determinePersona(scores);

    const rows = await many<{ persona: string; n: string }>(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at LIKE $1 GROUP BY persona`,
      [`${todayPrefix()}%`],
    );
    const counts = Object.fromEntries(rows.map((r) => [r.persona, Number(r.n)]));
    counts[personaId] = (counts[personaId] ?? 0) + 1;
    const percentile = personaPercentile(counts, personaId);

    const existing = await one<{ token: string }>(`SELECT token FROM results WHERE session_id=$1`, [id]);
    const token = existing?.token ?? randomBytes(24).toString('base64url');
    const coupon = `AEPICK-${token.slice(0, 6).toUpperCase()}`;
    const brands = await recommendBrands(personaId, topAxes);
    const products = recommendProducts(brands);
    const expiresAt = new Date(Date.now() + RESULT_TTL_HOURS * 3600_000).toISOString();

    if (!existing) {
      await run(
        `INSERT INTO results (token, session_id, persona, scores, product_ids, coupon_code, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [token, id, personaId, JSON.stringify(scores), JSON.stringify(products.map((p) => p.id)), coupon, expiresAt],
      );
    }
    await run(
      `UPDATE sessions SET status='completed', scores=$1, subtypes=$2, persona=$3, completed_at=$4 WHERE id=$5`,
      [JSON.stringify(scores), JSON.stringify(subtypes), personaId, now(), id],
    );

    const base = PUBLIC_BASE || `${req.protocol}://${req.headers.host ?? `localhost:${process.env.PORT ?? 8787}`}`;
    const resultUrl = `${base}/r/${token}`;
    const qrPngUrl = await QRCode.toDataURL(resultUrl, { width: 480, margin: 1 });
    await run(`INSERT INTO events (session_id, type, ts) VALUES ($1, 'qr.issued', $2)`, [id, now()]);

    const brands_out = brands.map((b) => ({ id: b.id, name: b.name, tagline: b.tagline, emoji: b.emoji, logoUrl: b.logoUrl }));
    return ok({
      scores, persona: personaId, percentile, resultToken: token, qrPngUrl, resultUrl,
      brands: brands_out,
      products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, listPrice: p.listPrice, brandId: p.brandId })),
    });
  });

  /* 7. 오늘 통계 */
  app.get('/api/stats/today', async () => {
    const prefix = `${todayPrefix()}%`;
    const totalRow = await one<{ n: string }>(`SELECT COUNT(*) n FROM sessions WHERE status='completed' AND started_at LIKE $1`, [prefix]);
    const total = Number(totalRow?.n ?? 0);
    const top = await one<{ persona: PersonaId }>(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at LIKE $1 GROUP BY persona ORDER BY n DESC LIMIT 1`,
      [prefix],
    );

    const valueAnswers = await many<{ payload: string }>(`SELECT payload FROM answers WHERE core_key='value' AND answered_at LIKE $1`, [prefix]);
    const coinSum: Record<string, number> = {};
    for (const a of valueAnswers) {
      const coins = JSON.parse(a.payload).coins ?? {};
      for (const [k, v] of Object.entries(coins)) coinSum[k] = (coinSum[k] ?? 0) + Number(v);
    }
    const topCoinSlot = Object.entries(coinSum).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const trendAnswers = await many<{ payload: string }>(`SELECT payload FROM answers WHERE core_key='trend' AND answered_at LIKE $1`, [prefix]);
    const trendVotes: Record<string, Record<string, number>> = {};
    for (const a of trendAnswers) {
      const swipes = JSON.parse(a.payload).swipes ?? {};
      for (const [card, dir] of Object.entries(swipes)) {
        trendVotes[card] = trendVotes[card] ?? {};
        trendVotes[card][dir as string] = (trendVotes[card][dir as string] ?? 0) + 1;
      }
    }

    const trustAnswers = await many<{ payload: string }>(`SELECT payload FROM answers WHERE core_key='trust' AND answered_at LIKE $1`, [prefix]);
    const reviewVotes: Record<string, number> = {};
    for (const a of trustAnswers) {
      const picked = JSON.parse(a.payload).picked;
      if (picked) reviewVotes[picked] = (reviewVotes[picked] ?? 0) + 1;
    }

    return ok({ totalParticipants: total, topPersona: top?.persona ?? null, topCoinSlot, trendVotes, reviewVotes });
  });

  /* 8. 이벤트 배치 */
  app.post('/api/events', async (req) => {
    const { events } = (req.body ?? {}) as { events?: { type: string; sessionId?: string; payload?: object; ts?: string }[] };
    const deviceId = String(req.headers['x-device-id'] ?? 'unknown');
    for (const e of events ?? []) {
      await run(
        `INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, $3, $4, $5)`,
        [e.sessionId ?? null, deviceId, e.type, JSON.stringify(e.payload ?? {}), e.ts ?? now()],
      );
    }
    return ok({});
  });

  /* 10. 결과 데이터 (모바일 웹) */
  app.get('/api/results/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const row = await one<{
      session_id: string; persona: PersonaId; scores: string;
      product_ids: string; coupon_code: string; expires_at: string; deleted_at: string | null; scan_count: number;
    }>(`SELECT * FROM results WHERE token=$1`, [token]);
    if (!row || row.deleted_at) return reply.code(410).send(err('gone', 'result deleted'));
    if (new Date(row.expires_at) < new Date()) return reply.code(410).send(err('gone', 'result expired'));

    if (row.scan_count === 0) {
      await run(`INSERT INTO events (session_id, type, ts) VALUES ($1, 'result.scanned', $2)`, [row.session_id, now()]);
    }
    await run(`UPDATE results SET scan_count=scan_count+1 WHERE token=$1`, [token]);

    const session = await one<{ language: string; full_name: string | null }>(
      `SELECT language, full_name FROM sessions WHERE id=$1`, [row.session_id]);
    const scores = JSON.parse(row.scores) as Scores;
    const { topAxes } = determinePersona(scores);
    const recommended = await recommendBrands(row.persona, topAxes);
    const brands = recommended.map((b) => ({ id: b.id, name: b.name, tagline: b.tagline, emoji: b.emoji, logoUrl: b.logoUrl, products: b.products }));

    const byId = new Map<string, CatalogProduct>();
    for (const b of recommended) for (const p of b.products) byId.set(p.id, p);
    const ids = JSON.parse(row.product_ids) as string[];
    const products = ids.map((pid) => byId.get(pid)).filter(Boolean).map((p) => ({
      id: p!.id, name: p!.name, price: p!.price, listPrice: p!.listPrice, shopUrl: p!.shopUrl, imageUrl: p!.imageUrl, brandId: p!.brandId,
    }));

    return ok({
      persona: row.persona, language: session?.language ?? 'vi', fullName: session?.full_name ?? '',
      scores, products, brands, coupon: row.coupon_code, expiresAt: row.expires_at,
    });
  });

  /* 12. 즉시 삭제 */
  app.delete('/api/results/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const row = await one(`SELECT token FROM results WHERE token=$1 AND deleted_at IS NULL`, [token]);
    if (!row) return reply.code(404).send(err('not_found', 'not found'));
    await deleteResult(token);
    return ok({});
  });
}

export async function deleteResult(token: string) {
  await run(`UPDATE results SET deleted_at=$1 WHERE token=$2`, [now(), token]);
}

export function startExpiryScheduler() {
  const sweep = async () => {
    try {
      const expired = await many<{ token: string }>(`SELECT token FROM results WHERE deleted_at IS NULL AND expires_at < $1`, [now()]);
      for (const r of expired) await deleteResult(r.token);
      if (expired.length) console.log(`[expiry] deleted ${expired.length} expired results`);
    } catch (e) {
      console.error('[expiry] sweep failed', e);
    }
  };
  sweep();
  setInterval(sweep, 10 * 60 * 1000);
}
