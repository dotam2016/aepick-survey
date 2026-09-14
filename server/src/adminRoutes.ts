import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
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

    const personas = (await many<{ persona: string; n: string }>(
      `SELECT persona, COUNT(*) n FROM sessions WHERE persona IS NOT NULL AND started_at BETWEEN $1 AND $2 GROUP BY persona ORDER BY n DESC`,
      [lo, hi],
    )).map((r) => ({ ...r, n: Number(r.n) }));

    const hourly = (await many<{ hour: string; n: string }>(
      `SELECT substr(started_at, 12, 2) hour, COUNT(*) n FROM sessions WHERE started_at BETWEEN $1 AND $2 GROUP BY hour ORDER BY hour`,
      [lo, hi],
    )).map((r) => ({ ...r, n: Number(r.n) }));

    const subtypeDist = async (coreKey: string) =>
      (await many<{ subtype: string; n: string }>(
        `SELECT subtype, COUNT(*) n FROM answers WHERE core_key=$1 AND answered_at BETWEEN $2 AND $3 GROUP BY subtype ORDER BY n DESC`,
        [coreKey, lo, hi],
      )).map((r) => ({ ...r, n: Number(r.n) }));

    const marketingConsent = await one<{ n: string }>(
      `SELECT COUNT(*) n FROM events WHERE type='consent.marketing' AND ts BETWEEN $1 AND $2`,
      [lo, hi],
    );

    const productClicks = (await many<{ pid: string; n: string }>(
      `SELECT payload::json->>'productId' pid, COUNT(*) n FROM events WHERE type='product.clicked' AND ts BETWEEN $1 AND $2 GROUP BY pid ORDER BY n DESC`,
      [lo, hi],
    )).map((r) => ({ ...r, n: Number(r.n) }));

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

  /* ── 17. Zalo 체크인 이벤트 등록 목록 (webhookRoutes.ts가 저장) ── */
  app.get('/api/admin/registrations', async (req) => {
    const { page } = (req.query ?? {}) as { page?: string };
    const p = Math.max(1, Number(page ?? 1));
    const rows = await many(
      `SELECT id, external_id, qr_code, full_name, phone, dob, gender, received_at
       FROM event_registrations ORDER BY received_at DESC LIMIT 50 OFFSET $1`,
      [(p - 1) * 50],
    );
    return ok({ registrations: rows, page: p });
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
