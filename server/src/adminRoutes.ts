import type { FastifyInstance } from 'fastify';
import { AXES } from '@aepick/shared';
import { db, now, todayPrefix } from './db.js';
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
    const q = (sql: string, ...args: string[]) => (db.prepare(sql).get(...args) as unknown as { n: number }).n;

    const started = q(`SELECT COUNT(*) n FROM sessions WHERE started_at LIKE ?`, prefix);
    const completed = q(`SELECT COUNT(*) n FROM sessions WHERE status='completed' AND started_at LIKE ?`, prefix);
    const abandoned = q(`SELECT COUNT(*) n FROM events WHERE type='session.abandoned' AND ts LIKE ?`, prefix);
    const active = q(`SELECT COUNT(*) n FROM sessions WHERE status='active' AND started_at > ?`,
      new Date(Date.now() - 10 * 60_000).toISOString());

    const avgDuration = db.prepare(
      `SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400) sec
       FROM sessions WHERE status='completed' AND started_at LIKE ?`,
    ).get(prefix) as { sec: number | null };

    const jobs = db.prepare(
      `SELECT status, COUNT(*) n FROM image_jobs GROUP BY status`,
    ).all() as { status: string; n: number }[];

    const qrScans = q(`SELECT COUNT(*) n FROM events WHERE type='result.scanned' AND ts LIKE ?`, prefix);
    const qrIssued = q(`SELECT COUNT(*) n FROM events WHERE type='qr.issued' AND ts LIKE ?`, prefix);
    const downloads = q(`SELECT COUNT(*) n FROM events WHERE type='result.downloaded' AND ts LIKE ?`, prefix);
    const retakes = q(`SELECT COUNT(*) n FROM events WHERE type='photo.retake' AND ts LIKE ?`, prefix);
    const captures = q(`SELECT COUNT(*) n FROM events WHERE type='photo.captured' AND ts LIKE ?`, prefix);

    const devices = db.prepare(`SELECT id, name, last_heartbeat, app_version, state FROM devices`).all();

    return ok({
      today: { started, completed, abandoned, active },
      completionRate: started > 0 ? Math.round((completed / started) * 100) : null,
      avgDurationSec: avgDuration.sec ? Math.round(avgDuration.sec) : null,
      imageJobs: Object.fromEntries(jobs.map((j) => [j.status, j.n])),
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
      const r = db.prepare(
        `SELECT AVG(score) avg FROM answers WHERE core_key=? AND answered_at BETWEEN ? AND ?`,
      ).get(axis, lo, hi) as { avg: number | null };
      axisAvg[axis] = r.avg !== null ? Math.round(r.avg) : null;
    }

    const personas = db.prepare(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at BETWEEN ? AND ? GROUP BY persona ORDER BY n DESC`,
    ).all(lo, hi);

    const hourly = db.prepare(
      `SELECT substr(started_at, 12, 2) hour, COUNT(*) n FROM sessions WHERE started_at BETWEEN ? AND ? GROUP BY hour ORDER BY hour`,
    ).all(lo, hi);

    const subtypeDist = (coreKey: string) =>
      db.prepare(`SELECT subtype, COUNT(*) n FROM answers WHERE core_key=? AND answered_at BETWEEN ? AND ? GROUP BY subtype ORDER BY n DESC`)
        .all(coreKey, lo, hi);

    const marketingConsent = db.prepare(
      `SELECT COUNT(*) n FROM events WHERE type='consent.marketing' AND ts BETWEEN ? AND ?`,
    ).get(lo, hi) as { n: number };

    const productClicks = db.prepare(
      `SELECT json_extract(payload, '$.productId') pid, COUNT(*) n FROM events WHERE type='product.clicked' AND ts BETWEEN ? AND ? GROUP BY pid ORDER BY n DESC`,
    ).all(lo, hi);

    return ok({
      axisAverages: axisAvg,
      personaDistribution: personas,
      hourlyParticipants: hourly,
      subtypes: {
        repick: subtypeDist('repick'), value: subtypeDist('value'), care: subtypeDist('care'),
        trend: subtypeDist('trend'), localFit: subtypeDist('localFit'), trust: subtypeDist('trust'),
      },
      marketingConsents: marketingConsent.n,
      productClicks,
    });
  });

  /* ── 15. 세션 목록 ── */
  app.get('/api/admin/sessions', async (req) => {
    const { status, page } = (req.query ?? {}) as { status?: string; page?: string };
    const p = Math.max(1, Number(page ?? 1));
    const rows = status
      ? db.prepare(`SELECT id, device_id, language, status, persona, started_at, completed_at FROM sessions WHERE status=? ORDER BY started_at DESC LIMIT 50 OFFSET ?`).all(status, (p - 1) * 50)
      : db.prepare(`SELECT id, device_id, language, status, persona, started_at, completed_at FROM sessions ORDER BY started_at DESC LIMIT 50 OFFSET ?`).all((p - 1) * 50);
    return ok({ sessions: rows, page: p });
  });

  /* ── 16. 기기 하트비트 ── */
  app.post('/api/admin/devices/:id/heartbeat', async (req) => {
    const { id } = req.params as { id: string };
    const { battery, appVersion, state } = (req.body ?? {}) as { battery?: number; appVersion?: string; state?: string };
    db.prepare(
      `INSERT INTO devices (id, last_heartbeat, app_version, state) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_heartbeat=excluded.last_heartbeat, app_version=excluded.app_version, state=excluded.state`,
    ).run(id, now(), appVersion ?? null, state ?? (battery !== undefined ? `battery:${battery}` : null));
    return ok({});
  });
}
