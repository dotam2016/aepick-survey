# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local `node:sqlite` file database with a hosted Supabase Postgres database, add `full_name` / `gender` / `age_group` to the session record (captured on the pre-survey consent screen), and add an Excel export for the admin dashboard — with every existing admin/kiosk/vote/pairing feature working exactly as before, just against Postgres.

**Architecture:** Supabase is used purely as **hosted Postgres** — the server connects with the `pg` driver using the project's Postgres connection string (`SUPABASE_DB_URL`), not the `supabase-js` REST client. This is a deliberate choice: the codebase already does hand-written SQL (joins, `GROUP BY`, aggregates) via `node:sqlite`'s `db.prepare(sql).get/all/run()`. Keeping raw SQL and swapping only the driver is a mechanical, low-risk port; rewriting every query into the `supabase-js` query-builder would mean re-deriving several aggregate queries as Postgres functions for no benefit here. Every `db.prepare(sql).get(...)` becomes `await one(sql, [...])`, `.all(...)` becomes `await many(sql, [...])`, `.run(...)` becomes `await run(sql, [...])` — same call shape, now async.

**Tech Stack:** Fastify 5, TypeScript, `pg` (node-postgres), Supabase (hosted Postgres only), `exceljs` (Excel export), `dotenv` (env loading), Vitest (existing test runner).

**Spec:** This plan itself is the spec — captured from conversation: (1) keep every current feature working, (2) add `full_name`/`gender`/`age_group` to the session record (already collected client-side on the consent screen per `apps/kiosk/src/screens/flow.tsx`'s `ConsentScreen`), (3) move storage from local SQLite to Supabase Postgres, (4) add an Excel download for admin. No separate spec doc exists elsewhere.

## Global Constraints

- Every existing admin endpoint (`/api/admin/overview`, `/api/admin/analytics`, `/api/admin/sessions`, `/api/admin/devices/:id/heartbeat`) must return the same shape as today, unchanged, except `sessions` gains `full_name`/`gender`/`age_group`.
- Every existing kiosk/pairing/vote/catalog endpoint must keep its current request/response contract — this is a storage-layer swap, not an API redesign.
- No `supabase-js` dependency — use `pg` directly against `SUPABASE_DB_URL`.
- No new abstraction beyond a thin `one/many/run` query helper — do not introduce an ORM.
- `ADMIN_KEY` auth (header `X-Admin-Key`) stays exactly as-is; Supabase adds no new auth layer for this server-to-Postgres connection (it's a normal Postgres password connection).
- Node 22+ (already required by `START-DEMO.bat`).

---

## Before you start

1. Create a free Supabase project at https://supabase.com/dashboard (any region close to Vietnam, e.g. Singapore).
2. In the project: **Project Settings → Database → Connection string → URI**. Copy the **Transaction pooler** string (port `6543`) — it's the one meant for a long-running server process making many short queries. It looks like:
   `postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
3. Replace `[YOUR-PASSWORD]` with the database password you set when creating the project (Project Settings → Database → reset if forgotten).
4. Keep this string handy — Task 1 uses it to apply the schema, Task 10 puts it in `.env`.

---

### Task 1: Supabase schema

**Files:**
- Create: `server/sql/schema.sql`

**Interfaces:**
- Produces: every table/column every later task's SQL depends on, including the three new `sessions` columns: `full_name text`, `gender text`, `age_group text`.

- [ ] **Step 1: Write the schema file**

```sql
-- AEPICK BEAUTY DNA — Supabase (Postgres) schema
-- Run once in the Supabase SQL Editor (Project -> SQL Editor -> New query -> paste -> Run)
-- against a fresh project. Safe to re-run (everything is IF NOT EXISTS).

create table if not exists sessions (
  id text primary key,
  device_id text not null,
  visitor_id text,
  language text not null default 'vi',
  status text not null default 'active',
  consents text,
  scores text,
  subtypes text,
  persona text,
  full_name text,
  gender text check (gender in ('male', 'female')),
  age_group text,
  started_at text not null,
  completed_at text
);

create table if not exists answers (
  id bigint generated always as identity primary key,
  session_id text not null,
  core_key text not null,
  payload text not null,
  score integer not null,
  subtype text not null,
  answered_at text not null,
  unique (session_id, core_key)
);

create table if not exists results (
  token text primary key,
  session_id text not null unique,
  persona text not null,
  scores text not null,
  product_ids text,
  coupon_code text,
  expires_at text not null,
  deleted_at text,
  scan_count integer not null default 0,
  download_count integer not null default 0
);

create table if not exists events (
  id bigint generated always as identity primary key,
  session_id text,
  device_id text,
  type text not null,
  payload text,
  ts text not null
);

create table if not exists devices (
  id text primary key,
  name text,
  last_heartbeat text,
  app_version text,
  state text
);

create table if not exists visitors (
  id text primary key,
  visit_count integer not null default 0,
  first_seen_at text not null,
  last_seen_at text not null
);

create table if not exists pairings (
  code text primary key,
  device_id text not null,
  status text not null default 'pending',
  visitor_id text,
  session_id text,
  created_at text not null,
  expires_at text not null,
  claimed_at text
);
create index if not exists idx_pairings_device on pairings (device_id, status);

create table if not exists brands (
  id text primary key,
  name text not null,
  tagline text,
  emoji text,
  logo_url text,
  persona_tags text,
  axis_affinity text,
  sort_order integer not null default 0,
  active smallint not null default 1,
  updated_at text not null
);

create table if not exists brand_products (
  id text primary key,
  brand_id text not null,
  name text not null,
  price text,
  shop_url text,
  image_url text,
  sort_order integer not null default 0,
  active smallint not null default 1,
  updated_at text not null
);
create index if not exists idx_products_brand on brand_products (brand_id, sort_order);

create table if not exists votes (
  id bigint generated always as identity primary key,
  visitor_id text not null unique,
  session_id text,
  result_token text,
  product_ids text not null,
  voted_at text not null,
  reward_claimed_at text,
  reward_staff text
);

create index if not exists idx_events_type_ts on events (type, ts);
create index if not exists idx_sessions_started on sessions (started_at);

-- Re-running this file against a project that already has `sessions`
-- without the profile columns (e.g. you applied an older copy) adds them:
alter table sessions add column if not exists full_name text;
alter table sessions add column if not exists gender text check (gender in ('male', 'female'));
alter table sessions add column if not exists age_group text;
```

- [ ] **Step 2: Apply it**

Paste the file into Supabase → SQL Editor → New query → Run.

- [ ] **Step 3: Verify**

In the same SQL Editor, run:

```sql
select table_name from information_schema.tables where table_schema = 'public' order by 1;
```

Expected: `answers, brand_products, brands, devices, events, pairings, results, sessions, visitors, votes` (10 rows).

```sql
select column_name from information_schema.columns where table_name = 'sessions' order by 1;
```

Expected: includes `full_name`, `gender`, `age_group`.

- [ ] **Step 4: Commit**

```bash
git add server/sql/schema.sql
git commit -m "chore(db): add Supabase Postgres schema"
```

---

### Task 2: Postgres client (`server/src/db.ts`)

**Files:**
- Modify: `server/src/db.ts` (full rewrite)
- Modify: `server/package.json` (add `pg`, `@types/pg`)
- Create: `server/test/db.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_DB_URL` env var (Task 10 documents/sets it; for this task, export it in your shell before running the test).
- Produces: `one<T>(sql, params?)`, `many<T>(sql, params?)`, `run(sql, params?): Promise<{rowCount:number}>`, `now()`, `todayPrefix()`, `DATA_DIR` (unchanged — still used by `index.ts` for static file serving, unrelated to the DB swap). Every later task imports from here. **Note:** `server/test/helpers.ts` is Task 3's deliverable, not this task's — Task 2's own test only needs `one`, no Fastify app fixture.
- The connection is created lazily (on first query), not at module load — importing `db.js` with `SUPABASE_DB_URL` unset must NOT throw. It only throws when a query actually runs with no connection string. This matters because every test file across every later task does a static `import ... from '../src/db.js'` (directly or via `helpers.ts`), and those files must load cleanly under `describe.skipIf(!process.env.SUPABASE_DB_URL)` even when the var is unset — a module-load-time throw would crash the whole test file before the skip logic ever runs.

- [ ] **Step 1: Add dependencies**

In `server/package.json`, add to `dependencies`:

```json
"pg": "^8.13.0",
```

and to `devDependencies`:

```json
"@types/pg": "^8.11.0",
```

Run:

```bash
npm install
```

- [ ] **Step 2: Write the failing test**

```typescript
// server/test/db.test.ts
import { describe, it, expect } from 'vitest';
import { one } from '../src/db.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('db connectivity', () => {
  it('can query Postgres through the pool', async () => {
    const row = await one<{ ok: number }>('select 1 as ok');
    expect(row?.ok).toBe(1);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/db.test.ts
```

Expected: FAIL — `db.ts` still exports `db`/`DatabaseSync`, not `one`.

- [ ] **Step 4: Rewrite `server/src/db.ts`**

```typescript
import { Pool } from 'pg';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Still used by index.ts to serve designer-dropped static assets (logos, product images) — unrelated to the DB. */
export const DATA_DIR = path.resolve(__dirname, '../data');
mkdirSync(DATA_DIR, { recursive: true });

/*
 * Lazy on purpose: this module is statically imported by every test file
 * (directly or via test/helpers.ts), including ones that skip their own
 * body with describe.skipIf(!process.env.SUPABASE_DB_URL) when the var is
 * unset. A throw here at import time would crash those files before the
 * skip logic ever runs. Throwing only when a query actually executes keeps
 * "skip cleanly with no SUPABASE_DB_URL" true, while the real server still
 * fails fast in practice — index.ts's first startup action (seeding the
 * catalog) issues a query immediately.
 */
let _pool: Pool | undefined;
function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'SUPABASE_DB_URL is not set. Copy .env.example to .env and paste the connection string from ' +
      'Supabase -> Project Settings -> Database -> Connection string (URI, Transaction pooler).',
    );
  }
  _pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return _pool;
}

export async function one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const { rows } = await getPool().query(sql, params);
  return rows[0] as T | undefined;
}

