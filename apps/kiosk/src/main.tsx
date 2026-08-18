import React from 'react';
import { createRoot } from 'react-dom/client';
// 폰트 로컬 번들 — CDN 의존 제거 (오프라인 시연 대비). Vite가 woff2를 dist에 포함시킨다.
import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@fontsource/nunito/900-italic.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
