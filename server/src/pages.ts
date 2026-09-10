import { PERSONAS } from '@aepick/shared';
import { ADMIN_KEY_IS_DEFAULT } from './adminKey.js';
import { dicts } from './i18nDicts.js';

/** 모바일 결과 페이지 (/r/:token) */
export function resultPageHtml(token: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>My AEPICK Beauty DNA</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@1,900&display=swap" rel="stylesheet"/>
<style>
:root{--accent:#f25c7c;--accent-deep:#e8446b;--ink:#26191e;--dim:rgba(96,58,72,.6);--card:#ffffff;--border:#f8d9e1}
*{margin:0;padding:0;box-sizing:border-box}
body{background:
  radial-gradient(70% 30% at 10% 0%,rgba(255,255,255,.7) 0%,transparent 65%),
  radial-gradient(60% 25% at 95% 8%,rgba(249,168,190,.5) 0%,transparent 70%),
  linear-gradient(180deg,#fdf2f5 0%,#fae2e9 100%);
  color:var(--ink);font-family:'Pretendard Variable',Pretendard,'Noto Sans KR','Segoe UI',system-ui,sans-serif;min-height:100vh}
.wrap{max-width:480px;margin:0 auto;padding:20px 16px 60px;display:flex;flex-direction:column;gap:18px}
.brand{font-family:'Nunito','Pretendard Variable',sans-serif;font-style:italic;font-weight:900;font-size:30px;color:var(--accent);text-align:center;letter-spacing:-.03em}
.hero{border-radius:20px;overflow:hidden;box-shadow:0 16px 44px rgba(242,92,124,.25)}
.hero img{width:100%;display:block}
h1{font-size:22px;text-align:center;font-weight:800;letter-spacing:-.01em}
h2{font-size:17px;color:var(--accent);font-weight:800;letter-spacing:.02em}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(242,92,124,.12)}
.btn{display:block;width:100%;text-align:center;padding:15px;border-radius:999px;border:none;font-weight:800;font-size:16px;color:#fff;background:linear-gradient(180deg,#fa93ad,var(--accent-deep));box-shadow:0 10px 24px rgba(242,92,124,.3),inset 0 1px 0 rgba(255,255,255,.45);text-decoration:none;cursor:pointer;font-family:inherit}
.btn.ghost{background:#fff;border:1.5px solid var(--border);color:var(--ink);box-shadow:0 4px 14px rgba(242,92,124,.08)}
.row{display:flex;gap:10px}.row .btn{flex:1;font-size:13px;padding:12px 6px}
.dim{color:var(--dim);font-size:13px;line-height:1.5}
.prod{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.prod:last-child{border-bottom:none}
.prod .emoji{font-size:34px}
.brand{padding:14px 0;border-bottom:1px solid var(--border)}
.brand:last-child{border-bottom:none}
.brand-head{display:flex;align-items:center;gap:10px}
.brand-logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px;background:#fdf1f4;border:1px solid var(--border);flex:none}
.brand-name{font-weight:800;font-size:15px;letter-spacing:.02em}
.brand-items{display:flex;flex-direction:column;gap:6px;margin-top:10px;padding-left:54px}
.brand-item{display:flex;align-items:center;gap:8px;font-size:13px}
.brand-item .nm{flex:1;font-weight:600}
.brand-item .pr{color:var(--accent);font-weight:800;font-size:12.5px}
.brand-item a{flex:none;font-size:11px;font-weight:800;color:#fff;background:linear-gradient(180deg,#fa93ad,var(--accent-deep));padding:5px 10px;border-radius:999px;text-decoration:none}
.coupon{border:2px dashed var(--accent);text-align:center;background:#fef0f4;box-shadow:none}
.coupon .code{font-size:24px;font-weight:900;letter-spacing:.12em;color:var(--accent-deep);margin:6px 0}
.danger{color:#c95c77;background:none;border:none;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;margin:8px auto;display:block}
.center{text-align:center}
#loading{text-align:center;padding:80px 0;font-size:15px;color:var(--dim)}
</style>
</head>
<body>
<div class="wrap" id="app"><div id="loading">Loading your Beauty DNA…</div></div>
<script>
const TOKEN=${JSON.stringify(token)};
const DICTS=${JSON.stringify(dicts)};
const PERSONAS=${JSON.stringify(PERSONAS)};
const lookup=(d,p)=>p.split('.').reduce((n,k)=>n&&typeof n==='object'?n[k]:undefined,d);
let LANG='vi';
const t=(k,v)=>{let r=lookup(DICTS[LANG],k)??lookup(DICTS.en,k);if(typeof r!=='string')return k;
  if(v)for(const[a,b]of Object.entries(v))r=r.replaceAll('{'+a+'}',b);return r};

async function main(){
  const res=await fetch('/api/results/'+TOKEN);
  const app=document.getElementById('app');
  if(res.status===410){app.innerHTML='<div id="loading">'+t('resultWeb.expired')+'</div>';return}
  if(!res.ok){app.innerHTML='<div id="loading">Error</div>';return}
  const {data}=await res.json();
  LANG=data.language||'vi';
  const p=PERSONAS[data.persona];
  const hoursLeft=Math.max(0,Math.round((new Date(data.expiresAt)-Date.now())/36e5));
  const desc=(lookup(DICTS[LANG],'dna.personas.'+data.persona+'.desc')||'').replace(/\\n/g,'<br/>');
  const kw=lookup(DICTS[LANG],'dna.personas.'+data.persona+'.keywords')||[];

  // 투표 여부에 따라 CTA 를 바꾼다. QR 은 한 번만 찍고 이 페이지에서 투표까지 간다.
  let voted=false;
  try{ const vs=await fetch('/api/vote/'+TOKEN+'/status'); if(vs.ok) voted=(await vs.json()).data.voted; }catch(e){}

  app.innerHTML=\`
    <div class="brand">aépick</div>
    <h1>\${t('resultWeb.title')}</h1>
    <div class="card center">
      <h2>\${p.name}</h2>
      <p class="dim" style="margin-top:8px">\${desc}</p>
      <p style="margin-top:8px;font-size:13px;color:\${p.primaryColor}">\${kw.map(k=>'#'+k).join(' &nbsp; ')}</p>
    </div>

    <div class="card">
      <h2>\${t('resultWeb.voteTitle')}</h2>
      <p class="dim" style="margin:6px 0 12px">\${voted?t('resultWeb.voteDone'):t('resultWeb.voteDesc')}</p>
      <a class="btn" href="/v/\${TOKEN}\${voted?'/done':''}">\${voted?t('resultWeb.voteDone'):t('resultWeb.voteCta')}</a>
    </div>

    <button class="btn ghost" onclick="shareResult()">↗ \${t('resultWeb.share')}</button>
    <div class="card coupon">
      <div class="dim">\${t('resultWeb.couponTitle')}</div>
      <div class="code">\${data.coupon}</div>
      <div class="dim">\${t('resultWeb.couponDesc')}</div>
    </div>
    <div class="card">
      <h2>\${t('resultWeb.brandsTitle')}</h2>
      <p class="dim" style="margin:4px 0 6px">\${t('resultWeb.brandsDesc')}</p>
      \${(data.brands||[]).map(b=>\`
        <div class="brand">
          <div class="brand-head">
            <div class="brand-logo">\${b.logoUrl?'<img src="'+b.logoUrl+'" alt="" style="width:100%;height:100%;border-radius:14px;object-fit:cover"/>':b.emoji}</div>
            <div style="flex:1">
              <div class="brand-name">\${b.name}</div>
              <div class="dim" style="font-size:12px">\${b.tagline[LANG]||b.tagline.en||''}</div>
            </div>
          </div>
          <div class="brand-items">
            \${b.products.map(p=>\`
              <div class="brand-item">
                <span class="nm">\${p.name[LANG]||p.name.en||''}</span>
                <span class="pr">\${p.price}</span>
                <a target="_blank" rel="noopener" href="\${p.shopUrl}"
                   onclick="fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{type:'product.clicked',payload:{productId:'\${p.id}',brandId:'\${b.id}'},ts:new Date().toISOString()}]})})">SHOP</a>
              </div>\`).join('')}
          </div>
        </div>\`).join('')}
    </div>
    <p class="dim center">\${t('resultWeb.expiresIn',{h:hoursLeft})} · \${t('qr.deleteNotice')}</p>
    <button class="danger" onclick="delMine()">\${t('resultWeb.deleteNow')}</button>\`;
}
async function shareResult(){
  if(navigator.share){try{await navigator.share({title:'My AEPICK Beauty DNA',url:location.href});
    fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{type:'result.shared',payload:{channel:'webshare'},ts:new Date().toISOString()}]})});
  }catch(e){}}else{await navigator.clipboard.writeText(location.href);alert('Link copied!')}
}
async function delMine(){
  if(!confirm(t('resultWeb.deleteConfirm')))return;
  await fetch('/api/results/'+TOKEN,{method:'DELETE'});
  document.getElementById('app').innerHTML='<div id="loading">'+t('resultWeb.deleted')+'</div>';
}
main();
</script>
</body>
</html>`;
}

/** 운영자 대시보드 (/admin) */
export function adminPageHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AEPICK BEAUTY DNA — Operations</title>
<style>
:root{--pink:#ff6f91;--violet:#8a2be2;--mint:#4fd1c5;--ink:#fff;--dim:rgba(255,255,255,.6);--card:rgba(255,255,255,.07);--border:rgba(255,255,255,.14)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#14101f;color:var(--ink);font-family:'Segoe UI',system-ui,sans-serif;padding:24px}
h1{font-size:20px;letter-spacing:.08em}h1 span{color:var(--pink)}
h2{font-size:13px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
.kpi{font-size:34px;font-weight:900}.kpi small{font-size:13px;color:var(--dim);font-weight:400}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)}
th{color:var(--dim);font-weight:600}
.bar{height:10px;border-radius:5px;background:linear-gradient(90deg,var(--mint),var(--pink))}
.muted{color:var(--dim);font-size:12px}
#status{font-size:12px;color:var(--mint)}
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:baseline">
  <h1>AEPICK BEAUTY DNA <span>· OPERATIONS</span></h1>
  <div style="display:flex;align-items:center;gap:12px">
    <button id="exportBtn" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--ink);cursor:pointer;font:inherit">Export Excel</button>
    <div id="status">connecting…</div>
  </div>
</div>
<div class="grid" id="kpis"></div>
<div class="grid">
  <div class="card"><h2>Persona distribution</h2><div id="personas"></div></div>
  <div class="card"><h2>Core Value averages</h2><div id="axes"></div></div>
  <div class="card"><h2>Recent sessions</h2><div id="sessions" style="max-height:280px;overflow:auto"></div></div>
</div>
<script>
let KEY=localStorage.getItem('adminKey')||prompt('Admin key:',${JSON.stringify(ADMIN_KEY_IS_DEFAULT ? 'aepick-admin' : '')});
localStorage.setItem('adminKey',KEY);
const H={'X-Admin-Key':KEY};
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
el('exportBtn').onclick=async()=>{
  const r=await fetch('/api/admin/export/sessions.xlsx',{headers:H});
  if(!r.ok){alert('Export failed');return}
  const blob=await r.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='aepick-sessions.xlsx'; a.click();
  URL.revokeObjectURL(url);
};
const kpi=(label,value,suffix)=>'<div class="card"><h2>'+label+'</h2><div class="kpi">'+(value??'—')+'<small> '+(suffix||'')+'</small></div></div>';

async function refresh(){
  try{
    const [ov,an,se]=await Promise.all([
      fetch('/api/admin/overview',{headers:H}).then(r=>r.json()),
      fetch('/api/admin/analytics',{headers:H}).then(r=>r.json()),
      fetch('/api/admin/sessions',{headers:H}).then(r=>r.json()),
    ]);
    if(!ov.ok){el('status').textContent='auth failed';localStorage.removeItem('adminKey');return}
    const o=ov.data,a=an.data;
    el('status').textContent='live · '+new Date().toLocaleTimeString();
    el('kpis').innerHTML=
      kpi('Started today',o.today.started)+
      kpi('Completed',o.today.completed)+
      kpi('Completion rate',o.completionRate,'%')+
      kpi('Active now',o.today.active)+
      kpi('Avg duration',o.avgDurationSec,'sec')+
      kpi('Abandoned',o.today.abandoned)+
      kpi('QR scan rate',o.qr.scanRate,'%')+
      kpi('Downloads',o.downloads)+
      kpi('Retake rate',o.retakeRate,'%');
    const maxP=Math.max(1,...a.personaDistribution.map(p=>p.n));
    el('personas').innerHTML=a.personaDistribution.length?a.personaDistribution.map(p=>
      '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+p.persona+'</span><b>'+p.n+'</b></div><div class="bar" style="width:'+(p.n/maxP*100)+'%"></div></div>').join(''):'<p class="muted">no data</p>';
    el('axes').innerHTML=Object.entries(a.axisAverages).map(([k,v])=>
      '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>'+k+'</span><b>'+(v??'—')+'</b></div><div class="bar" style="width:'+(v||0)+'%"></div></div>').join('');
    el('sessions').innerHTML='<table><tr><th>time</th><th>status</th><th>persona</th><th>lang</th><th>name</th><th>gender</th><th>age</th></tr>'+
      se.data.sessions.map(s=>'<tr><td>'+s.started_at.slice(11,19)+'</td><td>'+s.status+'</td><td>'+(s.persona||'—')+'</td><td>'+s.language+'</td><td>'+esc(s.full_name||'—')+'</td><td>'+esc(s.gender||'—')+'</td><td>'+esc(s.age_group||'—')+'</td></tr>').join('')+'</table>';
  }catch(e){el('status').textContent='offline'}
}
refresh();setInterval(refresh,10000);
</script>
</body>
</html>`;
}
