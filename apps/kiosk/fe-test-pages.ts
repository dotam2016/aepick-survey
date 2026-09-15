/**
 * ─────────────────────────────────────────────────────────────
 *  FE TEST — 서버 렌더링 페이지를 백엔드 없이 띄우는 vite 플러그인
 * ─────────────────────────────────────────────────────────────
 *
 * 모바일 결과·투표·페어링 페이지와 어드민 화면은 server/src/*.ts가 HTML 문자열로
 * 만든다. 이 플러그인은 그 함수를 그대로 불러 렌더링하고, 페이지가 호출하는
 * /api/* 요청만 가짜 응답으로 바꿔치기한다. DB도, fastify도 띄우지 않는다.
 *
 *   /p/:code        페어링(QR 스캔) 목업
 *   /r/:token       모바일 결과
 *   /v/:token       제품 투표
 *   /v/:token/done  투표 완료 + 직원 확인
 *   /admin          운영 대시보드
 *   /admin/catalog  브랜드·제품 관리
 *
 * server/src의 페이지 파일을 고치면 저장 즉시 브라우저가 새로고침된다.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plugin, PluginOption, ViteDevServer } from 'vite';
import {
  MOCK_BRANDS, MOCK_PAIR_CODE, MOCK_STAFF_LOOKUP, MOCK_TOKEN, MOCK_VOTE_OPTIONS,
  MOCK_VOTE_STATUS_DONE, MOCK_ADMIN_ANALYTICS, MOCK_ADMIN_OVERVIEW, MOCK_ADMIN_SESSIONS,
  mockResultData,
} from './src/test/mockData';
import { TONES, stageBackground } from './src/test/tones';

interface Route {
  re: RegExp;
  file: string;
  fn: string;
  /** 캡처 그룹을 페이지 함수 인자로 바꾼다 */
  args: (m: RegExpMatchArray) => unknown[];
}

const ROUTES: Route[] = [
  { re: /^\/p\/([^/]+)\/?$/, file: 'pairingRoutes.ts', fn: 'pairingPageHtml', args: (m) => [m[1]] },
  { re: /^\/r\/([^/]+)\/?$/, file: 'pages.ts', fn: 'resultPageHtml', args: (m) => [m[1]] },
  { re: /^\/v\/([^/]+)\/done\/?$/, file: 'votePages.ts', fn: 'voteDonePageHtml', args: (m) => [m[1]] },
  { re: /^\/v\/([^/]+)\/?$/, file: 'votePages.ts', fn: 'votePageHtml', args: (m) => [m[1]] },
  { re: /^\/admin\/catalog\/?$/, file: 'catalogRoutes.ts', fn: 'catalogPageHtml', args: () => [] },
  { re: /^\/admin\/?$/, file: 'pages.ts', fn: 'adminPageHtml', args: () => [] },
];

