import type { FastifyInstance, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { one, run, now } from './db.js';
import { identityProvider, isIdentityMocked } from './identity.js';
import { dicts } from './i18nDicts.js';
import { cancelPairings, claimPairing, getPairing, issuePairing, sweepExpiredPairings } from './pairing.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? '';

/** QR에 넣을 주소. 터널/LAN/로컬 어디서 접속하든 그 주소를 그대로 쓴다. */
function baseUrlOf(req: FastifyRequest): string {
  if (PUBLIC_BASE) return PUBLIC_BASE;
  return `${req.protocol}://${req.headers.host ?? `localhost:${process.env.PORT ?? 8787}`}`;
}

export function registerPairingRoutes(app: FastifyInstance) {
  /* ── P1. PAD: 페어링 코드 발급 (대기화면) ── */
  app.post('/api/pairings', async (req) => {
    const { deviceId } = (req.body ?? {}) as { deviceId?: string };
    const device = deviceId?.trim() || 'unknown';
    const pairing = await issuePairing(device);
    const url = `${baseUrlOf(req)}/p/${pairing.code}`;
    const qrPngUrl = await QRCode.toDataURL(url, { width: 480, margin: 1 });
    return ok({
      code: pairing.code,
      url,
      qrPngUrl,
      expiresAt: pairing.expires_at,
      mocked: isIdentityMocked,
    });
  });

  /* ── P2. PAD: 클레임 여부 폴링 ── */
  app.get('/api/pairings/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    const pairing = await getPairing(code);
    if (!pairing) return reply.code(404).send(err('not_found', 'unknown pairing code'));

    if (pairing.status !== 'claimed') {
      return ok({ status: pairing.status, expiresAt: pairing.expires_at });
    }
    const visitor = await one<{ n: number }>(`SELECT visit_count n FROM visitors WHERE id=$1`, [pairing.visitor_id!]);
    const session = await one<{ language: string }>(`SELECT language FROM sessions WHERE id=$1`, [pairing.session_id!]);
    return ok({
      status: 'claimed',
      sessionId: pairing.session_id,
      language: session?.language,
      visitCount: visitor?.n ?? 1,
    });
  });

  /* ── P3. 폰: 클레임 (app 계정 연결) ── */
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
    return ok({
      sessionId: result.sessionId,
      visitCount: result.visitCount,
    });
  });

  /* ── P4. PAD: 발급한 코드 취소 (고객 이탈·초기화) ── */
  app.post('/api/pairings/cancel', async (req) => {
    const { deviceId } = (req.body ?? {}) as { deviceId?: string };
    const cancelled = await cancelPairings(deviceId?.trim() || 'unknown');
    return ok({ cancelled });
  });

  /* ── P5. 폰: 페어링 안내 페이지 (QR 스캔 착지점) ── */
  app.get('/p/:code', async (req, reply) => {
    const { code } = req.params as { code: string };
    return reply.type('text/html').send(pairingPageHtml(code));
  });
}

/**
 * 만료 코드 정리.
 * PAD 10대가 3분마다 코드를 새로 뽑으면 하루치가 쌓이므로 주기적으로 턴다.
 */
export function startPairingSweeper() {
  setInterval(async () => {
    try {
      const n = await sweepExpiredPairings();
      if (n > 0) {
        await run(`INSERT INTO events (type, payload, ts) VALUES ('pairing.swept', $1, $2)`, [JSON.stringify({ n }), now()]);
      }
    } catch (e) {
      console.error('[pairing] sweep failed', e);
    }
  }, 60_000).unref();
}

/**
 * 목업 페어링 페이지.
 * 실제로는 aepick app이 이 자리를 대신한다(딥링크로 app이 열리고 app이 클레임).
 * 지금은 app 연동 전이라 웹 화면에서 계정을 흉내낸다.
 */
