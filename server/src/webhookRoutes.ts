import type { FastifyInstance } from 'fastify';
import { run, now } from './db.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

/*
 * Unlike ADMIN_KEY (typed by the operator, so a random tunnel default is
 * fine), this secret has to be handed to the Zalo team ahead of time, so a
 * silently-random default would just lock them out. Fixed dev default;
 * ZALO_WEBHOOK_SECRET must be set explicitly before going live. Read lazily
 * (not a module-level const) so tests can override it regardless of import order.
 */
const WEBHOOK_SECRET_DEFAULT = 'aepick-webhook-dev';

function firstString(body: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

export function registerWebhookRoutes(app: FastifyInstance) {
  /*
   * Called by the Zalo mini-app/QR team right after a visitor submits the
   * check-in form and their side issues the reward QR (sent to the visitor
   * via ZNS separately — this webhook is how we get the form data).
   * We don't control their payload shape, so we accept common field-name
   * aliases and always keep the raw body too — nothing is lost even if our
   * guessed field names turn out wrong. Adjust the alias lists once they
   * share a real payload sample.
   */
  app.post('/api/webhooks/zalo-checkin', async (req, reply) => {
    const secret = process.env.ZALO_WEBHOOK_SECRET ?? WEBHOOK_SECRET_DEFAULT;
    if (req.headers['x-webhook-secret'] !== secret)
      return reply.code(401).send(err('unauthorized', 'invalid webhook secret'));

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (Object.keys(body).length === 0) return reply.code(400).send(err('bad_request', 'empty body'));

    const externalId = firstString(body, ['registrationId', 'id', 'eventId']);
    const qrCode = firstString(body, ['qrCode', 'qrId', 'code']);
    const fullName = firstString(body, ['fullName', 'name', 'zaloName']);
    const phone = firstString(body, ['phone', 'phoneNumber', 'tel']);
    const dob = firstString(body, ['dob', 'birthday', 'dateOfBirth']);
    const gender = firstString(body, ['gender', 'sex']);

    await run(
      `INSERT INTO event_registrations (external_id, qr_code, full_name, phone, dob, gender, raw_payload, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET qr_code=excluded.qr_code, full_name=excluded.full_name, phone=excluded.phone,
         dob=excluded.dob, gender=excluded.gender, raw_payload=excluded.raw_payload, received_at=excluded.received_at`,
      [externalId, qrCode, fullName, phone, dob, gender, JSON.stringify(body), now()],
    );
    return ok({ stored: true });
  });
}
