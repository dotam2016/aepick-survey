import type { FastifyInstance } from 'fastify';
import { db, now } from './db.js';
import { ADMIN_KEY } from './adminKey.js';
import { listBrands } from './catalog.js';
import { votePageHtml, voteDonePageHtml } from './votePages.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

/** 스펙 9번: 소비자는 3개의 제품에 투표한다. */
export const VOTE_PICK_COUNT = 3;

interface ResultRow {
  token: string; session_id: string; deleted_at: string | null; expires_at: string;
}
interface VoteRow {
  id: number; visitor_id: string; session_id: string | null; result_token: string | null;
  product_ids: string; voted_at: string; reward_claimed_at: string | null; reward_staff: string | null;
}

/** 결과 토큰 → 방문자. 투표는 체험한 본인 계정에 귀속된다. */
function visitorOfToken(token: string): { visitorId: string; sessionId: string } | undefined {
  const row = db.prepare(
    `SELECT r.session_id, s.visitor_id FROM results r JOIN sessions s ON s.id = r.session_id
     WHERE r.token=? AND r.deleted_at IS NULL`,
  ).get(token) as { session_id: string; visitor_id: string | null } | undefined;
  if (!row?.visitor_id) return undefined;
  return { visitorId: row.visitor_id, sessionId: row.session_id };
}

