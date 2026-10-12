import React, { useEffect, useRef, useState } from 'react';
import { TREND_CARDS } from '@aepick/shared';
import { BRIDGE_AXES, CORE_ORDER, StateProvider, useStore, type ScreenId } from './state';
import { ASSET, TimeoutGuard, uiDir } from './components';
import {
  AttractScreen, LanguageScreen, ConsentScreen, IntroScreen, BridgeScreen,
  AnalyzingScreen, DnaResultScreen, QrScreen, EndScreen, RESULT_VN_IMAGE,
} from './screens/flow';
import { Core1Screen, Core2Screen, Core3Screen, Core4Screen, Core5Screen, Core6Screen } from './screens/games';

export const SCREENS: Record<ScreenId, React.ComponentType> = {
  attract: AttractScreen,
  language: LanguageScreen,
  consent: ConsentScreen,
  intro: IntroScreen,
  core1: Core1Screen,
  core2: Core2Screen,
  core3: Core3Screen,
  core4: Core4Screen,
  core5: Core5Screen,
  core6: Core6Screen,
  bridge: BridgeScreen,
  analyzing: AnalyzingScreen,
  dnaResult: DnaResultScreen,
  qr: QrScreen,
  end: EndScreen,
};

/** 타임아웃 정책 (기능정의서 1.2). null = 타임아웃 없음 */
const TIMEOUTS: Record<ScreenId, number | null> = {
  attract: null, // 고객을 기다리는 대기화면 — 고객이 없는 상태이므로 타임아웃 없음
  language: 60, consent: 60, intro: 60,
  core1: 90, core2: 90, core3: 90, core4: 90, core5: 90, core6: 90,
  bridge: null, // 자동 전환 화면 — 무입력 타임아웃 대상 아님
  analyzing: null, dnaResult: 60, qr: 60, end: null,
};

/** 운영자 히든 제스처: 좌상단 5회 연속 탭 → 세션 초기화 */
function OperatorGesture() {
  const { resetSession } = useStore();
  const taps = useRef<number[]>([]);
  const onTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      if (window.confirm('Operator: reset session?')) resetSession();
    }
  };
  return <div style={{ position: 'absolute', top: 0, left: 0, width: 90, height: 90, zIndex: 100 }} onPointerDown={onTap} />;
}

/**
 * 개발·QA용 URL 파라미터
 *   ?noTimeout=1   무입력 타임아웃 비활성화
 *   ?timeout=20    모든 화면의 타임아웃을 N초로 강제 (경고는 N-10초에 표시)
 */
const QS = new URLSearchParams(window.location.search);
const DISABLE_TIMEOUT = QS.has('noTimeout');
const TIMEOUT_OVERRIDE = Number(QS.get('timeout')) || null;

// 디코딩까지 끝낸 Image를 모듈 스코프에 붙잡아둔다 — 참조가 없으면 GC가 디코드 캐시를
// 회수해버려, 화면 전환 시 img 태그를 새로 꽂을 때 다시 디코딩하며 끊긴다(iPad에서 체감됨).
const preloadedImages: HTMLImageElement[] = [];
function preloadImage(src: string) {
  const img = new Image();
  img.src = src;
  img.decode?.().catch(() => {});
  preloadedImages.push(img);
}

// 화면 전환 중 이미지가 늦게 뜨며 끊기는(stutter) 문제 방지 — 언어 선택 직후(코어 게임을 하는 동안)
// 브릿지·코어(VN 배경)·트렌드 카드 이미지를 모두 미리 받아 디코딩까지 끝내둔다.
function useImagePreload(language: string) {
  useEffect(() => {
    BRIDGE_AXES.forEach((axis) => {
      const src = `${uiDir(language)}/bridge-${axis}.webp`;
      preloadImage(src);
    });
    CORE_ORDER.forEach(({ screen }) => preloadImage(`${uiDir(language)}/${screen}.webp`));
    ['anh1', 'a_05', 'end-final', ...Object.values(RESULT_VN_IMAGE)].forEach((n) => preloadImage(`${uiDir(language)}/${n}.webp`));
    preloadImage('/assets/ui/s1.webp');
    TREND_CARDS.forEach((card) => preloadImage(ASSET(`trend-${card}`, 'webp')));
  }, [language]);
}

function Router() {
  const { s } = useStore();
  useImagePreload(s.language);
  const Screen = SCREENS[s.screen];
  const base = TIMEOUTS[s.screen];
  const timeout = DISABLE_TIMEOUT ? null : (base === null ? null : (TIMEOUT_OVERRIDE ?? base));
  // AnimatePresence 미사용 — exit 애니메이션이 완료되지 않으면 이전 화면이
  // 언마운트되지 않고 DOM에 누적된다(타이머·토스트가 살아남아 오작동).
  // key 변경으로 즉시 교체한다. 진입 페이드(opacity 0→1)는 전체화면 이미지 전환 때 배경이 비쳐 깜빡여 제거.
  const body = (
    <div key={s.screen} style={{ position: 'absolute', inset: 0 }}>
      <Screen />
    </div>
  );
  return (
    <div className="stage">
      <OperatorGesture />
      {timeout !== null ? <TimeoutGuard seconds={timeout}>{body}</TimeoutGuard> : body}
    </div>
  );
}

export default function App() {
  return (
    <StateProvider>
      <Router />
    </StateProvider>
  );
}
