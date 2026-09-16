import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { StateProvider, useStore, type ScreenId } from './state';
import { ASSET, TimeoutGuard } from './components';
import {
  AttractScreen, LanguageScreen, ConsentScreen, IntroScreen, BridgeScreen,
  AnalyzingScreen, DnaResultScreen, QrScreen, EndScreen,
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

function Router() {
  const { s } = useStore();
  const Screen = SCREENS[s.screen];
  const base = TIMEOUTS[s.screen];
  const timeout = DISABLE_TIMEOUT ? null : (base === null ? null : (TIMEOUT_OVERRIDE ?? base));
  // AnimatePresence 미사용 — exit 애니메이션이 완료되지 않으면 이전 화면이
  // 언마운트되지 않고 DOM에 누적된다(타이머·토스트가 살아남아 오작동).
  // key 변경으로 즉시 교체하고 진입 애니메이션만 유지한다.
  const body = (
    <motion.div key={s.screen} style={{ position: 'absolute', inset: 0 }}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}>
      <Screen />
    </motion.div>
  );
  return (
    <div className="stage">
      <OperatorGesture />
      {/* 전 화면 공통 브랜드 헤더 (대형 워드마크를 자체 표시하는 화면 제외) */}
      {s.screen !== 'attract' && s.screen !== 'intro' && (
        <img src={ASSET('logo')} alt="aépick" className="brand-header" />
      )}
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
