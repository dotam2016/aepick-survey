import { VOTE_PICK_COUNT } from './voteRoutes.js';

/**
 * 투표 페이지 (스펙 8·9번)
 *
 * 고객은 브랜드 체험을 마친 뒤 결과 페이지에서 이 화면으로 들어온다.
 * 팝업 운영 브랜드 전체와 각 제품이 보이고, 3개를 골라 투표한다.
 * QR을 다시 찍지 않도록 결과 페이지와 같은 토큰을 그대로 쓴다.
 */

const SHELL_CSS = `
  :root{--bg:#fff5f7;--card:#fff;--accent:#f25c7c;--ink:#2b2b2b;--muted:#8a8a8a;--line:#f2e3e7}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);
       color:var(--ink);padding:0 0 96px}
  header{padding:22px 20px 14px;text-align:center}
  h1{font-size:20px;margin:0 0 6px;line-height:1.35}
  .sub{color:var(--muted);font-size:13.5px;line-height:1.6;margin:0}
  .wrap{padding:0 16px}
  .brand{background:var(--card);border-radius:16px;padding:14px;margin-bottom:12px;border:1px solid var(--line)}
  .bh{display:flex;align-items:center;gap:9px;margin-bottom:10px}
  .bh .logo{width:34px;height:34px;border-radius:9px;object-fit:cover;flex:none}
  .bh .emoji{font-size:22px;width:34px;text-align:center;flex:none}
  .bh .nm{font-weight:800;font-size:15px}
  .bh .tl{font-size:11.5px;color:var(--muted);margin-top:1px}
  .p{display:flex;align-items:center;gap:10px;padding:10px;border:1.5px solid var(--line);
     border-radius:12px;margin-bottom:7px;cursor:pointer;user-select:none;transition:.14s}
  .p:last-child{margin-bottom:0}
  .p.on{border-color:var(--accent);background:#fff0f4}
  .p .box{width:21px;height:21px;border-radius:6px;border:2px solid #e6cdd4;flex:none;
          display:grid;place-items:center;font-size:12px;color:#fff}
  .p.on .box{background:var(--accent);border-color:var(--accent)}
  .p .pn{flex:1;font-size:13.5px;font-weight:600;line-height:1.35}
  .p .pp{font-size:12px;color:var(--muted);flex:none}
  .p img{width:40px;height:40px;border-radius:8px;object-fit:cover;flex:none}
  .bar{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.97);border-top:1px solid var(--line);
       padding:12px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:12px;align-items:center}
  .cnt{font-size:13px;font-weight:700;flex:none}
  .cnt b{color:var(--accent);font-size:17px}
  button.go{flex:1;padding:14px;font-size:15px;font-weight:800;color:#fff;background:var(--accent);
            border:0;border-radius:12px;cursor:pointer}
  button.go:disabled{background:#e8d3d9;cursor:default}
  .msg{text-align:center;padding:40px 20px;color:var(--muted);font-size:14px}
`;

