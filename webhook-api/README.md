# aepick-webhook-api

Standalone Vercel deployment of just the Zalo event check-in webhook + its admin
viewer, split out from the main kiosk server (`server/`) so it has a stable,
always-on URL independent of the on-site kiosk PC. Same Supabase database as
the kiosk — both write to the same `event_registrations` table
(`server/sql/schema.sql`).

Full spec of what these two endpoints do: `docs/VN_07_BE_Handover Document.md`, section 3-6.

## Deploy

1. Make sure `event_registrations` exists in your Supabase project — run
   `server/sql/schema.sql` once via Supabase SQL Editor if you haven't (see
   `docs/VN_08_Huong_dan_Cai_dat_Supabase.md`).
2. [vercel.com](https://vercel.com) → **Add New... → Project** → import this
   GitHub repo.
3. **Root Directory**: set to `webhook-api` (not the repo root — this folder
   is a separate app from the kiosk).
4. **Environment Variables**, add:
   | Name | Value |
   |---|---|
   | `SUPABASE_DB_URL` | Same connection string as the kiosk's `.env` (Transaction pooler, port 6543) |
   | `ZALO_WEBHOOK_SECRET` | A secret you generate — give this value to the Zalo team, they send it in the `x-webhook-secret` header |
   | `ADMIN_KEY` | A key of your choice, to view stored registrations via `x-admin-key` header |
5. Deploy. Vercel gives you a URL like `https://aepick-webhook-api.vercel.app`.
6. (Optional) **Project Settings → Domains** → add your own domain/subdomain
   (e.g. `webhook.yourdomain.com`) if you want a branded fixed URL instead of
   the `.vercel.app` one.
7. Give the Zalo team: `https://<your-vercel-domain>/api/webhooks/zalo-checkin` + the `ZALO_WEBHOOK_SECRET` value.

## Local dev

```bash
cd webhook-api
npm install
cp .env.example .env.local   # fill in the 3 values
npx vercel dev
```

## Test

```bash
curl -X POST https://<your-domain>/api/webhooks/zalo-checkin \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <ZALO_WEBHOOK_SECRET>" \
  -d '{"name":"Nguyen Van A","phone":"0900000000","gender":"male"}'

curl https://<your-domain>/api/admin/registrations \
  -H "x-admin-key: <ADMIN_KEY>"
```