/** 페이지 스크립트보다 먼저 실행돼 fetch·언어·관리자 키를 가짜로 채우는 스크립트 */
function mockScript(): string {
  const data = {
    brands: MOCK_BRANDS,
    voteOptions: MOCK_VOTE_OPTIONS,
    voteStatusDone: MOCK_VOTE_STATUS_DONE,
    staff: MOCK_STAFF_LOOKUP,
    adminOverview: MOCK_ADMIN_OVERVIEW,
    adminAnalytics: MOCK_ADMIN_ANALYTICS,
    adminSessions: MOCK_ADMIN_SESSIONS,
    result: mockResultData(),
    // 갤러리에서 고른 배경 톤(?bg=)을 고객용 페이지에도 똑같이 입힌다
    tones: Object.fromEntries(TONES.map((t) => [t.id, { bg: stageBackground(t), soft: t.bg1 }])),
  };
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `
<script>
/* FE TEST — dữ liệu giả, không có backend */
(function(){
  var D=${json};
  var Q=new URLSearchParams(location.search);
  var LANG=Q.get('lang')||sessionStorage.getItem('feTestLang')||'vi';
  try{sessionStorage.setItem('feTestLang',LANG)}catch(e){}
  try{Object.defineProperty(navigator,'language',{configurable:true,get:function(){return LANG}})}catch(e){}
  try{Object.defineProperty(navigator,'languages',{configurable:true,get:function(){return [LANG]}})}catch(e){}
  try{localStorage.setItem('adminKey','aepick-admin')}catch(e){}
  var nativePrompt=window.prompt;
  window.prompt=function(msg,def){ return /admin key/i.test(msg||'') ? 'aepick-admin' : nativePrompt.call(window,msg,def) };
  D.result.language=LANG;

  /* tone nền — chỉ áp cho trang khách hàng, không đụng trang vận hành (/admin) */
  var BG=Q.get('bg')||sessionStorage.getItem('feTestBg');
  if(BG){ try{sessionStorage.setItem('feTestBg',BG)}catch(e){} }
  var tone=BG&&D.tones[BG];
  if(tone&&location.pathname.indexOf('/admin')!==0){
    document.addEventListener('DOMContentLoaded',function(){
      var st=document.createElement('style');
      st.textContent=':root{--bg:'+tone.soft+'}body{background:'+tone.bg+' !important;background-attachment:fixed}';
      document.head.appendChild(st);
    });
  }

  function J(data,status){ return new Response(JSON.stringify({ok:status!==410&&status!==404,data:data,error:{code:'mock',message:'mock'}}),
    {status:status||200,headers:{'Content-Type':'application/json'}}) }

  function answer(method,p){
    if(/^\\/api\\/results\\/[^/]+$/.test(p)) return method==='DELETE' ? J({deleted:true}) : J(D.result);
    if(/^\\/api\\/vote\\/[^/]+\\/status$/.test(p))
      return J(/\\/done\\/?$/.test(location.pathname) ? D.voteStatusDone : {voted:false,picks:[],rewardClaimedAt:null});
    if(/^\\/api\\/vote\\/[^/]+\\/options$/.test(p)) return J(D.voteOptions);
    if(/^\\/api\\/vote\\/[^/]+\\/staff$/.test(p)) return J(D.staff);
    if(/^\\/api\\/vote\\/[^/]+\\/reward$/.test(p)) return J({rewardClaimedAt:new Date().toISOString()});
    if(/^\\/api\\/vote\\/[^/]+$/.test(p)) return J({voted:true});
    if(/^\\/api\\/pairings\\/[^/]+\\/claim$/.test(p)) return J({visitCount:2,sessionId:'demo-session'});
    if(p==='/api/admin/overview') return J(D.adminOverview);
    if(p==='/api/admin/analytics') return J(D.adminAnalytics);
    if(p==='/api/admin/sessions') return J(D.adminSessions);
    if(p==='/api/catalog'||p==='/api/catalog/admin') return J({brands:D.brands});
    if(p.indexOf('/api/')===0) return J({});
    return null;
  }

  var original=window.fetch.bind(window);
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||String(input);
    var method=((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    var p=url.indexOf('http')===0?new URL(url).pathname:url.split('?')[0];
    var res=answer(method,p);
    return res?Promise.resolve(res):original(input,init);
  };
})();
</script>`;
}

function errorPage(route: Route, e: unknown): string {
  const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e);
  return `<!doctype html><meta charset="utf-8"/>
<body style="font:13px/1.6 ui-monospace,Consolas,monospace;background:#1c1922;color:#ffb6b0;padding:24px">
<h2 style="color:#fff;font:700 15px system-ui">Không tải được ${route.file} → ${route.fn}()</h2>
<pre style="white-space:pre-wrap">${msg.replace(/</g, '&lt;')}</pre></body>`;
}