export async function many<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(sql, params);
  return rows as T[];
}

export async function run(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
  const res = await getPool().query(sql, params);
  return { rowCount: res.rowCount ?? 0 };
}

export const now = () => new Date().toISOString();
export const todayPrefix = () => new Date().toISOString().slice(0, 10);
```

Note: nothing outside this file needs the raw `Pool` — every consumer across every later task goes through `one/many/run`. Do not export `pool`.

- [ ] **Step 5: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/db.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/db.ts server/package.json server/test/db.test.ts package-lock.json
git commit -m "feat(db): replace node:sqlite with a Postgres pool (Supabase)"
```

---

### Task 3: Core session/game flow + profile endpoint (`server/src/routes.ts`)

**Files:**
- Modify: `server/src/routes.ts` (full rewrite)
- Create: `server/test/helpers.ts`
- Create: `server/test/routes.test.ts`

**Interfaces:**
- Consumes: `one/many/run/now/todayPrefix` from `./db.js` (Task 2); `recommendBrands`/`recommendProducts` from `./catalog.js`. **`recommendBrands` becomes `async` in Task 5** (it will call the now-async `listBrands`) — use `await recommendBrands(...)` at both call sites below regardless of task order. This is safe even before Task 5 lands: `await` on a value that isn't yet a `Promise` just resolves to that value immediately (no compile error, no behavior change) — so writing `await` now and having Task 5 make the callee actually async later requires no follow-up edit.
- Produces: `registerRoutes(app)`, `deleteResult(token)` (now async), `startExpiryScheduler()`. New: `PATCH /api/sessions/:id/profile` accepting `{ fullName?, gender?, ageGroup? }`.
- `server/test/helpers.ts` does not need `dotenv` — every command in this plan that runs these tests passes `SUPABASE_DB_URL` inline on the command line (see Step 3 below), so there's nothing for `dotenv` to load. Don't import it here; it isn't a dependency yet (Task 10 adds it, for `index.ts` and `tools/seed-demo.mjs`, which run as standalone processes with no inline env var).

- [ ] **Step 1: Write `server/test/helpers.ts`** (shared by this and every later route test)

```typescript
// server/test/helpers.ts
import Fastify from 'fastify';
import { registerRoutes } from '../src/routes.js';
import { registerPairingRoutes } from '../src/pairingRoutes.js';
import { registerCatalogRoutes } from '../src/catalogRoutes.js';
import { registerVoteRoutes } from '../src/voteRoutes.js';
import { registerAdminRoutes } from '../src/adminRoutes.js';

/** Fastify instance wired the same way index.ts wires it, minus HTTPS/static — for app.inject() tests. */
export function buildTestApp() {
  const app = Fastify({ logger: false });
  registerRoutes(app);
  registerPairingRoutes(app);
  registerCatalogRoutes(app);
  registerVoteRoutes(app);
  registerAdminRoutes(app);
  return app;
}
```

Note: these tests run against whatever `SUPABASE_DB_URL` points at (your real dev project) and write real rows. Point it at a dev/staging Supabase project, not one holding real customer data, while you're developing.

- [ ] **Step 2: Write the failing test**

