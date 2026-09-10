import type { FastifyInstance } from 'fastify';
import { one, many, run, now } from './db.js';
import { listBrands } from './catalog.js';
import { votePageHtml, voteDonePageHtml } from './votePages.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

export const VOTE_PICK_COUNT = 3;

interface VoteRow {
  id: number; visitor_id: string; session_id: string | null; result_token: string | null;
  product_ids: string; voted_at: string; reward_claimed_at: string | null; reward_staff: string | null;
}

async function visitorOfToken(token: string): Promise<{ visitorId: string; sessionId: string } | undefined> {
  const row = await one<{ session_id: string; visitor_id: string | null }>(
    `SELECT r.session_id, s.visitor_id FROM results r JOIN sessions s ON s.id = r.session_id
     WHERE r.token=$1 AND r.deleted_at IS NULL`,
    [token],
  );
  if (!row?.visitor_id) return undefined;
  return { visitorId: row.visitor_id, sessionId: row.session_id };
}

export function registerVoteRoutes(app: FastifyInstance) {
  app.get('/api/vote/:token/options', async (req, reply) => {
    const { token } = req.params as { token: string };
    const who = await visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const existing = await one<VoteRow>(`SELECT * FROM votes WHERE visitor_id=$1`, [who.visitorId]);
    const brands = (await listBrands(true)).map((b) => ({
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

  app.post('/api/vote/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { productIds } = (req.body ?? {}) as { productIds?: string[] };
    const who = await visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    if (!Array.isArray(productIds) || productIds.length !== VOTE_PICK_COUNT)
      return reply.code(400).send(err('bad_request', `exactly ${VOTE_PICK_COUNT} products required`));
    if (new Set(productIds).size !== productIds.length)
      return reply.code(400).send(err('bad_request', 'duplicate product'));

    const valid = new Set((await listBrands(true)).flatMap((b) => b.products.map((p) => p.id)));
    if (productIds.some((id) => !valid.has(id)))
      return reply.code(400).send(err('bad_request', 'unknown product'));

    const ts = now();
    /*
     * 계정당 1회. UNIQUE(visitor_id) 위반을 잡는 대신 조건부 INSERT 로
     * 이미 투표한 경우를 명시적으로 구분한다.
     */
    const already = await one(`SELECT id FROM votes WHERE visitor_id=$1`, [who.visitorId]);
    if (already) return reply.code(409).send(err('already_voted', 'this account has already voted'));

    await run(
      `INSERT INTO votes (visitor_id, session_id, result_token, product_ids, voted_at) VALUES ($1, $2, $3, $4, $5)`,
      [who.visitorId, who.sessionId, token, JSON.stringify(productIds), ts],
    );
    await run(`INSERT INTO events (session_id, type, payload, ts) VALUES ($1, 'vote.submitted', $2, $3)`,
      [who.sessionId, JSON.stringify({ productIds }), ts]);

    return ok({ votedAt: ts });
  });

  app.get('/api/vote/:token/status', async (req, reply) => {
    const { token } = req.params as { token: string };
    const who = await visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const vote = await one<VoteRow>(`SELECT * FROM votes WHERE visitor_id=$1`, [who.visitorId]);
    if (!vote) return ok({ voted: false });

    const picked = JSON.parse(vote.product_ids) as string[];
    const all = await listBrands(false);
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

  app.post('/api/vote/:token/staff', async (req, reply) => {
    const { token } = req.params as { token: string };
    const { pin } = (req.body ?? {}) as { pin?: string };
    if (pin !== STAFF_PIN) return reply.code(401).send(err('unauthorized', 'invalid staff pin'));

    const who = await visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const v = await one<{ n: number }>(`SELECT visit_count n FROM visitors WHERE id=$1`, [who.visitorId]);
    const vote = await one<{ voted_at: string; reward_claimed_at: string | null }>(
      `SELECT voted_at, reward_claimed_at FROM votes WHERE visitor_id=$1`, [who.visitorId],
    );

    await run(`INSERT INTO events (session_id, type, ts) VALUES ($1, 'staff.lookup', $2)`, [who.sessionId, now()]);
    return ok({
      visitCount: v?.n ?? 1,
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

    const who = await visitorOfToken(token);
    if (!who) return reply.code(404).send(err('not_found', 'unknown result token'));

    const ts = now();
    const res = await run(
      `UPDATE votes SET reward_claimed_at=$1, reward_staff=$2 WHERE visitor_id=$3 AND reward_claimed_at IS NULL`,
      [ts, staff ?? '', who.visitorId],
    );
    if (res.rowCount === 0) {
      const v = await one<{ reward_claimed_at: string | null }>(`SELECT reward_claimed_at FROM votes WHERE visitor_id=$1`, [who.visitorId]);
      if (!v) return reply.code(409).send(err('not_voted', 'no vote for this account'));
      return reply.code(409).send(err('already_claimed', v.reward_claimed_at ?? ''));
    }
    await run(`INSERT INTO events (session_id, type, ts) VALUES ($1, 'reward.claimed', $2)`, [who.sessionId, now()]);
    return ok({ claimedAt: ts });
  });

  app.get('/v/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    return reply.type('text/html').send(votePageHtml(token));
  });
  app.get('/v/:token/done', async (req, reply) => {
    const { token } = req.params as { token: string };
    return reply.type('text/html').send(voteDonePageHtml(token));
  });
}

export const STAFF_PIN = process.env.STAFF_PIN ?? '1234';

export async function voteTally(): Promise<{ productId: string; n: number }[]> {
  const rows = await many<{ product_ids: string }>(`SELECT product_ids FROM votes`);
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const id of JSON.parse(r.product_ids) as string[]) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()].map(([productId, n]) => ({ productId, n })).sort((a, b) => b.n - a.n);
}