/** 정적 빌드(FE_TEST=1)에서 미리 그려 두는 페이지 — 폴더 인덱스로 내보내 주소가 dev와 같다 */
const STATIC_PAGES: { route: Route; args: unknown[]; out: string }[] = [
  { route: ROUTES[0], args: [MOCK_PAIR_CODE], out: `p/${MOCK_PAIR_CODE}/index.html` },
  { route: ROUTES[1], args: [MOCK_TOKEN], out: `r/${MOCK_TOKEN}/index.html` },
  { route: ROUTES[2], args: [MOCK_TOKEN], out: `v/${MOCK_TOKEN}/done/index.html` },
  { route: ROUTES[3], args: [MOCK_TOKEN], out: `v/${MOCK_TOKEN}/index.html` },
  { route: ROUTES[4], args: [], out: 'admin/catalog/index.html' },
  { route: ROUTES[5], args: [], out: 'admin/index.html' },
];

/**
 * 정적 빌드용 플러그인.
 * dev 서버가 없으므로 tsx로 server/src의 페이지 함수를 직접 불러 HTML을 구워 둔다.
 * 실패해도 빌드를 멈추지 않고 안내 페이지를 대신 넣는다.
 */
function feTestStaticPages(): Plugin {
  let serverSrc = '';
  return {
    name: 'aepick-fe-test-pages-build',
    apply: 'build',
    configResolved(cfg) {
      serverSrc = path.resolve(cfg.root, '../../server/src');
    },
    async generateBundle() {
      if (process.env.FE_TEST !== '1') return;
      let tsImport: ((url: string, parent: string) => Promise<Record<string, unknown>>) | null = null;
      try {
        ({ tsImport } = (await import('tsx/esm/api')) as never);
      } catch { /* tsx 없음 — 아래 catch에서 안내 페이지로 대체된다 */ }

      for (const page of STATIC_PAGES) {
        let html: string;
        try {
          if (!tsImport) throw new Error('tsx/esm/api를 불러오지 못했습니다 (npm install 필요)');
          const url = pathToFileURL(path.resolve(serverSrc, page.route.file)).href;
          const mod = await tsImport(url, import.meta.url);
          const build = mod[page.route.fn] as (...a: unknown[]) => string;
          html = build(...page.args).replace(/<head>/i, `<head>${mockScript()}`);
        } catch (e) {
          html = errorPage(page.route, e);
        }
        this.emitFile({ type: 'asset', fileName: page.out, source: html });
      }
    },
  };
}

function feTestDevPages(): Plugin {
  let serverSrc = '';
  let dev: ViteDevServer;

  return {
    name: 'aepick-fe-test-pages',
    apply: 'serve',
    configResolved(cfg) {
      serverSrc = path.resolve(cfg.root, '../../server/src');
    },
    configureServer(server) {
      dev = server;

      // server/src 를 고치면 미리보기를 새로고침한다
      server.watcher.add(serverSrc);
      server.watcher.on('change', (file) => {
        if (!path.resolve(file).startsWith(serverSrc)) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: 'full-reload', path: '*' });
      });

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const hit = ROUTES.map((r) => ({ r, m: url.match(r.re) })).find((x) => x.m);
        if (!hit?.m) return next();

        let html: string;
        try {
          const id = `/@fs/${path.resolve(serverSrc, hit.r.file).replace(/\\/g, '/')}`;
          const mod = await dev.ssrLoadModule(id);
          const build = mod[hit.r.fn] as (...a: unknown[]) => string;
          html = build(...hit.r.args(hit.m));
          html = html.replace(/<head>/i, `<head>${mockScript()}`);
        } catch (e) {
          dev.config.logger.error(`[fe-test] ${hit.r.file} → ${String(e)}`);
          html = errorPage(hit.r, e);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await dev.transformIndexHtml(req.url ?? url, html));
      });
    },
  };
}

export function feTestPages(): PluginOption {
  return [feTestDevPages(), feTestStaticPages()];
}
