import { VOTE_PICK_COUNT } from './voteRoutes.js';
import { dicts } from './i18nDicts.js';

/**
 * 투표 페이지 (스펙 8·9번)
 *
 * 고객은 브랜드 체험을 마친 뒤 결과 페이지에서 이 화면으로 들어온다.
 * 팝업 운영 브랜드 전체와 각 제품이 보이고, 3개를 골라 투표한다.
 * QR을 다시 찍지 않도록 결과 페이지와 같은 토큰을 그대로 쓴다.
 */

const SHELL_CSS = `
  :root{--bg:#fff6f5;--card:#fff;--accent:#f2675c;--ink:#2b2b2b;--muted:#8a8a8a;--line:#f2e4e3}
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
  .p.on{border-color:var(--accent);background:#fff1f0}
  .p .box{width:21px;height:21px;border-radius:6px;border:2px solid #e6cfcd;flex:none;
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
  button.go:disabled{background:#e8d5d3;cursor:default}
  .msg{text-align:center;padding:40px 20px;color:var(--muted);font-size:14px}
`;

/** 클라이언트 스크립트에서 쓰는 다국어 조회 헬퍼 (server/src/pages.ts와 동일 규약). */
const I18N_HELPERS = `
const DICTS=${JSON.stringify(dicts)};
const LANG=(navigator.language||'vi').slice(0,2);
const lookup=(d,p)=>p.split('.').reduce((n,k)=>n&&typeof n==='object'?n[k]:undefined,d);
const t=(k,v)=>{let r=lookup(DICTS[LANG],k)??lookup(DICTS.en,k);if(typeof r!=='string')return k;
  if(v)for(const[a,b]of Object.entries(v))r=r.replaceAll('{'+a+'}',b);return r};
`;

export function votePageHtml(token: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK</title>
<style>${SHELL_CSS}</style>
</head>
<body>
<header>
  <h1 id="h1"></h1>
  <p class="sub" id="sub"></p>
</header>
<div class="wrap" id="list"><div class="msg" id="loadingMsg"></div></div>
<div class="bar" id="bar" style="display:none">
  <span class="cnt"><b id="n">0</b> / ${VOTE_PICK_COUNT}</span>
  <button class="go" id="go" disabled></button>
</div>
<script>
const TOKEN=${JSON.stringify(token)};
const NEED=${VOTE_PICK_COUNT};
${I18N_HELPERS}
const picked=new Set();
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nameOf=o=>esc((o&&(o[LANG]||o.vi||o.en||o.ko))||'');

document.title=t('vote.pageTitle');
el('h1').innerHTML=t('vote.pickTitle',{n:NEED});
el('sub').innerHTML=t('vote.pickSub');
el('loadingMsg').textContent=t('vote.loading');
el('go').textContent=t('vote.voteBtn');

async function load(){
  const r=await fetch('/api/vote/'+TOKEN+'/options');
  if(!r.ok){el('list').innerHTML='<div class="msg">'+t('vote.loadError')+'</div>';return}
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
    if(picked.size>=NEED){alert(t('vote.limitAlert',{n:NEED}));return}
    picked.add(id);node.classList.add('on');
  }
  el('n').textContent=picked.size;
  el('go').disabled=picked.size!==NEED;
}