export function registerVoteRoutes(app: FastifyInstance) {
  /* ── 투표 대상: 팝업 운영 브랜드 전체와 그 제품 ── */
  app.get('/api/vote/:token/options', async (req, reply) => {
    const { token } = req.params as { token: string };
    const who = visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const existing = db.prepare(`SELECT * FROM votes WHERE visitor_id=?`).get(who.visitorId) as VoteRow | undefined;
    const brands = listBrands(true).map((b) => ({
      id: b.id, name: b.name, emoji: b.emoji, logoUrl: b.logoUrl,
      tagline: b.tagline,
      products: b.products.map((p) => ({ id: p.id, name: p.name, price: p.price, imageUrl: p.imageUrl })),
    }));
    return ok({
      pickCount: VOTE_PICK_COUNT,
      brands,
      alreadyVoted: !!existing,
      picked: existing ? (JSON.parse(existing.product_ids) as string[]) : [],
    });
  });

  /* ── 투표 제출 ── */
  app.post('/api/vote/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { productIds } = (req.body ?? {}) as { productIds?: string[] };
    const who = visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    if (!Array.isArray(productIds) || productIds.length !== VOTE_PICK_COUNT)
      return reply.code(400).send(err('bad_request', `exactly ${VOTE_PICK_COUNT} products required`));
    if (new Set(productIds).size !== productIds.length)
      return reply.code(400).send(err('bad_request', 'duplicate product'));

    // 실제 카탈로그에 있는 제품인지 확인 (임의 id 주입 방지)
    const valid = new Set(listBrands(true).flatMap((b) => b.products.map((p) => p.id)));
    if (productIds.some((id) => !valid.has(id)))
      return reply.code(400).send(err('bad_request', 'unknown product'));

    const ts = now();
    /*
     * 계정당 1회. UNIQUE(visitor_id) 위반을 잡는 대신 조건부 INSERT 로
     * 이미 투표한 경우를 명시적으로 구분한다.
     */
    const already = db.prepare(`SELECT id FROM votes WHERE visitor_id=?`).get(who.visitorId);
    if (already) return reply.code(409).send(err('already_voted', 'this account has already voted'));

    db.prepare(
      `INSERT INTO votes (visitor_id, session_id, result_token, product_ids, voted_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(who.visitorId, who.sessionId, token, JSON.stringify(productIds), ts);
    db.prepare(`INSERT INTO events (session_id, type, payload, ts) VALUES (?, 'vote.submitted', ?, ?)`)
      .run(who.sessionId, JSON.stringify({ productIds }), ts);

    return ok({ votedAt: ts });
  });

  /* ── 투표 완료 상태 (완료 페이지에서 조회) ── */
  app.get('/api/vote/:token/status', async (req, reply) => {
    const { token } = req.params as { token: string };
    const who = visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const vote = db.prepare(`SELECT * FROM votes WHERE visitor_id=?`).get(who.visitorId) as VoteRow | undefined;
    if (!vote) return ok({ voted: false });

    const picked = JSON.parse(vote.product_ids) as string[];
    const all = listBrands(false);
    const byId = new Map(all.flatMap((b) => b.products.map((p) => [p.id, { p, b }] as const)));
    return ok({
      voted: true,
      votedAt: vote.voted_at,
      rewardClaimedAt: vote.reward_claimed_at,
      picks: picked.map((id) => {
        const hit = byId.get(id);
        return hit ? { id, name: hit.p.name, brand: hit.b.name, emoji: hit.b.emoji } : { id, name: {}, brand: '', emoji: '' };
      }),
    });
  });

  /*
   * ── 직원 전용: 재방문 횟수 (스펙 10번) ──
   * 고객에게 노출되면 안 되는 정보라 별도 인증을 요구한다.
   * 완료 페이지의 히든 UI가 직원 PIN과 함께 호출한다.
   */
  app.post('/api/vote/:token/staff', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { pin } = (req.body ?? {}) as { pin?: string };
    if (pin !== STAFF_PIN) return reply.code(401).send(err('unauthorized', 'invalid staff pin'));

    const who = visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const v = db.prepare(`SELECT visit_count n FROM visitors WHERE id=?`).get(who.visitorId) as { n: number } | undefined;
    const vote = db.prepare(`SELECT voted_at, reward_claimed_at FROM votes WHERE visitor_id=?`)
      .get(who.visitorId) as { voted_at: string; reward_claimed_at: string | null } | undefined;

    db.prepare(`INSERT INTO events (session_id, type, ts) VALUES (?, 'staff.lookup', ?)`).run(who.sessionId, now());
    return ok({
      visitCount: v?.n ?? 1,          // 첫 방문은 1
      voted: !!vote,
      votedAt: vote?.voted_at ?? null,
      rewardClaimedAt: vote?.reward_claimed_at ?? null,
    });
  });

  /*
   * ── 직원 전용: 사은품 지급 처리 ──
   * 중복 수령 방지 방식은 운영팀 미결 사항이다. 지금은 '지급함' 시각만
   * 남겨 두고, 이미 지급된 건은 409로 알린다. 방식이 정해지면 여기에 붙인다.
   */
  app.post('/api/vote/:token/reward', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { pin, staff } = (req.body ?? {}) as { pin?: string; staff?: string };
    if (pin !== STAFF_PIN) return reply.code(401).send(err('unauthorized', 'invalid staff pin'));

    const who = visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const ts = now();
    const res = db.prepare(
      `UPDATE votes SET reward_claimed_at=?, reward_staff=? WHERE visitor_id=? AND reward_claimed_at IS NULL`,
    ).run(ts, staff ?? '', who.visitorId);
    if (res.changes === 0) {
      const v = db.prepare(`SELECT reward_claimed_at FROM votes WHERE visitor_id=?`)
        .get(who.visitorId) as { reward_claimed_at: string | null } | undefined;
      if (!v) return reply.code(409).send(err('not_voted', 'no vote for this account'));
      return reply.code(409).send(err('already_claimed', v.reward_claimed_at ?? ''));
    }
    db.prepare(`INSERT INTO events (session_id, type, ts) VALUES (?, 'reward.claimed', ?)`).run(who.sessionId, now());
    return ok({ claimedAt: ts });
  });

  /* ── 페이지 ── */
  app.get('/v/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    return reply.type('text/html').send(votePageHtml(token));
  });
  app.get('/v/:token/done', async (req, reply) => {
    const { token } = req.params as { token: string };
    return reply.type('text/html').send(voteDonePageHtml(token));
  });
}

/**
 * 직원 PIN. 지정하지 않으면 기본값을 쓴다.
 * 현장 배포 시 STAFF_PIN 환경변수로 반드시 바꿔야 한다.
 */
export const STAFF_PIN = process.env.STAFF_PIN ?? '1234';

/** 투표 집계 (어드민 대시보드용) */
export function voteTally(): { productId: string; n: number }[] {
  const rows = db.prepare(`SELECT product_ids FROM votes`).all() as { product_ids: string }[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const id of JSON.parse(r.product_ids) as string[]) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([productId, n]) => ({ productId, n })).sort((a, b) => b.n - a.n);
}
