import type { FastifyInstance } from 'fastify';
import { run, now } from './db.js';
import { ADMIN_KEY } from './adminKey.js';
import {
  deleteBrand, deleteProduct, listBrands, upsertBrand, upsertProduct,
  type BrandInput, type ProductInput,
} from './catalog.js';

const ok = (data: unknown) => ({ ok: true, data });
const err = (code: string, message: string) => ({ ok: false, error: { code, message } });

/**
 * 브랜드·제품 카탈로그 관리 API + 편집 화면.
 *
 * 운영자가 코드 배포 없이 입점 브랜드와 제품을 직접 넣고 고칠 수 있게 한다.
 * 인증은 어드민 대시보드와 같은 키(X-Admin-Key)를 쓴다.
 */
export function registerCatalogRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/catalog/admin')) return;
    if (req.headers['x-admin-key'] !== ADMIN_KEY)
      return reply.code(401).send(err('unauthorized', 'invalid admin key'));
  });

  /* ── 공개: 투표 페이지 등에서 쓰는 활성 카탈로그 ── */
  app.get('/api/catalog', async () => ok({ brands: await listBrands(true) }));

  /* ── 관리: 비활성 포함 전체 ── */
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

  /* ── 편집 화면 ── */
  app.get('/admin/catalog', async (_req, reply) => reply.type('text/html').send(catalogPageHtml()));
}

const PERSONA_IDS = [
  'loyalGlowKeeper', 'smartBeautyCurator', 'trendMuse',
  'localBeautyExpert', 'trustGuardian', 'beautyExplorer',
];
const AXIS_IDS = ['repick', 'value', 'care', 'trend', 'localFit', 'trust'];

