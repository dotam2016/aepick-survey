import React from 'react';
import { createRoot } from 'react-dom/client';
// 폰트 로컬 번들 — CDN 의존 제거 (오프라인 시연 대비). Vite가 woff2를 dist에 포함시킨다.
//
// Be Vietnam Pro : 본문 기본 — 베트남어 성조 부호를 위해 만들어진 서체 (vi/en 담당)
// Pretendard     : 한글 담당 (Be Vietnam Pro에 한글 글리프가 없어 자동으로 넘어간다)
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/be-vietnam-pro/900.css';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@fontsource/nunito/900-italic.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