export function votePageHtml(token: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK — 제품 투표</title>
<style>${SHELL_CSS}</style>
</head>
<body>
<header>
  <h1>가장 마음에 든 제품 ${VOTE_PICK_COUNT}가지를 골라주세요</h1>
  <p class="sub">직접 체험해 보신 제품 중에서 선택해 주세요.<br/>투표를 마치면 직원에게 화면을 보여주세요.</p>
</header>
<div class="wrap" id="list"><div class="msg">불러오는 중…</div></div>
<div class="bar" id="bar" style="display:none">
  <span class="cnt"><b id="n">0</b> / ${VOTE_PICK_COUNT}</span>
  <button class="go" id="go" disabled>투표하기</button>
</div>
<script>
const TOKEN=${JSON.stringify(token)};
const NEED=${VOTE_PICK_COUNT};
const LANG=(navigator.language||'vi').slice(0,2);
const picked=new Set();
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nameOf=o=>esc((o&&(o[LANG]||o.vi||o.en||o.ko))||'');

async function load(){
  const r=await fetch('/api/vote/'+TOKEN+'/options');
  if(!r.ok){el('list').innerHTML='<div class="msg">투표 정보를 불러오지 못했습니다.<br/>직원에게 문의해 주세요.</div>';return}
  const d=(await r.json()).data;
  if(d.alreadyVoted){location.replace('/v/'+TOKEN+'/done');return}
  el('list').innerHTML=d.brands.map(b=>\`
    <div class="brand">
      <div class="bh">
        \${b.logoUrl?\`<img class="logo" src="\${esc(b.logoUrl)}" alt=""/>\`:\`<span class="emoji">\${esc(b.emoji)}</span>\`}
        <div><div class="nm">\${esc(b.name)}</div><div class="tl">\${nameOf(b.tagline)}</div></div>
      </div>
      \${b.products.map(p=>\`
        <div class="p" data-id="\${esc(p.id)}" onclick="tog(this)">
          <span class="box">✓</span>
          \${p.imageUrl?\`<img src="\${esc(p.imageUrl)}" alt=""/>\`:''}
          <span class="pn">\${nameOf(p.name)}</span>
          <span class="pp">\${esc(p.price)}</span>
        </div>\`).join('')}
    </div>\`).join('');
  el('bar').style.display='flex';
}

function tog(node){
  const id=node.dataset.id;
  if(picked.has(id)){picked.delete(id);node.classList.remove('on')}
  else{
    if(picked.size>=NEED){alert(NEED+'개까지만 고를 수 있어요. 바꾸시려면 선택을 해제해 주세요.');return}
    picked.add(id);node.classList.add('on');
  }
  el('n').textContent=picked.size;
  el('go').disabled=picked.size!==NEED;
}

el('go').onclick=async()=>{
  el('go').disabled=true; el('go').textContent='전송 중…';
  try{
    const r=await fetch('/api/vote/'+TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({productIds:[...picked]})});
    const j=await r.json();
    if(!j.ok&&j.error&&j.error.code!=='already_voted'){
      alert('투표에 실패했습니다. 다시 시도해 주세요.');
      el('go').disabled=false; el('go').textContent='투표하기'; return;
    }
    location.replace('/v/'+TOKEN+'/done');
  }catch(e){
    alert('네트워크 오류입니다. 다시 시도해 주세요.');
    el('go').disabled=false; el('go').textContent='투표하기';
  }
};
load();
</script>
</body>
</html>`;
}

/**
 * 투표 완료 페이지 (스펙 10번)
 *
 * 고객에게는 완료 확인만 보인다.
 * 우측 하단에 직원 전용 영역이 있고, 길게 눌러 PIN을 넣으면
 * 이 고객이 몇 번째 방문인지 확인할 수 있다.
 *
 * 짧은 탭이 아니라 길게 누르기로 연 이유: 고객이 스크롤하다 우연히
 * 눌러 재방문 횟수가 노출되면 곤란하기 때문.
 */
export function voteDonePageHtml(token: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK — 투표 완료</title>
<style>${SHELL_CSS}
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:var(--card);border-radius:20px;padding:32px 22px;max-width:420px;width:100%;
        box-shadow:0 8px 32px rgba(242,92,124,.12);text-align:center}
  .big{font-size:46px;margin:4px 0 10px}
  .card h1{color:var(--accent);font-size:23px}
  .picks{margin-top:18px;text-align:left}
  .pick{display:flex;gap:9px;align-items:center;padding:9px 11px;border:1px solid var(--line);
        border-radius:11px;margin-bottom:7px;font-size:13.5px}
  .pick .e{font-size:17px}
  .pick .b{color:var(--muted);font-size:11.5px}
  .note{margin-top:20px;padding:13px;background:#fff0f4;border-radius:12px;font-size:13px;
        color:#b04a63;line-height:1.55;font-weight:600}
  /* 직원 전용 — 눈에 띄지 않게 두되 위치는 고정 */
  .staff{position:fixed;right:0;bottom:0;width:64px;height:64px;opacity:0;cursor:default}
  .sheet{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;padding:24px}
  .sheet.on{display:flex}
  .sbox{background:#fff;border-radius:16px;padding:22px;max-width:360px;width:100%}
  .sbox h2{font-size:16px;margin:0 0 12px}
  .sbox input{width:100%;padding:12px;font-size:16px;border:1.5px solid var(--line);border-radius:10px;
              text-align:center;margin-bottom:10px}
  .sbox button{width:100%;padding:12px;font-size:14px;font-weight:700;border-radius:10px;border:0;
               background:var(--accent);color:#fff;cursor:pointer;margin-bottom:8px}
  .sbox button.sec{background:#f2f2f2;color:#555}
  .visit{font-size:15px;line-height:1.7}
  .visit .n{font-size:40px;font-weight:900;color:var(--accent);display:block;margin:6px 0}
  .serr{color:#c33;font-size:13px;min-height:18px}
</style>
</head>
<body>
<div class="card">
  <div class="big">🎉</div>
  <h1>투표 완료!</h1>
  <p class="sub">소중한 의견 감사합니다.<br/><b>이 화면을 직원에게 보여주세요.</b></p>
  <div class="picks" id="picks"></div>
  <div class="note" id="note">직원 확인 후 사은품을 받으실 수 있어요.</div>
</div>

<div class="staff" id="staff"></div>
<div class="sheet" id="sheet">
  <div class="sbox">
    <h2>직원 확인</h2>
    <div id="sform">
      <input id="pin" type="tel" inputmode="numeric" placeholder="PIN" autocomplete="off"/>
      <div class="serr" id="serr"></div>
      <button onclick="lookup()">확인</button>
      <button class="sec" onclick="closeSheet()">닫기</button>
    </div>
    <div id="sres" style="display:none">
      <div class="visit">이 고객은 <span class="n" id="vc">—</span>번째 방문입니다.</div>
      <div class="sub" id="vsub" style="margin:10px 0 14px"></div>
      <button id="rewardBtn" onclick="claim()">사은품 지급 처리</button>
      <button class="sec" onclick="closeSheet()">닫기</button>
    </div>
  </div>
</div>

<script>
const TOKEN=${JSON.stringify(token)};
const LANG=(navigator.language||'vi').slice(0,2);
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nameOf=o=>esc((o&&(o[LANG]||o.vi||o.en||o.ko))||'');
let PIN='';

(async function(){
  const r=await fetch('/api/vote/'+TOKEN+'/status');
  if(!r.ok)return;
  const d=(await r.json()).data;
  if(!d.voted){location.replace('/v/'+TOKEN);return}
  el('picks').innerHTML=d.picks.map(p=>
    '<div class="pick"><span class="e">'+esc(p.emoji)+'</span><span>'+nameOf(p.name)+
    '<div class="b">'+esc(p.brand)+'</div></span></div>').join('');
  if(d.rewardClaimedAt) el('note').textContent='사은품 지급이 완료되었습니다.';
})();

/* 길게 누르기(1.2초)로만 열린다 — 고객의 우연한 터치 방지 */
(function(){
  const z=el('staff'); let timer=null;
  const start=()=>{timer=setTimeout(()=>{el('sheet').classList.add('on');el('pin').focus()},1200)};
  const stop=()=>{clearTimeout(timer)};
  z.addEventListener('pointerdown',start);
  ['pointerup','pointerleave','pointercancel'].forEach(e=>z.addEventListener(e,stop));
})();

function closeSheet(){el('sheet').classList.remove('on');el('sform').style.display='block';
  el('sres').style.display='none';el('pin').value='';el('serr').textContent='';PIN=''}

async function lookup(){
  PIN=el('pin').value.trim();
  const r=await fetch('/api/vote/'+TOKEN+'/staff',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin:PIN})});
  const j=await r.json();
  if(!j.ok){el('serr').textContent='PIN이 올바르지 않습니다.';return}
  el('sform').style.display='none'; el('sres').style.display='block';
  el('vc').textContent=j.data.visitCount;
  el('vsub').textContent=j.data.rewardClaimedAt
    ? '사은품 지급 완료 ('+new Date(j.data.rewardClaimedAt).toLocaleString()+')'
    : '아직 사은품이 지급되지 않았습니다.';
  el('rewardBtn').disabled=!!j.data.rewardClaimedAt;
}

async function claim(){
  const r=await fetch('/api/vote/'+TOKEN+'/reward',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin:PIN,staff:''})});
  const j=await r.json();
  if(!j.ok){
    el('vsub').textContent = j.error && j.error.code==='already_claimed'
      ? '이미 지급된 고객입니다.' : '처리에 실패했습니다.';
    el('rewardBtn').disabled=true; return;
  }
  el('vsub').textContent='사은품 지급 처리되었습니다.';
  el('rewardBtn').disabled=true;
  el('note').textContent='사은품 지급이 완료되었습니다.';
}
</script>
</body>
</html>`;
}