```typescript
// server/test/routes.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { one } from '../src/db.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('session + profile flow', () => {
  it('creates a session and saves the consent-screen profile fields', async () => {
    const app = buildTestApp();

    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD', language: 'vi' } });
    expect(created.statusCode).toBe(200);
    const { sessionId } = created.json().data as { sessionId: string };
    expect(sessionId).toBeTruthy();

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/profile`,
      payload: { fullName: 'Nguyen Van A', gender: 'male', ageGroup: 'twenties' },
    });
    expect(patched.statusCode).toBe(200);

    const row = await one<{ full_name: string; gender: string; age_group: string }>(
      'select full_name, gender, age_group from sessions where id = $1',
      [sessionId],
    );
    expect(row).toEqual({ full_name: 'Nguyen Van A', gender: 'male', age_group: 'twenties' });

    await app.close();
  });

  it('rejects an invalid gender value', async () => {
    const app = buildTestApp();
    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD', language: 'vi' } });
    const { sessionId } = created.json().data as { sessionId: string };

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/profile`,
      payload: { gender: 'unknown' },
    });
    expect(patched.statusCode).toBe(400);

    await app.close();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/routes.test.ts
```

Expected: FAIL — `routes.ts` still uses the old sync `db.prepare(...)` API against `node:sqlite`, and there's no `/profile` route yet.

- [ ] **Step 4: Rewrite `server/src/routes.ts`**

```typescript
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
  /* 0. 세션 생성 (익명) */
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

  /* 1b. 동의 화면에서 입력한 이름·성별·연령대 저장 */
  app.patch('/api/sessions/:id/profile', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { fullName, gender, ageGroup } = (req.body ?? {}) as {
      fullName?: string; gender?: 'male' | 'female'; ageGroup?: string;
    };
    if (gender !== undefined && gender !== 'male' && gender !== 'female')
      return reply.code(400).send(err('bad_request', 'gender must be male or female'));
    const res = await run(
      `UPDATE sessions SET full_name=$1, gender=$2, age_group=$3 WHERE id=$4`,
      [fullName?.trim() || null, gender ?? null, ageGroup ?? null, id],
    );
    if (res.rowCount === 0) return reply.code(404).send(err('not_found', 'session not found'));
    return ok({ fullName, gender, ageGroup });
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
      products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, brandId: p.brandId })),
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

    const session = await one<{ language: string }>(`SELECT language FROM sessions WHERE id=$1`, [row.session_id]);
    const scores = JSON.parse(row.scores) as Scores;
    const { topAxes } = determinePersona(scores);
    const recommended = await recommendBrands(row.persona, topAxes);
    const brands = recommended.map((b) => ({ id: b.id, name: b.name, tagline: b.tagline, emoji: b.emoji, logoUrl: b.logoUrl, products: b.products }));

    const byId = new Map<string, CatalogProduct>();
    for (const b of recommended) for (const p of b.products) byId.set(p.id, p);
    const ids = JSON.parse(row.product_ids) as string[];
    const products = ids.map((pid) => byId.get(pid)).filter(Boolean).map((p) => ({
      id: p!.id, name: p!.name, price: p!.price, shopUrl: p!.shopUrl, imageUrl: p!.imageUrl, brandId: p!.brandId,
    }));

    return ok({ persona: row.persona, language: session?.language ?? 'vi', scores, products, brands, coupon: row.coupon_code, expiresAt: row.expires_at });
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
    const expired = await many<{ token: string }>(`SELECT token FROM results WHERE deleted_at IS NULL AND expires_at < $1`, [now()]);
    for (const r of expired) await deleteResult(r.token);
    if (expired.length) console.log(`[expiry] deleted ${expired.length} expired results`);
  };
  sweep();
  setInterval(sweep, 10 * 60 * 1000);
}
```

- [ ] **Step 5: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/routes.test.ts
```

Expected: PASS (2 tests). Note: this file imports `catalog.js` — it won't type-check cleanly until Task 5 makes `recommendBrands` async. That's fine; do Tasks 3 and 5 in the same sitting if running `tsc` in between bothers you.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.ts server/test/helpers.ts server/test/routes.test.ts
git commit -m "feat(routes): port session/game routes to Postgres, add profile endpoint"
```

---

### Task 4: Pairing (`server/src/pairing.ts`, `server/src/pairingRoutes.ts`)

**Files:**
- Modify: `server/src/pairing.ts` (full rewrite)
- Modify: `server/src/pairingRoutes.ts` (full rewrite)
- Create: `server/test/pairing.test.ts`

**Interfaces:**
- Consumes: `one/many/run/now` from `./db.js`.
- Produces: `issuePairing`, `getPairing`, `claimPairing`, `cancelPairings`, `sweepExpiredPairings` — all now `async`/return `Promise`. `registerPairingRoutes(app)`, `startPairingSweeper()` unchanged in shape, internals awaited.

- [ ] **Step 1: Write the failing test**

```typescript
// server/test/pairing.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('pairing flow', () => {
  it('issues a code, claims it, and the PAD sees it claimed', async () => {
    const app = buildTestApp();

    const issued = await app.inject({ method: 'POST', url: '/api/pairings', payload: { deviceId: 'TEST-PAD-2' } });
    expect(issued.statusCode).toBe(200);
    const { code } = issued.json().data as { code: string };

    const claimed = await app.inject({
      method: 'POST',
      url: `/api/pairings/${code}/claim`,
      payload: { credential: 'test-user-1', language: 'vi' },
    });
    expect(claimed.statusCode).toBe(200);
    expect(claimed.json().data.sessionId).toBeTruthy();

    const polled = await app.inject({ method: 'GET', url: `/api/pairings/${code}` });
    expect(polled.json().data.status).toBe('claimed');

    await app.close();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/pairing.test.ts
```

Expected: FAIL — still synchronous `node:sqlite` calls.

- [ ] **Step 3: Rewrite `server/src/pairing.ts`**

```typescript
import { randomBytes, randomUUID } from 'node:crypto';
import { one, run, now } from './db.js';
import { visitorIdOf, type AppIdentity } from './identity.js';

export const PAIRING_TTL_MS = 8 * 60 * 1000;
export type PairingStatus = 'pending' | 'claimed' | 'expired';

export interface PairingRow {
  code: string;
  device_id: string;
  status: PairingStatus;
  visitor_id: string | null;
  session_id: string | null;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
}

const newCode = () => randomBytes(9).toString('base64url');

export async function issuePairing(deviceId: string): Promise<PairingRow> {
  const ts = now();
  await run(`UPDATE pairings SET status='expired' WHERE device_id=$1 AND status='pending'`, [deviceId]);

  const code = newCode();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  await run(
    `INSERT INTO pairings (code, device_id, status, created_at, expires_at) VALUES ($1, $2, 'pending', $3, $4)`,
    [code, deviceId, ts, expiresAt],
  );

  await run(`INSERT INTO events (device_id, type, ts) VALUES ($1, 'pairing.issued', $2)`, [deviceId, ts]);
  return (await getPairing(code))!;
}

export async function getPairing(code: string): Promise<PairingRow | undefined> {
  const row = await one<PairingRow>(`SELECT * FROM pairings WHERE code=$1`, [code]);
  if (!row) return undefined;
  if (row.status === 'pending' && row.expires_at <= now()) {
    await run(`UPDATE pairings SET status='expired' WHERE code=$1 AND status='pending'`, [code]);
    return { ...row, status: 'expired' };
  }
  return row;
}

export interface ClaimResult {
  ok: boolean;
  reason?: 'not_found' | 'expired' | 'already_claimed';
  sessionId?: string;
  visitorId?: string;
  visitCount?: number;
}

export async function claimPairing(code: string, identity: AppIdentity, fallbackLang = 'vi'): Promise<ClaimResult> {
  const pairing = await getPairing(code);
  if (!pairing) return { ok: false, reason: 'not_found' };
  if (pairing.status === 'claimed') return { ok: false, reason: 'already_claimed' };
  if (pairing.status === 'expired') return { ok: false, reason: 'expired' };

  const ts = now();
  const visitorId = visitorIdOf(identity.appUserId);
  const sessionId = randomUUID();

  /*
   * Winner decided by the conditional UPDATE below — Postgres serves many
   * connections concurrently, so a simultaneous claim only ever flips one
   * row from status='pending'.
   */
  const res = await run(
    `UPDATE pairings SET status='claimed', visitor_id=$1, session_id=$2, claimed_at=$3 WHERE code=$4 AND status='pending'`,
    [visitorId, sessionId, ts, code],
  );
  if (res.rowCount === 0) return { ok: false, reason: 'already_claimed' };

  await run(
    `INSERT INTO visitors (id, visit_count, first_seen_at, last_seen_at) VALUES ($1, 1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET visit_count = visit_count + 1, last_seen_at = excluded.last_seen_at`,
    [visitorId, ts, ts],
  );
  const visitor = await one<{ n: number }>(`SELECT visit_count n FROM visitors WHERE id=$1`, [visitorId]);
  const visitCount = visitor?.n ?? 1;

  await run(
    `INSERT INTO sessions (id, device_id, visitor_id, language, status, started_at) VALUES ($1, $2, $3, $4, 'active', $5)`,
    [sessionId, pairing.device_id, visitorId, identity.language ?? fallbackLang, ts],
  );

  await run(
    `INSERT INTO events (session_id, device_id, type, payload, ts) VALUES ($1, $2, 'pairing.claimed', $3, $4)`,
    [sessionId, pairing.device_id, JSON.stringify({ visitCount }), ts],
  );

  return { ok: true, sessionId, visitorId, visitCount };
}

export async function cancelPairings(deviceId: string): Promise<number> {
  const res = await run(`UPDATE pairings SET status='expired' WHERE device_id=$1 AND status='pending'`, [deviceId]);
  return res.rowCount;
}

export async function sweepExpiredPairings(): Promise<number> {
  const res = await run(`UPDATE pairings SET status='expired' WHERE status='pending' AND expires_at <= $1`, [now()]);
  return res.rowCount;
}
```

- [ ] **Step 4: Rewrite `server/src/pairingRoutes.ts`**

Only the top imports and the DB call sites change; `pairingPageHtml` (the whole HTML/client-JS template at the bottom of the file) is untouched — copy it verbatim from the current file.

```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { one, run, now } from './db.js';
import { identityProvider, isIdentityMocked } from './identity.js';
import { dicts } from './i18nDicts.js';
import { cancelPairings, claimPairing, getPairing, issuePairing, sweepExpiredPairings } from './pairing.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? '';

function baseUrlOf(req: FastifyRequest): string {
  if (PUBLIC_BASE) return PUBLIC_BASE;
  return `${req.protocol}://${req.headers.host ?? `localhost:${process.env.PORT ?? 8787}`}`;
}

export function registerPairingRoutes(app: FastifyInstance) {
  app.post('/api/pairings', async (req) => {
    const { deviceId } = (req.body ?? {}) as { deviceId?: string };
    const device = deviceId?.trim() || 'unknown';
    const pairing = await issuePairing(device);
    const url = `${baseUrlOf(req)}/p/${pairing.code}`;
    const qrPngUrl = await QRCode.toDataURL(url, { width: 480, margin: 1 });
    return ok({ code: pairing.code, url, qrPngUrl, expiresAt: pairing.expires_at, mocked: isIdentityMocked });
  });

  app.get('/api/pairings/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const pairing = await getPairing(code);
    if (!pairing) return reply.code(404).send(err('not_found', 'unknown pairing code'));

    if (pairing.status !== 'claimed') {
      return ok({ status: pairing.status, expiresAt: pairing.expires_at });
    }
    const visitor = await one<{ n: number }>(`SELECT visit_count n FROM visitors WHERE id=$1`, [pairing.visitor_id!]);
    const session = await one<{ language: string }>(`SELECT language FROM sessions WHERE id=$1`, [pairing.session_id!]);
    return ok({ status: 'claimed', sessionId: pairing.session_id, language: session?.language, visitCount: visitor?.n ?? 1 });
  });

  app.post('/api/pairings/:code/claim', async (req, reply) => {
    const { code } = req.params as { code: string };
    const { credential, language } = (req.body ?? {}) as { credential?: string; language?: string };
    if (!credential) return reply.code(400).send(err('bad_request', 'credential required'));

    const identity = await identityProvider.resolve(credential);
    if (!identity) return reply.code(401).send(err('unauthorized', 'could not verify app account'));

    const result = await claimPairing(code, identity, language ?? 'vi');
    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : 409;
      return reply.code(status).send(err(result.reason!, `pairing ${result.reason}`));
    }
    return ok({ sessionId: result.sessionId, visitCount: result.visitCount });
  });

  app.post('/api/pairings/cancel', async (req) => {
    const { deviceId } = (req.body ?? {}) as { deviceId?: string };
    const cancelled = await cancelPairings(deviceId?.trim() || 'unknown');
    return ok({ cancelled });
  });

  app.get('/p/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    return reply.type('text/html').send(pairingPageHtml(code));
  });
}