export function catalogPageHtml(): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AEPICK — 브랜드·제품 관리</title>
<style>
  :root{--bg:#faf7f7;--card:#fff;--accent:#f2675c;--ink:#2b2b2b;--muted:#8a8a8a;--line:#eee}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--ink);padding:20px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:var(--muted);font-size:13px;margin-bottom:18px}
  .bar{display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
  button{padding:8px 14px;font-size:13px;font-weight:600;border-radius:8px;border:1px solid var(--line);
         background:#fff;cursor:pointer}
  button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
  button.danger{color:#c33;border-color:#f2d0d0}
  .brand{background:var(--card);border-radius:14px;padding:16px;margin-bottom:14px;border:1px solid var(--line)}
  .brow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
  .brow input.nm{font-weight:700;font-size:15px;width:190px}
  input,select{padding:7px 9px;border:1px solid var(--line);border-radius:7px;font-size:13px;font-family:inherit}
  input.wide{width:100%}
  .grid{display:grid;grid-template-columns:90px 1fr;gap:6px 10px;align-items:center;margin:8px 0}
  .lbl{font-size:12px;color:var(--muted)}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th,td{padding:6px 6px;border-bottom:1px solid var(--line);font-size:13px;text-align:left}
  th{color:var(--muted);font-weight:600;font-size:11.5px}
  .tags{display:flex;gap:6px;flex-wrap:wrap}
  .tag{font-size:11.5px;padding:3px 8px;border-radius:99px;border:1px solid var(--line);cursor:pointer;user-select:none}
  .tag.on{background:var(--accent);color:#fff;border-color:var(--accent)}
  .aff{display:flex;gap:6px;align-items:center;font-size:12px}
  .status{position:fixed;right:16px;bottom:16px;background:#333;color:#fff;padding:9px 14px;border-radius:8px;
          font-size:13px;opacity:0;transition:.2s}
  .status.on{opacity:1}
  .off{opacity:.5}
</style>
</head>
<body>
<h1>브랜드 · 제품 관리</h1>
<div class="sub">여기서 넣은 내용이 결과 추천 화면과 투표 페이지에 그대로 나옵니다. 저장하면 즉시 반영됩니다.</div>
<div class="bar">
  <button class="primary" onclick="addBrand()">+ 브랜드 추가</button>
  <button onclick="load()">새로고침</button>
  <span class="sub" style="margin:0" id="count"></span>
</div>
<div id="list"></div>
<div class="status" id="status"></div>
<script>
const PERSONAS=${JSON.stringify(PERSONA_IDS)};
const AXES=${JSON.stringify(AXIS_IDS)};
const LANGS=['ko','en','vi'];
let KEY=localStorage.getItem('adminKey')||prompt('Admin key:','');
localStorage.setItem('adminKey',KEY);
const H={'X-Admin-Key':KEY,'Content-Type':'application/json'};
// 본문 없는 DELETE 에 Content-Type: application/json 을 붙이면
// Fastify 가 "Body cannot be empty" 로 400 을 낸다. 인증 헤더만 보낸다.
const HD={'X-Admin-Key':KEY};
// API Gateway 등 스테이지 접두사(/prod 등) 뒤에 배포될 수 있어, 절대경로 '/api/...' 대신
// 현재 페이지 경로에서 이 페이지 자신의 경로만 잘라내 접두사를 구한다.
const ROOT=location.pathname.replace('/admin/catalog','');
let DATA=[];
const el=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function toast(m){const s=el('status');s.textContent=m;s.classList.add('on');setTimeout(()=>s.classList.remove('on'),1600)}

async function load(){
  const r=await fetch(ROOT+'/api/catalog/admin',{headers:H});
  if(r.status===401){localStorage.removeItem('adminKey');alert('관리자 키가 올바르지 않습니다.');location.reload();return}
  const j=await r.json();
  DATA=j.data.brands;
  el('count').textContent='브랜드 '+DATA.length+'개 · 제품 '+DATA.reduce((n,b)=>n+b.products.length,0)+'개';
  render();
}

function render(){
  el('list').innerHTML=DATA.map((b,bi)=>\`
  <div class="brand \${b.active?'':'off'}" data-b="\${bi}">
    <div class="brow">
      <input class="nm" value="\${esc(b.name)}" onchange="setB(\${bi},'name',this.value)" placeholder="브랜드명"/>
      <input style="width:52px;text-align:center" value="\${esc(b.emoji)}" onchange="setB(\${bi},'emoji',this.value)" title="이모지(로고 전 임시)"/>
      <input style="width:230px" value="\${esc(b.logoUrl||'')}" onchange="setB(\${bi},'logoUrl',this.value)" placeholder="로고 이미지 경로(디자이너)"/>
      <label class="lbl"><input type="checkbox" \${b.active?'checked':''} onchange="setB(\${bi},'active',this.checked)"/> 노출</label>
      <span style="flex:1"></span>
      <button class="primary" onclick="saveB(\${bi})">저장</button>
      <button class="danger" onclick="delB(\${bi})">삭제</button>
    </div>
    <div class="grid">
      \${LANGS.map(l=>\`<span class="lbl">소개 \${l}</span>
        <input class="wide" value="\${esc((b.tagline||{})[l]||'')}" onchange="setTag(\${bi},'\${l}',this.value)"/>\`).join('')}
    </div>
    <div class="lbl" style="margin-top:8px">추천 대상 DNA</div>
    <div class="tags">\${PERSONAS.map(p=>\`<span class="tag \${(b.personaTags||[]).includes(p)?'on':''}" onclick="togP(\${bi},'\${p}')">\${p}</span>\`).join('')}</div>
    <div class="lbl" style="margin-top:10px">축 친화도 (0~1, 비우면 없음)</div>
    <div class="tags">\${AXES.map(a=>\`<span class="aff">\${a}
      <input style="width:56px" type="number" step="0.05" min="0" max="1" value="\${(b.axisAffinity||{})[a]??''}" onchange="setAff(\${bi},'\${a}',this.value)"/></span>\`).join('')}</div>
    <table>
      <tr><th>제품명 (ko / en / vi)</th><th style="width:100px">정가 (취소선)</th><th style="width:100px">판매가 (팝업 전용)</th><th style="width:150px">구매 링크</th><th style="width:60px">노출</th><th style="width:110px"></th></tr>
      \${b.products.map((p,pi)=>\`<tr>
        <td>\${LANGS.map(l=>\`<input style="width:31%" value="\${esc((p.name||{})[l]||'')}" onchange="setP(\${bi},\${pi},'name.\${l}',this.value)" placeholder="\${l}"/>\`).join(' ')}</td>
        <td><input style="width:100%" value="\${esc(p.listPrice)}" onchange="setP(\${bi},\${pi},'listPrice',this.value)"/></td>
        <td><input style="width:100%" value="\${esc(p.price)}" onchange="setP(\${bi},\${pi},'price',this.value)"/></td>
        <td><input style="width:100%" value="\${esc(p.shopUrl)}" onchange="setP(\${bi},\${pi},'shopUrl',this.value)"/></td>
        <td><input type="checkbox" \${p.active?'checked':''} onchange="setP(\${bi},\${pi},'active',this.checked)"/></td>
        <td><button onclick="saveP(\${bi},\${pi})">저장</button> <button class="danger" onclick="delP(\${bi},\${pi})">×</button></td>
      </tr>\`).join('')}
    </table>
    <button style="margin-top:8px" onclick="addProduct(\${bi})">+ 제품 추가</button>
  </div>\`).join('');
}

const setB=(bi,k,v)=>{DATA[bi][k]=v};
const setTag=(bi,l,v)=>{DATA[bi].tagline=DATA[bi].tagline||{};DATA[bi].tagline[l]=v};
const setAff=(bi,a,v)=>{DATA[bi].axisAffinity=DATA[bi].axisAffinity||{};
  if(v===''){delete DATA[bi].axisAffinity[a]}else{DATA[bi].axisAffinity[a]=Number(v)}};
function togP(bi,p){const t=DATA[bi].personaTags||[];const i=t.indexOf(p);
  if(i<0)t.push(p);else t.splice(i,1);DATA[bi].personaTags=t;render()}
function setP(bi,pi,path,v){const p=DATA[bi].products[pi];
  if(path.startsWith('name.')){p.name=p.name||{};p.name[path.slice(5)]=v}else{p[path]=v}}

async function saveB(bi){
  const b=DATA[bi];
  const r=await fetch(ROOT+'/api/catalog/admin/brands/'+encodeURIComponent(b.id),{method:'PUT',headers:H,body:JSON.stringify(b)});
  // 브랜드 저장 버튼 하나로 그 아래 제품 행들(가격 등)도 함께 저장한다 —
  // 안 그러면 제품 칸만 고치고 브랜드 저장을 누른 사용자는 반영 안 된 줄 모르고 넘어간다.
  if(r.ok) for(const p of b.products){ p.brandId=b.id;
    await fetch(ROOT+'/api/catalog/admin/products/'+encodeURIComponent(p.id),{method:'PUT',headers:H,body:JSON.stringify(p)}); }
  toast(r.ok?'브랜드 저장됨':'저장 실패'); if(r.ok) load();
}
async function delB(bi){
  if(!confirm('브랜드와 그 제품을 모두 삭제할까요?'))return;
  const r=await fetch(ROOT+'/api/catalog/admin/brands/'+encodeURIComponent(DATA[bi].id),{method:'DELETE',headers:HD});
  toast(r.ok?'삭제됨':'삭제 실패'); load();
}
async function saveP(bi,pi){
  const p=DATA[bi].products[pi]; p.brandId=DATA[bi].id;
  const r=await fetch(ROOT+'/api/catalog/admin/products/'+encodeURIComponent(p.id),{method:'PUT',headers:H,body:JSON.stringify(p)});
  toast(r.ok?'제품 저장됨':'저장 실패'); if(r.ok) load();
}
async function delP(bi,pi){
  if(!confirm('이 제품을 삭제할까요?'))return;
  const r=await fetch(ROOT+'/api/catalog/admin/products/'+encodeURIComponent(DATA[bi].products[pi].id),{method:'DELETE',headers:HD});
  toast(r.ok?'삭제됨':'삭제 실패'); load();
}
function addBrand(){
  const id=prompt('새 브랜드 ID (영문·숫자·하이픈)','b'+String(DATA.length+1).padStart(2,'0')+'-new');
  if(!id)return;
  DATA.push({id,name:'새 브랜드',emoji:'🏷',tagline:{},personaTags:[],axisAffinity:{},products:[],active:true,sortOrder:DATA.length});
  render(); saveB(DATA.length-1);
}
function addProduct(bi){
  const b=DATA[bi];
  const id=b.id+'p'+(b.products.length+1);
  b.products.push({id,brandId:b.id,name:{},price:'',listPrice:'',shopUrl:'',active:true,sortOrder:b.products.length});
  render(); saveP(bi,b.products.length-1);
}
load();
</script>
</body>
</html>`;
}