export function pairingPageHtml(code: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK</title>
<style>
  :root{--bg:#fff6f5;--card:#fff;--accent:#f2675c;--ink:#2b2b2b;--muted:#8a8a8a}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);
       color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:var(--card);border-radius:20px;padding:32px 24px;max-width:420px;width:100%;
        box-shadow:0 8px 32px rgba(242,103,92,.12);text-align:center}
  h1{font-size:20px;margin:0 0 8px}
  p{color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 24px}
  input{width:100%;padding:14px;font-size:16px;border:1.5px solid #f0dddb;border-radius:12px;
        margin-bottom:12px;text-align:center}
  input:focus{outline:none;border-color:var(--accent)}
  button{width:100%;padding:15px;font-size:16px;font-weight:700;color:#fff;background:var(--accent);
         border:0;border-radius:12px;cursor:pointer}
  button:disabled{opacity:.5}
  .mock{margin-top:20px;padding:12px;background:#fff8e6;border-radius:10px;font-size:12px;
        color:#8a6d3b;line-height:1.5}
  .done{display:none}
  .done h1{color:var(--accent);font-size:24px}
  .big{font-size:40px;margin:8px 0}
  .msg{min-height:20px;color:#d33;font-size:13px;margin-bottom:8px}
</style>
</head>
<body>
<div class="card">
  <div id="form">
    <h1 id="h1"></h1>
    <p id="desc"></p>
    <div class="msg" id="msg"></div>
    <input id="cred" autocomplete="off" autocapitalize="off"/>
    <button id="go"></button>
    <div class="mock" id="mockNotice"></div>
  </div>
  <div id="done" class="done">
    <h1 id="doneTitle"></h1>
    <div class="big">📱 → 🖥️</div>
    <p id="doneDesc"></p>
    <p style="color:var(--accent);font-weight:700" id="visit"></p>
  </div>
</div>
<script>
const CODE=${JSON.stringify(code)};
// API Gateway 등 스테이지 접두사(/prod 등) 뒤에 배포될 수 있어, 절대경로 '/api/...' 대신
// 현재 페이지 경로에서 이 페이지 자신의 경로만 잘라내 접두사를 구한다.
const ROOT=location.pathname.replace('/p/'+CODE,'');
const DICTS=${JSON.stringify(dicts)};
const LANG=(navigator.language||'vi').slice(0,2);
const lookup=(d,p)=>p.split('.').reduce((n,k)=>n&&typeof n==='object'?n[k]:undefined,d);
const t=(k,v)=>{let r=lookup(DICTS[LANG],k)??lookup(DICTS.en,k);if(typeof r!=='string')return k;
  if(v)for(const[a,b]of Object.entries(v))r=r.replaceAll('{'+a+'}',b);return r};
const el=id=>document.getElementById(id);

document.title=t('pairing.pageTitle');
el('h1').textContent=t('pairing.h1');
el('desc').innerHTML=t('pairing.desc');
el('cred').placeholder=t('pairing.credPlaceholder');
el('go').textContent=t('pairing.connectBtn');
el('mockNotice').innerHTML=t('pairing.mockNotice');
el('doneTitle').textContent=t('pairing.doneTitle');
el('doneDesc').innerHTML=t('pairing.doneDesc');

el('go').onclick=async()=>{
  const credential=el('cred').value.trim();
  if(!credential){el('msg').textContent=t('pairing.credRequired');return}
  el('go').disabled=true; el('msg').textContent='';
  try{
    const r=await fetch(ROOT+'/api/pairings/'+CODE+'/claim',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({credential,language:LANG})});
    const j=await r.json();
    if(!j.ok){
      const code=j.error&&j.error.code;
      const known=['not_found','expired','already_claimed'];
      el('msg').textContent=known.includes(code)?t('pairing.errors.'+code):t('pairing.connectFail');
      el('go').disabled=false; return;
    }
    el('form').style.display='none'; el('done').style.display='block';
    if(j.data.visitCount>1) el('visit').textContent=t('pairing.visitWelcome',{n:j.data.visitCount});
  }catch(e){
    el('msg').textContent=t('pairing.netError');
    el('go').disabled=false;
  }
};
el('cred').addEventListener('keydown',e=>{if(e.key==='Enter')el('go').click()});
</script>
</body>
</html>`;
}