export function startPairingSweeper() {
  setInterval(async () => {
    const n = await sweepExpiredPairings();
    if (n > 0) {
      await run(`INSERT INTO events (type, payload, ts) VALUES ('pairing.swept', $1, $2)`, [JSON.stringify({ n }), now()]);
    }
  }, 60_000).unref();
}

function pairingPageHtml(code: string): string {
  // unchanged — copy verbatim from the current server/src/pairingRoutes.ts
  // (pure HTML + client-side <script>, no server-side DB calls in this function)
  return '';
}
```

- [ ] **Step 5: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/pairing.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/pairing.ts server/src/pairingRoutes.ts server/test/pairing.test.ts
git commit -m "feat(pairing): port pairing flow to Postgres"
```

---

### Task 5: Catalog (`server/src/catalog.ts`, `server/src/catalogRoutes.ts`, `server/src/catalogSeed.ts`)

**Files:**
- Modify: `server/src/catalog.ts` (full rewrite)
- Modify: `server/src/catalogRoutes.ts` (only DB call sites — `catalogPageHtml()` stays verbatim)
- Modify: `server/src/catalogSeed.ts` (full rewrite)
- Create: `server/test/catalog.test.ts`

**Interfaces:**
- Consumes: `one/many/run/now` from `./db.js`.
- Produces: `listBrands`, `getBrand`, `upsertBrand`, `upsertProduct`, `deleteBrand`, `deleteProduct` — now `async`. **`recommendBrands` is now `async`** (it calls `listBrands`) — this is the change Task 3 depends on. `recommendProducts` stays sync (pure function over an already-resolved array). `seedCatalogIfEmpty` is now `async`.

- [ ] **Step 1: Write the failing test**

```typescript
// server/test/catalog.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { seedCatalogIfEmpty } from '../src/catalogSeed.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('catalog', () => {
  it('seeds once and serves the active catalog', async () => {
    await seedCatalogIfEmpty();
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/catalog' });
    expect(r.statusCode).toBe(200);
    const { brands } = r.json().data as { brands: unknown[] };
    expect(brands.length).toBeGreaterThan(0);
    await app.close();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/catalog.test.ts
```

Expected: FAIL — still synchronous `node:sqlite` calls.

- [ ] **Step 3: Rewrite `server/src/catalog.ts`**

