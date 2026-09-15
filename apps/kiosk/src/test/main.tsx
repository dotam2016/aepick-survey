/**
 * FE 테스트 갤러리 진입점 (test.html).
 * 운영 진입점(main.tsx)과 분리돼 있어 키오스크 빌드에는 포함되지 않는다.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
// 폰트 구성은 운영 진입점(main.tsx)과 동일해야 한다
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource/be-vietnam-pro/900.css';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@fontsource/nunito/900-italic.css';
import '../styles.css';
import { installMockApi } from './mockApi';
import Gallery from './Gallery';

// 백엔드 없이 돌리기 위해 /api/* 요청을 가로챈다
installMockApi();

// StrictMode를 쓰지 않는다 — 이펙트가 두 번 실행되면 화면별 타이머가 겹쳐 보인다
createRoot(document.getElementById('root')!).render(<Gallery />);
