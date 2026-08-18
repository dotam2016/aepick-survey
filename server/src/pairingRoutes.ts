import type { FastifyInstance, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { db, now } from './db.js';
import { identityProvider, isIdentityMocked } from './identity.js';
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
    const pairing = issuePairing(device);
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
    const pairing = getPairing(code);
    if (!pairing) return reply.code(404).send(err('not_found', 'unknown pairing code'));

    if (pairing.status !== 'claimed') {
      return ok({ status: pairing.status, expiresAt: pairing.expires_at });
    }
    const visitor = db.prepare(`SELECT visit_count n FROM visitors WHERE id=?`)
      .get(pairing.visitor_id!) as { n: number } | undefined;
    const session = db.prepare(`SELECT language FROM sessions WHERE id=?`)
      .get(pairing.session_id!) as { language: string } | undefined;
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

    const result = claimPairing(code, identity, language ?? 'vi');
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
    const cancelled = cancelPairings(deviceId?.trim() || 'unknown');
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
  setInterval(() => {
    const n = sweepExpiredPairings();
    if (n > 0) {
      db.prepare(`INSERT INTO events (type, payload, ts) VALUES ('pairing.swept', ?, ?)`)
        .run(JSON.stringify({ n }), now());
    }
  }, 60_000).unref();
}

/**
 * 목업 페어링 페이지.
 * 실제로는 aepick app이 이 자리를 대신한다(딥링크로 app이 열리고 app이 클레임).
 * 지금은 app 연동 전이라 웹 화면에서 계정을 흉내낸다.
 */
function pairingPageHtml(code: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK — 체험 시작</title>
<style>
  :root{--bg:#fff5f7;--card:#fff;--accent:#f25c7c;--ink:#2b2b2b;--muted:#8a8a8a}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);
       color:var(--ink);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:var(--card);border-radius:20px;padding:32px 24px;max-width:420px;width:100%;
        box-shadow:0 8px 32px rgba(242,92,124,.12);text-align:center}
  h1{font-size:20px;margin:0 0 8px}
  p{color:var(--muted);font-size:14px;line-height:1.6;margin:0 0 24px}
  input{width:100%;padding:14px;font-size:16px;border:1.5px solid #f0dbe0;border-radius:12px;
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
    <h1>체험을 시작합니다</h1>
    <p>aepick 앱 계정을 연결하면<br/>패드에서 바로 시작됩니다.</p>
    <div class="msg" id="msg"></div>
    <input id="cred" placeholder="앱 계정 ID" autocomplete="off" autocapitalize="off"/>
    <button id="go">연결하기</button>
    <div class="mock">
      <b>목업 화면입니다.</b><br/>
      실제로는 aepick 앱이 열려 로그인된 계정으로 자동 연결됩니다.
      지금은 아무 ID나 넣으면 됩니다. 같은 ID로 다시 하면 재방문으로 집계됩니다.
    </div>
  </div>
  <div id="done" class="done">
    <h1>연결 완료</h1>
    <div class="big">📱 → 🖥️</div>
    <p><b>패드 화면을 봐주세요.</b><br/>체험이 시작되었습니다.<br/>
       휴대폰은 넣어두셔도 됩니다. 체험이 끝나면 결과 QR을 안내해 드립니다.</p>
    <p style="color:var(--accent);font-weight:700" id="visit"></p>
  </div>
</div>
<script>
const CODE=${JSON.stringify(code)};
const el=id=>document.getElementById(id);
el('go').onclick=async()=>{
  const credential=el('cred').value.trim();
  if(!credential){el('msg').textContent='계정 ID를 입력해 주세요';return}
  el('go').disabled=true; el('msg').textContent='';
  try{
    const r=await fetch('/api/pairings/'+CODE+'/claim',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({credential,language:(navigator.language||'vi').slice(0,2)})});
    const j=await r.json();
    if(!j.ok){
      const m={not_found:'유효하지 않은 QR입니다. 패드의 QR을 다시 찍어주세요.',
               expired:'QR이 만료되었습니다. 패드의 새 QR을 찍어주세요.',
               already_claimed:'이미 사용된 QR입니다. 패드의 새 QR을 찍어주세요.'};
      el('msg').textContent=m[j.error&&j.error.code]||'연결에 실패했습니다. 다시 시도해 주세요.';
      el('go').disabled=false; return;
    }
    el('form').style.display='none'; el('done').style.display='block';
    if(j.data.visitCount>1) el('visit').textContent=j.data.visitCount+'번째 방문이시네요. 반갑습니다!';
  }catch(e){
    el('msg').textContent='네트워크 오류입니다. 다시 시도해 주세요.';
    el('go').disabled=false;
  }
};
el('cred').addEventListener('keydown',e=>{if(e.key==='Enter')el('go').click()});
</script>
</body>
</html>`;
}