```typescript
import { one, many, run, now } from './db.js';
import type { Axis, Language, PersonaId } from '@aepick/shared';

export interface CatalogProduct {
  id: string;
  brandId: string;
  name: Record<Language, string>;
  price: string;
  shopUrl: string;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
}

export interface CatalogBrand {
  id: string;
  name: string;
  tagline: Record<Language, string>;
  emoji: string;
  logoUrl: string | null;
  personaTags: PersonaId[];
  axisAffinity: Partial<Record<Axis, number>>;
  sortOrder: number;
  active: boolean;
  products: CatalogProduct[];
}

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

interface BrandRow {
  id: string; name: string; tagline: string | null; emoji: string | null; logo_url: string | null;
  persona_tags: string | null; axis_affinity: string | null; sort_order: number; active: number;
}
interface ProductRow {
  id: string; brand_id: string; name: string; price: string | null; shop_url: string | null;
  image_url: string | null; sort_order: number; active: number;
}

function toBrand(r: BrandRow, products: CatalogProduct[]): CatalogBrand {
  return {
    id: r.id,
    name: r.name,
    tagline: parse(r.tagline, { ko: '', en: '', vi: '' } as Record<Language, string>),
    emoji: r.emoji ?? '🏷',
    logoUrl: r.logo_url,
    personaTags: parse(r.persona_tags, [] as PersonaId[]),
    axisAffinity: parse(r.axis_affinity, {} as Partial<Record<Axis, number>>),
    sortOrder: r.sort_order,
    active: r.active === 1,
    products,
  };
}

function toProduct(r: ProductRow): CatalogProduct {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: parse(r.name, { ko: '', en: '', vi: '' } as Record<Language, string>),
    price: r.price ?? '',
    shopUrl: r.shop_url ?? '',
    imageUrl: r.image_url,
    sortOrder: r.sort_order,
    active: r.active === 1,
  };
}

export async function listBrands(onlyActive = true): Promise<CatalogBrand[]> {
  const brands = await many<BrandRow>(`SELECT * FROM brands ${onlyActive ? 'WHERE active=1' : ''} ORDER BY sort_order, name`);
  const products = await many<ProductRow>(`SELECT * FROM brand_products ${onlyActive ? 'WHERE active=1' : ''} ORDER BY sort_order, id`);

  const byBrand = new Map<string, CatalogProduct[]>();
  for (const p of products) {
    const list = byBrand.get(p.brand_id) ?? [];
    list.push(toProduct(p));
    byBrand.set(p.brand_id, list);
  }
  return brands.map((b) => toBrand(b, byBrand.get(b.id) ?? []));
}

export async function getBrand(id: string): Promise<CatalogBrand | undefined> {
  const row = await one<BrandRow>(`SELECT * FROM brands WHERE id=$1`, [id]);
  if (!row) return undefined;
  const products = (await many<ProductRow>(`SELECT * FROM brand_products WHERE brand_id=$1 ORDER BY sort_order, id`, [id])).map(toProduct);
  return toBrand(row, products);
}

export interface BrandInput {
  id: string;
  name: string;
  tagline?: Record<string, string>;
  emoji?: string;
  logoUrl?: string | null;
  personaTags?: string[];
  axisAffinity?: Record<string, number>;
  sortOrder?: number;
  active?: boolean;
}

export async function upsertBrand(input: BrandInput): Promise<CatalogBrand | undefined> {
  await run(
    `INSERT INTO brands (id, name, tagline, emoji, logo_url, persona_tags, axis_affinity, sort_order, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       name=excluded.name, tagline=excluded.tagline, emoji=excluded.emoji, logo_url=excluded.logo_url,
       persona_tags=excluded.persona_tags, axis_affinity=excluded.axis_affinity,
       sort_order=excluded.sort_order, active=excluded.active, updated_at=excluded.updated_at`,
    [
      input.id, input.name,
      JSON.stringify(input.tagline ?? {}), input.emoji ?? '🏷', input.logoUrl ?? null,
      JSON.stringify(input.personaTags ?? []), JSON.stringify(input.axisAffinity ?? {}),
      input.sortOrder ?? 0, input.active === false ? 0 : 1, now(),
    ],
  );
  return getBrand(input.id);
}

export interface ProductInput {
  id: string;
  brandId: string;
  name?: Record<string, string>;
  price?: string;
  shopUrl?: string;
  imageUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
}

export async function upsertProduct(input: ProductInput): Promise<CatalogProduct | undefined> {
  await run(
    `INSERT INTO brand_products (id, brand_id, name, price, shop_url, image_url, sort_order, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       brand_id=excluded.brand_id, name=excluded.name, price=excluded.price, shop_url=excluded.shop_url,
       image_url=excluded.image_url, sort_order=excluded.sort_order, active=excluded.active,
       updated_at=excluded.updated_at`,
    [
      input.id, input.brandId, JSON.stringify(input.name ?? {}), input.price ?? '',
      input.shopUrl ?? '', input.imageUrl ?? null, input.sortOrder ?? 0,
      input.active === false ? 0 : 1, now(),
    ],
  );
  const row = await one<ProductRow>(`SELECT * FROM brand_products WHERE id=$1`, [input.id]);
  return row ? toProduct(row) : undefined;
}

export async function deleteBrand(id: string): Promise<boolean> {
  await run(`DELETE FROM brand_products WHERE brand_id=$1`, [id]);
  return (await run(`DELETE FROM brands WHERE id=$1`, [id])).rowCount > 0;
}

export async function deleteProduct(id: string): Promise<boolean> {
  return (await run(`DELETE FROM brand_products WHERE id=$1`, [id])).rowCount > 0;
}

/** 추천 브랜드 수 (스펙: 3~5) */
export const BRAND_PICK_COUNT = 4;

/** 페르소나 태그 우선 → 상위 2축 친화도 순으로 브랜드 선정 */
export async function recommendBrands(persona: PersonaId, topAxes: [Axis, Axis], count = BRAND_PICK_COUNT): Promise<CatalogBrand[]> {
  const scored = (await listBrands(true)).map((b) => {
    const tagBonus = b.personaTags.includes(persona) ? 10 : 0;
    const affinity = (b.axisAffinity[topAxes[0]] ?? 0) * 1.4 + (b.axisAffinity[topAxes[1]] ?? 0);
    return { b, score: tagBonus + affinity };
  });
  return scored.sort((x, y) => y.score - x.score).slice(0, count).map((x) => x.b);
}

/** 추천 브랜드에서 대표 제품을 뽑아 평평하게 편다 (결과 화면 제품 목록용) */
export function recommendProducts(brands: CatalogBrand[], perBrand = 1, max = 5): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  for (const b of brands) {
    for (const p of b.products.slice(0, perBrand)) {
      if (out.length < max) out.push(p);
    }
  }
  return out;
}
```

- [ ] **Step 4: Update `server/src/catalogRoutes.ts` call sites**

Change only these lines (everything else, including `catalogPageHtml()`, stays as-is):

```typescript
import { run, now } from './db.js';
```

```typescript
  app.get('/api/catalog', async () => ok({ brands: await listBrands(true) }));
  app.get('/api/catalog/admin', async () => ok({ brands: await listBrands(false) }));

  app.put('/api/catalog/admin/brands/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<BrandInput>;
    if (!body.name?.trim()) return reply.code(400).send(err('bad_request', 'name required'));
    const saved = await upsertBrand({ ...body, id, name: body.name } as BrandInput);
    await run(`INSERT INTO events (type, payload, ts) VALUES ('catalog.brand.saved', $1, $2)`, [JSON.stringify({ id }), now()]);
    return ok(saved);
  });

  app.delete('/api/catalog/admin/brands/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await deleteBrand(id))) return reply.code(404).send(err('not_found', 'brand not found'));
    await run(`INSERT INTO events (type, payload, ts) VALUES ('catalog.brand.deleted', $1, $2)`, [JSON.stringify({ id }), now()]);
    return ok({ id });
  });

  app.put('/api/catalog/admin/products/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<ProductInput>;
    if (!body.brandId) return reply.code(400).send(err('bad_request', 'brandId required'));
    return ok(await upsertProduct({ ...body, id, brandId: body.brandId } as ProductInput));
  });

  app.delete('/api/catalog/admin/products/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await deleteProduct(id))) return reply.code(404).send(err('not_found', 'product not found'));
    return ok({ id });
  });
```

- [ ] **Step 5: Rewrite `server/src/catalogSeed.ts`**

```typescript
import { one } from './db.js';
import { upsertBrand, upsertProduct, type BrandInput, type ProductInput } from './catalog.js';

// SEEDS array: unchanged — copy verbatim from the current server/src/catalogSeed.ts

type Seed = Omit<BrandInput, 'sortOrder'> & { products: Omit<ProductInput, 'brandId' | 'sortOrder'>[] };
declare const SEEDS: Seed[]; // placeholder for the copied constant above

/** 브랜드가 하나도 없을 때만 더미 카탈로그를 심는다. */
export async function seedCatalogIfEmpty(): Promise<number> {
  const row = await one<{ n: string }>(`SELECT COUNT(*) n FROM brands`);
  if (Number(row?.n ?? 0) > 0) return 0;

  for (const [bi, seed] of SEEDS.entries()) {
    const { products, ...brand } = seed;
    await upsertBrand({ ...brand, sortOrder: bi });
    for (const [pi, p] of products.entries()) {
      await upsertProduct({ ...p, brandId: seed.id, sortOrder: pi });
    }
  }
  return SEEDS.length;
}
```

(Delete the `declare const SEEDS` placeholder line — it's only here so this code block type-checks in isolation; the real file keeps the full `SEEDS` array copied from the current source, unchanged.)

- [ ] **Step 6: Update `server/src/index.ts`'s seed call**

```typescript
const seeded = await seedCatalogIfEmpty();
```

- [ ] **Step 7: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/catalog.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/catalog.ts server/src/catalogRoutes.ts server/src/catalogSeed.ts server/src/index.ts server/test/catalog.test.ts
git commit -m "feat(catalog): port brand/product catalog to Postgres"
```

---

### Task 6: Voting (`server/src/voteRoutes.ts`)

**Files:**
- Modify: `server/src/voteRoutes.ts` (full rewrite)
- Create: `server/test/vote.test.ts`

**Interfaces:**
- Consumes: `one/many/run/now` from `./db.js`; `listBrands` (Task 5, now async).
- Produces: `registerVoteRoutes(app)` unchanged in shape; `STAFF_PIN` unchanged; `voteTally()` now `async`.

- [ ] **Step 1: Write the failing test**

This needs a completed session with a result token. Reuse the same flow as Task 3's test.

```typescript
// server/test/vote.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';
import { seedCatalogIfEmpty } from '../src/catalogSeed.js';

describe.skipIf(!process.env.SUPABASE_DB_URL)('voting', () => {
  it('lets a completed visitor vote for 3 products once', async () => {
    await seedCatalogIfEmpty();
    const app = buildTestApp();

    const created = await app.inject({ method: 'POST', url: '/api/sessions', payload: { deviceId: 'TEST-PAD-3', language: 'vi' } });
    const { sessionId } = created.json().data as { sessionId: string };
    await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/answers/repick`, payload: { picked: 'B' } });
    const completed = await app.inject({ method: 'POST', url: `/api/sessions/${sessionId}/complete` });
    const { resultToken } = completed.json().data as { resultToken: string };

    const options = await app.inject({ method: 'GET', url: `/api/vote/${resultToken}/options` });
    expect(options.statusCode).toBe(200);
    const { brands } = options.json().data as { brands: { products: { id: string }[] }[] };
    const productIds = brands.flatMap((b) => b.products.map((p) => p.id)).slice(0, 3);

    const voted = await app.inject({ method: 'POST', url: `/api/vote/${resultToken}`, payload: { productIds } });
    expect(voted.statusCode).toBe(200);

    const again = await app.inject({ method: 'POST', url: `/api/vote/${resultToken}`, payload: { productIds } });
    expect(again.statusCode).toBe(409);

    await app.close();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/vote.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Rewrite `server/src/voteRoutes.ts`**

```typescript
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
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/vote.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/voteRoutes.ts server/test/vote.test.ts
git commit -m "feat(vote): port voting flow to Postgres"
```

---

### Task 7: Admin dashboard queries (`server/src/adminRoutes.ts`)

**Files:**
- Modify: `server/src/adminRoutes.ts` (full rewrite)
- Create: `server/test/admin.test.ts`

**Interfaces:**
- Consumes: `one/many/run/now/todayPrefix` from `./db.js`.
- Produces: `registerAdminRoutes(app)` unchanged in shape. `/api/admin/sessions` rows gain `full_name`, `gender`, `age_group`.
- Notable SQLite→Postgres translations: `julianday(a)-julianday(b))*86400` → `EXTRACT(EPOCH FROM (a::timestamptz - b::timestamptz))`; `json_extract(payload,'$.productId')` → `payload::json->>'productId'`; `substr()` and `LIKE` work identically in both.

- [ ] **Step 1: Write the failing test**

```typescript
// server/test/admin.test.ts
import { describe, it, expect } from 'vitest';
import { buildTestApp } from './helpers.js';

const HEADERS = { 'x-admin-key': process.env.ADMIN_KEY ?? 'aepick-admin' };

describe.skipIf(!process.env.SUPABASE_DB_URL)('admin dashboard', () => {
  it('rejects without the admin key', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/admin/overview' });
    expect(r.statusCode).toBe(401);
    await app.close();
  });

  it('returns overview, analytics, and sessions (with profile fields) for the admin key', async () => {
    const app = buildTestApp();

    const overview = await app.inject({ method: 'GET', url: '/api/admin/overview', headers: HEADERS });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().data.today).toHaveProperty('started');

    const analytics = await app.inject({ method: 'GET', url: '/api/admin/analytics', headers: HEADERS });
    expect(analytics.statusCode).toBe(200);

    const sessions = await app.inject({ method: 'GET', url: '/api/admin/sessions', headers: HEADERS });
    expect(sessions.statusCode).toBe(200);
    const rows = sessions.json().data.sessions as Record<string, unknown>[];
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('full_name');
      expect(rows[0]).toHaveProperty('gender');
      expect(rows[0]).toHaveProperty('age_group');
    }

    await app.close();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/admin.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Rewrite `server/src/adminRoutes.ts`**

```typescript
import type { FastifyInstance } from 'fastify';
import { AXES } from '@aepick/shared';
import { one, many, run, now, todayPrefix } from './db.js';
import { ADMIN_KEY } from './adminKey.js';

const ok = (data: unknown) => ({ ok: true, data });

export function registerAdminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/admin')) return;
    if (req.headers['x-admin-key'] !== ADMIN_KEY)
      return reply.code(401).send({ ok: false, error: { code: 'unauthorized', message: 'invalid admin key' } });
  });

  /* ── 13. 실시간 개요 ── */
  app.get('/api/admin/overview', async () => {
    const prefix = `${todayPrefix()}%`;
    const count = async (sql: string, ...args: string[]) => Number((await one<{ n: string }>(sql, args))?.n ?? 0);

    const started = await count(`SELECT COUNT(*) n FROM sessions WHERE started_at LIKE $1`, prefix);
    const completed = await count(`SELECT COUNT(*) n FROM sessions WHERE status='completed' AND started_at LIKE $1`, prefix);
    const abandoned = await count(`SELECT COUNT(*) n FROM events WHERE type='session.abandoned' AND ts LIKE $1`, prefix);
    const active = await count(`SELECT COUNT(*) n FROM sessions WHERE status='active' AND started_at > $1`,
      new Date(Date.now() - 10 * 60_000).toISOString());

    const avgDuration = await one<{ sec: number | null }>(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at::timestamptz - started_at::timestamptz))) sec
       FROM sessions WHERE status='completed' AND started_at LIKE $1`,
      [prefix],
    );

    const qrScans = await count(`SELECT COUNT(*) n FROM events WHERE type='result.scanned' AND ts LIKE $1`, prefix);
    const qrIssued = await count(`SELECT COUNT(*) n FROM events WHERE type='qr.issued' AND ts LIKE $1`, prefix);
    const downloads = await count(`SELECT COUNT(*) n FROM events WHERE type='result.downloaded' AND ts LIKE $1`, prefix);
    const retakes = await count(`SELECT COUNT(*) n FROM events WHERE type='photo.retake' AND ts LIKE $1`, prefix);
    const captures = await count(`SELECT COUNT(*) n FROM events WHERE type='photo.captured' AND ts LIKE $1`, prefix);

    const devices = await many(`SELECT id, name, last_heartbeat, app_version, state FROM devices`);

    return ok({
      today: { started, completed, abandoned, active },
      completionRate: started > 0 ? Math.round((completed / started) * 100) : null,
      avgDurationSec: avgDuration?.sec ? Math.round(avgDuration.sec) : null,
      qr: { issued: qrIssued, scanned: qrScans, scanRate: qrIssued > 0 ? Math.round((qrScans / qrIssued) * 100) : null },
      downloads,
      retakeRate: captures > 0 ? Math.round((retakes / (captures + retakes)) * 100) : null,
      devices,
    });
  });

  /* ── 14. 마케팅 분석 ── */
  app.get('/api/admin/analytics', async (req) => {
    const { from, to } = (req.query ?? {}) as { from?: string; to?: string };
    const lo = from ?? '0000';
    const hi = to ?? '9999';

    const axisAvg: Record<string, number | null> = {};
    for (const axis of AXES) {
      const r = await one<{ avg: number | null }>(
        `SELECT AVG(score) avg FROM answers WHERE core_key=$1 AND answered_at BETWEEN $2 AND $3`,
        [axis, lo, hi],
      );
      axisAvg[axis] = r?.avg !== null && r?.avg !== undefined ? Math.round(r.avg) : null;
    }

    const personas = await many(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at BETWEEN $1 AND $2 GROUP BY persona ORDER BY n DESC`,
      [lo, hi],
    );

    const hourly = await many(
      `SELECT substr(started_at, 12, 2) hour, COUNT(*) n FROM sessions WHERE started_at BETWEEN $1 AND $2 GROUP BY hour ORDER BY hour`,
      [lo, hi],
    );

    const subtypeDist = (coreKey: string) =>
      many(
        `SELECT subtype, COUNT(*) n FROM answers WHERE core_key=$1 AND answered_at BETWEEN $2 AND $3 GROUP BY subtype ORDER BY n DESC`,
        [coreKey, lo, hi],
      );

    const marketingConsent = await one<{ n: string }>(
      `SELECT COUNT(*) n FROM events WHERE type='consent.marketing' AND ts BETWEEN $1 AND $2`,
      [lo, hi],
    );

    const productClicks = await many(
      `SELECT payload::json->>'productId' pid, COUNT(*) n FROM events WHERE type='product.clicked' AND ts BETWEEN $1 AND $2 GROUP BY pid ORDER BY n DESC`,
      [lo, hi],
    );

    return ok({
      axisAverages: axisAvg,
      personaDistribution: personas,
      hourlyParticipants: hourly,
      subtypes: {
        repick: await subtypeDist('repick'), value: await subtypeDist('value'), care: await subtypeDist('care'),
        trend: await subtypeDist('trend'), localFit: await subtypeDist('localFit'), trust: await subtypeDist('trust'),
      },
      marketingConsents: Number(marketingConsent?.n ?? 0),
      productClicks,
    });
  });

  /* ── 15. 세션 목록 (이제 이름·성별·연령대 포함) ── */
  app.get('/api/admin/sessions', async (req) => {
    const { status, page } = (req.query ?? {}) as { status?: string; page?: string };
    const p = Math.max(1, Number(page ?? 1));
    const cols = `id, device_id, language, status, full_name, gender, age_group, persona, started_at, completed_at`;
    const rows = status
      ? await many(`SELECT ${cols} FROM sessions WHERE status=$1 ORDER BY started_at DESC LIMIT 50 OFFSET $2`, [status, (p - 1) * 50])
      : await many(`SELECT ${cols} FROM sessions ORDER BY started_at DESC LIMIT 50 OFFSET $1`, [(p - 1) * 50]);
    return ok({ sessions: rows, page: p });
  });

  /* ── 16. 기기 하트비트 ── */
  app.post('/api/admin/devices/:id/heartbeat', async (req) => {
    const { id } = req.params as { id: string };
    const { battery, appVersion, state } = (req.body ?? {}) as { battery?: number; appVersion?: string; state?: string };
    await run(
      `INSERT INTO devices (id, last_heartbeat, app_version, state) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET last_heartbeat=excluded.last_heartbeat, app_version=excluded.app_version, state=excluded.state`,
      [id, now(), appVersion ?? null, state ?? (battery !== undefined ? `battery:${battery}` : null)],
    );
    return ok({});
  });
}
```

- [ ] **Step 4: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/admin.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/adminRoutes.ts server/test/admin.test.ts
git commit -m "feat(admin): port admin dashboard queries to Postgres, expose profile fields"
```

---

### Task 8: Kiosk sends the consent-screen profile to the server

**Files:**
- Modify: `apps/kiosk/src/api.ts`
- Modify: `apps/kiosk/src/screens/flow.tsx` (`ConsentScreen`'s `start()`)

**Interfaces:**
- Consumes: `PATCH /api/sessions/:id/profile` (Task 3).
- Produces: `api.setProfile(sessionId, profile)`.

Right now `ConsentScreen.start()` only saves `fullName`/`gender`/`ageGroup` into local kiosk state (`apps/kiosk/src/state.tsx`) — it's never sent to the server. This task wires it up, following the existing `tryReq`-based pattern (fire-and-forget, doesn't block the experience if the backend is unreachable).

- [ ] **Step 1: Add `setProfile` to `apps/kiosk/src/api.ts`**

Add inside the `api` object (after `submitAnswer`, matching the existing style):

```typescript
  /* ── 동의 화면에서 입력한 이름·성별·연령대 저장 ── */
  setProfile: (
    sessionId: string,
    profile: { fullName?: string; gender?: 'male' | 'female' | null; ageGroup?: string | null },
  ) => tryReq('PATCH', `/sessions/${sessionId}/profile`, profile),
```

- [ ] **Step 2: Call it from `ConsentScreen.start()`**

In `apps/kiosk/src/screens/flow.tsx`, find:

```typescript
  const start = () => {
    update({ fullName: fullName.trim(), gender, ageGroup });
    go('intro');
  };
```

Replace with:

```typescript
  const start = () => {
    const trimmedName = fullName.trim();
    update({ fullName: trimmedName, gender, ageGroup });
    if (s.sessionId) api.setProfile(s.sessionId, { fullName: trimmedName, gender, ageGroup });
    go('intro');
  };
```

- [ ] **Step 3: Manual verification**

`api.ts` calls are fire-and-forget against a live backend, and there's no existing frontend test harness in this repo (no Playwright/Testing Library setup) — adding one is out of scope for this plan. Verify manually instead:

1. Run `SUPABASE_DB_URL="<your string>" npm run demo:build && SUPABASE_DB_URL="<your string>" npm run demo:start` (or `START-DEMO.bat` once Task 10 wires the `.env` file).
2. Open the kiosk, pick a language, fill in the consent screen (name, gender, age), tap "Bắt đầu trải nghiệm".
3. In Supabase → Table Editor → `sessions`, find the newest row and confirm `full_name`, `gender`, `age_group` are populated.

- [ ] **Step 4: Commit**

```bash
git add apps/kiosk/src/api.ts apps/kiosk/src/screens/flow.tsx
git commit -m "feat(kiosk): send consent-screen profile (name/gender/age) to the server"
```

---

### Task 9: Excel export for admin

**Files:**
- Modify: `server/package.json` (add `exceljs`)
- Modify: `server/src/adminRoutes.ts` (add one route)
- Modify: `server/src/pages.ts` (`adminPageHtml()` — add an "Export Excel" button)
- Create: `server/test/export.test.ts`

**Interfaces:**
- Consumes: `many` from `./db.js`, `ExcelJS` from `exceljs`.
- Produces: `GET /api/admin/export/sessions.xlsx` (protected by the same `X-Admin-Key` hook already registered in `registerAdminRoutes`).

- [ ] **Step 1: Add the dependency**

In `server/package.json`, add to `dependencies`:

```json
"exceljs": "^4.4.0",
```

```bash
npm install
```

- [ ] **Step 2: Write the failing test**

```typescript
// server/test/export.test.ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTestApp } from './helpers.js';

const HEADERS = { 'x-admin-key': process.env.ADMIN_KEY ?? 'aepick-admin' };

describe.skipIf(!process.env.SUPABASE_DB_URL)('sessions Excel export', () => {
  it('returns a valid .xlsx with the expected columns', async () => {
    const app = buildTestApp();
    const r = await app.inject({ method: 'GET', url: '/api/admin/export/sessions.xlsx', headers: HEADERS });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(r.rawPayload);
    const sheet = workbook.getWorksheet('Sessions')!;
    const header = sheet.getRow(1).values as unknown[];
    expect(header).toContain('Full Name');
    expect(header).toContain('Gender');
    expect(header).toContain('Age Group');

    await app.close();
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/export.test.ts
```

Expected: FAIL — 404, route doesn't exist yet.

- [ ] **Step 4: Add the route to `server/src/adminRoutes.ts`**

Add the import at the top:

```typescript
import ExcelJS from 'exceljs';
```

Add the route inside `registerAdminRoutes`, after `/api/admin/sessions`:

```typescript
  /* ── 관리자용 세션 Excel 다운로드 ── */
  app.get('/api/admin/export/sessions.xlsx', async (_req, reply) => {
    const rows = await many<{
      id: string; started_at: string; completed_at: string | null; language: string;
      full_name: string | null; gender: string | null; age_group: string | null;
      persona: string | null; status: string;
    }>(
      `SELECT id, started_at, completed_at, language, full_name, gender, age_group, persona, status
       FROM sessions ORDER BY started_at DESC`,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sessions');
    sheet.columns = [
      { header: 'Session ID', key: 'id', width: 38 },
      { header: 'Started At', key: 'started_at', width: 22 },
      { header: 'Completed At', key: 'completed_at', width: 22 },
      { header: 'Language', key: 'language', width: 10 },
      { header: 'Full Name', key: 'full_name', width: 24 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Age Group', key: 'age_group', width: 12 },
      { header: 'Persona', key: 'persona', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    sheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="aepick-sessions-${todayPrefix()}.xlsx"`)
      .send(Buffer.from(buffer));
  });
```

- [ ] **Step 5: Run it to confirm it passes**

```bash
SUPABASE_DB_URL="<paste your connection string>" npx vitest run server/test/export.test.ts
```

Expected: PASS.

- [ ] **Step 6: Add the download button to the admin dashboard (`server/src/pages.ts`)**

In `adminPageHtml()`, change the header line:

```html
<div style="display:flex;justify-content:space-between;align-items:baseline">
  <h1>AEPICK BEAUTY DNA <span>· OPERATIONS</span></h1>
  <div style="display:flex;align-items:center;gap:12px">
    <button id="exportBtn" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--ink);cursor:pointer;font:inherit">Export Excel</button>
    <div id="status">connecting…</div>
  </div>
</div>
```

And add this inside the `<script>` block, right after `const el=id=>document.getElementById(id);`:

```javascript
el('exportBtn').onclick=async()=>{
  const r=await fetch('/api/admin/export/sessions.xlsx',{headers:H});
  if(!r.ok){alert('Export failed');return}
  const blob=await r.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='aepick-sessions.xlsx'; a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 7: Manual verification**

Open `/admin` in a browser (after Task 10's env wiring, or with `SUPABASE_DB_URL` exported in your shell), enter the admin key, click "Export Excel", confirm a `.xlsx` downloads and opens with the expected columns.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/src/adminRoutes.ts server/src/pages.ts server/test/export.test.ts package-lock.json
git commit -m "feat(admin): add Excel export for sessions"
```

---

### Task 10: Environment wiring (`.env`, `dotenv`, launchers, seed script)

**Files:**
- Create: `.env.example`
- Modify: `package.json` (root — add `dotenv`)
- Modify: `server/src/index.ts` (load `.env` first)
- Modify: `tools/seed-demo.mjs` (full rewrite — port off `node:sqlite`)
- Modify: `START-DEMO.bat`, `START-TUNNEL.bat` (fail fast with a clear message if `.env` is missing)

**Interfaces:**
- Produces: `SUPABASE_DB_URL` available to every server process (`npm run dev:server`, `npm run demo:start`, `npm run demo:seed`) via a single `.env` file at the repo root, without manually exporting it in every shell.

- [ ] **Step 1: Add `dotenv`**

Root `package.json`, `dependencies`:

```json
"dotenv": "^16.4.0",
```

```bash
npm install
```

- [ ] **Step 2: Create `.env.example`**

```
# Copy this file to .env and fill in your own Supabase project's values.
# Supabase dashboard -> Project Settings -> Database -> Connection string -> URI
# Use the "Transaction pooler" (port 6543) connection string.
SUPABASE_DB_URL=postgresql://postgres.xxxxxxxxxxxx:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

(`.env` and `.env.local` are already in `.gitignore` — nothing to change there.)

- [ ] **Step 3: Load it first thing in `server/src/index.ts`**

Add as the very first line of the file (before any other import — see Task 2's `db.ts`, which throws immediately if `SUPABASE_DB_URL` is unset, so the env file must be loaded before `./db.js` is imported):

```typescript
import 'dotenv/config';
```

- [ ] **Step 4: Rewrite `tools/seed-demo.mjs`**

```javascript
/**
 * 시연용 시드 데이터 — 대기화면 통계(참여자 수·인기 DNA)와 게임 내 집계를 채운다.
 * 통계가 0이면 Attract 화면이 비어 보이므로, 시연 직전에 한 번 실행한다.
 *
 *   node tools/seed-demo.mjs [건수]     기본 24건
 *   node tools/seed-demo.mjs --clear    오늘 시드 데이터 삭제
 */
import 'dotenv/config';
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
```

- [ ] **Step 5: Guard the launcher scripts**

In both `START-DEMO.bat` and `START-TUNNEL.bat`, right after the Node.js version check block (`echo [1/4] Node.js OK` / `echo [1/5] Node.js OK`), add:

```bat
if not exist ".env" (
  echo.
  echo  [ERROR] .env file not found.
  echo          Copy .env.example to .env and paste your Supabase connection string.
  echo          (Supabase dashboard - Project Settings - Database - Connection string)
  echo.
  pause
  exit /b 1
)
```

- [ ] **Step 6: Manual verification**

```bash
cp .env.example .env   # then edit .env with your real connection string
node tools/seed-demo.mjs 5
```

Expected: `✅ 시드 5건 생성 — 인기 DNA: ...` printed, and 5 new rows visible in Supabase's `sessions` table.

Then double-click `START-DEMO.bat` without a `.env` file present (temporarily rename it) — confirm it prints the `[ERROR] .env file not found.` message instead of crashing with a raw stack trace.

- [ ] **Step 7: Commit**

```bash
git add .env.example package.json server/src/index.ts tools/seed-demo.mjs START-DEMO.bat START-TUNNEL.bat package-lock.json
git commit -m "chore(config): load SUPABASE_DB_URL from .env across server, seed script, and launchers"
```

---

### Task 11: Cutover — full smoke test, then remove SQLite

**Files:**
- Delete: `server/data/aepick.sqlite` (if present — it's already gitignored, this is a local file cleanup, not a repo change)

No code changes in this task — Tasks 2–10 already removed every `node:sqlite` import. This is the final manual pass to confirm the whole thing works end-to-end before you consider the migration done.

**Note on existing local data:** `server/data/aepick.sqlite` only ever held demo/seed data for this pre-launch project (per the codebase's own comments — no real customer data has shipped yet). This plan does not include a SQLite→Postgres data-backfill script; the Supabase database starts empty. If that assumption is wrong and you do have real data worth keeping in the local file, say so before running this task and a one-off backfill script should be written first — don't delete the file until that's confirmed.

- [ ] **Step 1: Full local smoke test**

1. `.env` has a valid `SUPABASE_DB_URL` (Task 10).
2. Double-click `START-DEMO.bat`. Confirm: Node check passes, `.env` check passes, packages install/skip, kiosk builds, server starts and prints the LAN address.
3. On the kiosk (or `https://localhost:8787/`): pick a language → consent screen (enter name, pick gender, pick age, check both required boxes) → confirm "Bắt đầu trải nghiệm" only enables once all are filled (already implemented) → play through all 6 core games → reach the QR screen.
4. Open `/admin` in a browser, enter the admin key, confirm the overview KPIs, persona distribution, and recent sessions list all populate (sessions list should show the row you just created, with its language and persona).
5. Click "Export Excel" (Task 9), open the downloaded file, confirm your test row appears with the correct `Full Name`, `Gender`, `Age Group`.
6. Open `/admin/catalog`, confirm the 10 seeded brands still show up and are still editable (save one small change, refresh, confirm it persisted).
7. Scan the result QR (or open the printed LAN URL from a phone) to confirm `/r/:token` still renders and the vote flow (`/v/:token`) still works end-to-end, including a staff PIN lookup.

- [ ] **Step 2: Remove the local SQLite file**

```bash
rm -f server/data/aepick.sqlite server/data/aepick.sqlite-*
```

(Already covered by `.gitignore`'s `server/data/` and `*.db*` rules — nothing to stage.)

- [ ] **Step 3: Update the BE handover doc**

Add a short note to `docs/VN_07_BE_Handover Document.md` (or wherever the team keeps deployment notes) recording: the DB is now Supabase Postgres via `SUPABASE_DB_URL`, and where to find/rotate that connection string. This is documentation, not code — skip the TDD ceremony, just write it.

- [ ] **Step 4: Final commit**

```bash
git add docs/
git commit -m "docs: record Supabase as the database of record"
```

---

## Self-review notes

- **Spec coverage:** "keep everything as-is" → Tasks 3–7 (1:1 behavioral port of every route). "add full_name/gender/age_group" → Task 1 (schema), Task 3 (save endpoint), Task 7 (expose in admin sessions list), Task 8 (kiosk sends it), Task 9 (in the Excel export). "use Supabase for storage" → Tasks 1–2 (architecture decision + client) applied throughout. "Excel download for admin" → Task 9. No gaps found.
- **No placeholders:** every task pastes real, complete file contents except the two spots called out explicitly as verbatim-copy-unchanged (`pairingPageHtml`'s template in Task 4, `catalogPageHtml()` in Task 5, and the `SEEDS` array in Task 5) — those are large blocks of existing code with zero DB calls in them, so re-pasting them here would just be noise; the task text says exactly what to keep.
- **Type/name consistency checked:** `one/many/run/now/todayPrefix` (Task 2) used identically by name across Tasks 3–9. `recommendBrands` is called with `await` everywhere after Task 5 makes it async (routes.ts `/complete` and `/results/:token`). `deleteResult` is `await`ed by both its callers in `routes.ts`. `PATCH /api/sessions/:id/profile` request shape (`fullName`, `gender`, `ageGroup`) matches exactly between Task 3 (server) and Task 8 (kiosk `api.setProfile`).
