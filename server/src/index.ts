import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './db.js';
import { registerRoutes, startExpiryScheduler } from './routes.js';
import { registerAdminRoutes } from './adminRoutes.js';
import { adminPageHtml, resultPageHtml } from './pages.js';
import { detectLanIps, ensureCert } from './demoNet.js';
import { ADMIN_KEY } from './adminKey.js';
import { registerPairingRoutes, startPairingSweeper } from './pairingRoutes.js';
import { registerCatalogRoutes } from './catalogRoutes.js';
import { registerVoteRoutes } from './voteRoutes.js';
import { seedCatalogIfEmpty } from './catalogSeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const USE_HTTPS = process.env.HTTPS === '1';
const KIOSK_DIST = path.resolve(__dirname, '../../apps/kiosk/dist');

const lanIps = detectLanIps();

/**
 * 시연 구성:
 *  - HTTPS=1 이면 자체 서명 인증서로 기동한다. 태블릿에서 카메라를 쓰려면 필수
 *    (LAN IP 접속은 보안 컨텍스트가 아니면 getUserMedia가 차단됨).
 *  - 키오스크 빌드(dist)가 있으면 같은 포트에서 서빙해 주소를 하나로 통일한다.
 */
const app = Fastify({
  logger: { level: 'warn' },
  /*
   * Cloudflare Tunnel(또는 ngrok) 뒤에서 실행할 때 X-Forwarded-* 헤더를 신뢰한다.
   * 이게 없으면 req.protocol 이 'http' 로 잡혀 QR 주소가 http://...trycloudflare.com 이 되고,
   * HTTPS 페이지에서 열 때 혼합 콘텐츠로 차단된다.
   */
  trustProxy: true,
  ...(USE_HTTPS ? { https: await ensureCert(lanIps) } : {}),
});

await app.register(cors, { origin: true });
await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } });
await app.register(fastifyStatic, { root: DATA_DIR, prefix: '/static/', decorateReply: false });

registerRoutes(app);
registerPairingRoutes(app);
registerCatalogRoutes(app);
registerVoteRoutes(app);
registerAdminRoutes(app);

/* 모바일 결과 페이지 */
app.get('/r/:token', async (req, reply) => {
  const { token } = req.params as { token: string };
  return reply.type('text/html').send(resultPageHtml(token));
});

/* 운영자 대시보드 */
app.get('/admin', async (_req, reply) => reply.type('text/html').send(adminPageHtml()));

/* 키오스크 앱 — 빌드가 있으면 루트에서 서빙, 없으면 안내 */
const hasKioskBuild = existsSync(path.join(KIOSK_DIST, 'index.html'));
if (hasKioskBuild) {
  await app.register(fastifyStatic, { root: KIOSK_DIST, prefix: '/', decorateReply: false });
} else {
  app.get('/', async (_req, reply) =>
    reply.type('text/html').send(
      `<body style="font-family:sans-serif;padding:40px;line-height:1.7">
        <h2>키오스크 빌드가 없습니다</h2>
        <p><code>npm run build -w @aepick/kiosk</code> 실행 후 서버를 재시작하세요.</p>
        <p>또는 개발 서버(<code>npm run dev:kiosk</code>, 포트 5173)를 사용하세요.</p>
        <p><a href="/admin">운영자 대시보드 →</a></p>
      </body>`,
    ));
}

startExpiryScheduler();
startPairingSweeper();

const seeded = await seedCatalogIfEmpty();

await app.listen({ port: PORT, host: '0.0.0.0' });

/*
 * 콘솔 출력은 ASCII 영문으로 고정한다.
 * Windows cmd(CP949)에서 UTF-8 한글이 깨져 태블릿 접속 주소를 읽을 수 없게 되기 때문.
 */
const scheme = USE_HTTPS ? 'https' : 'http';
const bar = '='.repeat(60);
console.log(`\n${bar}`);
console.log(`  AEPICK BEAUTY DNA   ${USE_HTTPS ? 'HTTPS' : 'HTTP'}  port ${PORT}`);
console.log(bar);
console.log(`  KIOSK  (this PC)   ${scheme}://localhost:${PORT}/`);
for (const ip of lanIps) {
  console.log(`  KIOSK  (TABLET)    ${scheme}://${ip}:${PORT}/     <-- open on tablet`);
}
console.log(`  ADMIN  dashboard   ${scheme}://localhost:${PORT}/admin   (key: ${ADMIN_KEY})`);
console.log(`  ADMIN  catalog     ${scheme}://localhost:${PORT}/admin/catalog   <-- brands & products`);
console.log(bar);
if (process.env.TUNNEL === '1') {
  console.log('  [i] TUNNEL mode: the public URL is printed in the cloudflared window.');
  console.log('  [i] Admin key above is randomly generated for this run. Copy it now.');
  console.log('  [!] The tunnel exposes this PC to the internet. Close it after the demo.');
}
if (!hasKioskBuild) console.log('  [!] kiosk build missing  ->  npm run build -w @aepick/kiosk');
/*
 * 터널 모드에서는 cloudflared 가 정식 인증서로 HTTPS 를 종단 처리하므로
 * 로컬 서버가 HTTP 여도 태블릿 쪽은 보안 컨텍스트가 되어 카메라가 열린다.
 */
if (!USE_HTTPS && process.env.TUNNEL !== '1')
  console.log('  [!] HTTP mode: camera is BLOCKED on tablet (LAN IP). Run with HTTPS=1');
if (USE_HTTPS) console.log('  [i] First tablet visit shows a certificate warning -> Advanced -> Proceed (once)');
if (seeded > 0) console.log(`  [i] Seeded ${seeded} placeholder brands. Edit them at /admin/catalog`);
console.log(`${bar}\n`);
