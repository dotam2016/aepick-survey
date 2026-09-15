import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { feTestPages } from './fe-test-pages';

/**
 * FE 테스트 갤러리(test.html)를 빌드 결과에 포함할지.
 * 기본은 제외 — 운영 키오스크 dist에 테스트 화면이 섞이지 않게 한다.
 *   npm run fe:build  →  FE_TEST=1 로 빌드해 dist/test.html 까지 만든다
 */
const WITH_FE_TEST = process.env.FE_TEST === '1';

export default defineConfig({
  plugins: [react(), feTestPages()],
  server: {
    port: 5173,
    // server/src, packages/shared 를 dev 서버가 읽을 수 있도록 워크스페이스 루트를 허용
    fs: { allow: [resolve(__dirname, '../..')] },
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/static': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  // 서버 페이지(server/src/*.ts)를 dev 서버에서 직접 불러오기 위해 TS인 워크스페이스 패키지는 번들 대상으로 둔다
  ssr: { noExternal: ['@aepick/shared'] },
  build: {
    // FE 테스트 빌드는 별도 폴더로 — 운영 dist를 건드리지 않는다
    outDir: WITH_FE_TEST ? 'dist-fe-test' : 'dist',
    // Dropbox/OneDrive 동기화 폴더에서는 dist 삭제가 EPERM으로 실패할 수 있다.
    // 비우지 않고 덮어쓰기 — index.html이 최신 해시를 참조하므로 동작에는 영향 없음.
    emptyOutDir: false,
    rollupOptions: WITH_FE_TEST
      ? { input: { main: resolve(__dirname, 'index.html'), test: resolve(__dirname, 'test.html') } }
      : undefined,
  },
});