el('go').onclick=async()=>{
  el('go').disabled=true; el('go').textContent=t('vote.voteBtnSending');
  try{
    const r=await fetch('/api/vote/'+TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({productIds:[...picked]})});
    const j=await r.json();
    if(!j.ok&&j.error&&j.error.code!=='already_voted'){
      alert(t('vote.voteFail'));
      el('go').disabled=false; el('go').textContent=t('vote.voteBtn'); return;
    }
    location.replace('/v/'+TOKEN+'/done');
  }catch(e){
    alert(t('vote.netError'));
    el('go').disabled=false; el('go').textContent=t('vote.voteBtn');
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
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>AEPICK</title>
<style>${SHELL_CSS}
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:var(--card);border-radius:20px;padding:32px 22px;max-width:420px;width:100%;
        box-shadow:0 8px 32px rgba(242,103,92,.12);text-align:center}
  .big{font-size:46px;margin:4px 0 10px}
  .card h1{color:var(--accent);font-size:23px}
  .picks{margin-top:18px;text-align:left}
  .pick{display:flex;gap:9px;align-items:center;padding:9px 11px;border:1px solid var(--line);
        border-radius:11px;margin-bottom:7px;font-size:13.5px}
  .pick .e{font-size:17px}
  .pick .b{color:var(--muted);font-size:11.5px}
  .note{margin-top:20px;padding:13px;background:#fff1f0;border-radius:12px;font-size:13px;
        color:#b0514a;line-height:1.55;font-weight:600}
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
  <h1 id="doneH1"></h1>
  <p class="sub" id="doneSub"></p>
  <div class="picks" id="picks"></div>
  <div class="note" id="note"></div>
</div>

<div class="staff" id="staff"></div>
<div class="sheet" id="sheet">
  <div class="sbox">
    <h2 id="staffTitle"></h2>
    <div id="sform">
      <input id="pin" type="tel" inputmode="numeric" autocomplete="off"/>
      <div class="serr" id="serr"></div>
      <button id="confirmBtn" onclick="staffLookup()"></button>
      <button class="sec" id="closeBtn1" onclick="closeSheet()"></button>
    </div>
    <div id="sres" style="display:none">
      <div class="visit" id="visitLine"></div>
      <div class="sub" id="vsub" style="margin:10px 0 14px"></div>
      <button id="rewardBtn" onclick="claim()"></button>
      <button class="sec" id="closeBtn2" onclick="closeSheet()"></button>
    </div>
  </div>
</div>

<script>
const TOKEN=${JSON.stringify(token)};
${I18N_HELPERS}
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nameOf=o=>esc((o&&(o[LANG]||o.vi||o.en||o.ko))||'');
let PIN='';

document.title=t('vote.donePageTitle');
el('doneH1').textContent=t('vote.doneTitle');
el('doneSub').innerHTML=t('vote.doneSub');
el('note').textContent=t('vote.rewardNote');
el('staffTitle').textContent=t('vote.staff.title');
el('pin').placeholder=t('vote.staff.pinPlaceholder');
el('confirmBtn').textContent=t('vote.staff.confirmBtn');
el('closeBtn1').textContent=t('vote.staff.closeBtn');
el('closeBtn2').textContent=t('vote.staff.closeBtn');
el('rewardBtn').textContent=t('vote.staff.rewardBtn');

(async function(){
  const r=await fetch('/api/vote/'+TOKEN+'/status');
  if(!r.ok)return;
  const d=(await r.json()).data;
  if(!d.voted){location.replace('/v/'+TOKEN);return}
  el('picks').innerHTML=d.picks.map(p=>
    '<div class="pick"><span class="e">'+esc(p.emoji)+'</span><span>'+nameOf(p.name)+
    '<div class="b">'+esc(p.brand)+'</div></span></div>').join('');
  if(d.rewardClaimedAt) el('note').textContent=t('vote.rewardDone');
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

async function staffLookup(){
  PIN=el('pin').value.trim();
  const r=await fetch('/api/vote/'+TOKEN+'/staff',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin:PIN})});
  const j=await r.json();
  if(!j.ok){el('serr').textContent=t('vote.staff.pinError');return}
  el('sform').style.display='none'; el('sres').style.display='block';
  el('visitLine').innerHTML=t('vote.staff.visitLine',{n:'<span class="n" id="vc">'+j.data.visitCount+'</span>'});
  el('vsub').textContent=j.data.rewardClaimedAt
    ? t('vote.staff.rewardClaimedAt',{date:new Date(j.data.rewardClaimedAt).toLocaleString()})
    : t('vote.staff.rewardNotYet');
  el('rewardBtn').disabled=!!j.data.rewardClaimedAt;
}

async function claim(){
  const r=await fetch('/api/vote/'+TOKEN+'/reward',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin:PIN,staff:''})});
  const j=await r.json();
  if(!j.ok){
    el('vsub').textContent = j.error && j.error.code==='already_claimed'
      ? t('vote.staff.alreadyClaimed') : t('vote.staff.claimFail');
    el('rewardBtn').disabled=true; return;
  }
  el('vsub').textContent=t('vote.staff.claimSuccess');
  el('rewardBtn').disabled=true;
  el('note').textContent=t('vote.rewardDone');
}
</script>
</body>
</html>`;
}
