import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/static': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    // Dropbox/OneDrive 동기화 폴더에서는 dist 삭제가 EPERM으로 실패할 수 있다.
    // 비우지 않고 덮어쓰기 — index.html이 최신 해시를 참조하므로 동작에는 영향 없음.
    emptyOutDir: false,
  },
});
