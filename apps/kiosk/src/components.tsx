import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXES, PERSONAS, type Axis, type Scores } from '@aepick/shared';
import { useStore, CORE_ORDER, type ScreenId } from './state';
import { makeT } from './i18n';
import { api } from './api';

/* ────────── 시안에서 슬라이스한 UI 에셋 (public/assets/ui) ────────── */
export const ASSET = (name: string, ext: 'png' | 'jpg' = 'png') => `/assets/ui/${name}.${ext}`;

/** 브랜드 워드마크 (시안 로고 이미지) */
export function Logo({ height = 56, sub = true }: { height?: number; sub?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: height * 0.14 }}>
      <img src={ASSET('logo')} alt="aépick" style={{ height, width: 'auto', display: 'block' }} />
      {sub && <img src={ASSET('logo-sub')} alt="BEAUTY DNA" style={{ height: height * 0.19, width: 'auto', display: 'block' }} />}
    </div>
  );
}

/** 글로시 장식 (하트·다이아·DNA 나선) */
export function Deco({ name, style }: { name: string; style: React.CSSProperties }) {
  return <img src={ASSET(name)} alt="" aria-hidden className="deco-heart" style={{ position: 'absolute', ...style }} />;
}

/** 진행률 젬 (S06~S11 상단) — 현재까지 루비, 이후 진주 */
export function ProgressGems({ current }: { current: ScreenId }) {
  const { s } = useStore();
  const t = makeT(s.language);
  const idx = CORE_ORDER.findIndex((c) => c.screen === current);
  return (
    <div style={{ marginBottom: '1.6vh' }}>
      <div className="gems">
        {CORE_ORDER.map((c, i) => (
          <React.Fragment key={c.axis}>
            {i > 0 && <span style={{ width: 22, borderTop: '1.5px solid rgba(242,103,92,0.28)' }} />}
            <img src={ASSET(i <= idx ? 'ruby' : 'pearl')} alt=""
              style={{
                width: i === idx ? 34 : 28, height: 'auto', display: 'block',
                filter: i === idx ? 'var(--asset-tint) drop-shadow(0 0 8px rgba(242,103,92,0.6))' : 'var(--asset-tint)',
                transition: 'all 0.4s ease',
              }} />
          </React.Fragment>
        ))}
      </div>
      <div className="progress-label">{t('common.progressLabel', { n: idx + 1 })}</div>
    </div>
  );
}

/** 무입력 타임아웃 가드 — 경고 모달 후 세션 파기 */
export function TimeoutGuard({ seconds, children }: { seconds: number; children: React.ReactNode }) {
  const { s, resetSession } = useStore();
  const t = makeT(s.language);
  const [warning, setWarning] = useState(false);
  const [remain, setRemain] = useState(10);
  const lastInput = useRef(Date.now());

  useEffect(() => {
    const bump = () => {
      lastInput.current = Date.now();
      setWarning(false);
    };
    window.addEventListener('pointerdown', bump);
    const timer = setInterval(() => {
      const idle = (Date.now() - lastInput.current) / 1000;
      if (idle >= seconds) {
        api.sendEvent('session.abandoned', s.sessionId, { screen: s.screen });
        resetSession();
      } else if (idle >= seconds - 10) {
        setWarning(true);
        setRemain(Math.max(0, Math.ceil(seconds - idle)));
      }
    }, 500);
    return () => {
      window.removeEventListener('pointerdown', bump);
      clearInterval(timer);
    };
  }, [seconds, s.sessionId, s.screen, resetSession]);

  return (
    <>
      {children}
      {warning && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h1 className="display" style={{ fontSize: 'clamp(22px,3.4vh,34px)' }}>{t('common.timeoutTitle')}</h1>
            <p className="hint">{t('common.timeoutBody')} ({remain}s)</p>
            {/* 화면을 탭하면 경고가 사라지므로 이 버튼은 '계속' 역할을 겸한다 */}
            <button className="btn" style={{ width: '100%' }}>{t('common.continue')}</button>
            {/* 방문객이 중도에 그만두고 싶을 때 기다리지 않고 바로 초기화 */}
            <button className="btn ghost small" style={{ width: '100%', color: 'var(--ink-dim)' }}
              onClick={(e) => { e.stopPropagation(); api.sendEvent('session.abandoned', s.sessionId, { screen: s.screen, reason: 'user_restart' }); resetSession(); }}>
              {t('common.restart')} ↺
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** 게임 완료 토스트 → 자동 전환 */
export function CompleteToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2400);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <AnimatePresence>
      <motion.div
        className="complete-toast"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        ✨ {message}
      </motion.div>
    </AnimatePresence>
  );
}

/** 6축 레이더 차트 (SVG) — withIcons: 축마다 시안 아이콘 표시 */
export function RadarChart({ scores, size = 300, color, withIcons = false }: {
  scores: Scores; size?: number; color?: string; withIcons?: boolean;
}) {
  const { s } = useStore();
  const t = makeT(s.language);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * (withIcons ? 0.26 : 0.36);
  const angle = (i: number) => (Math.PI * 2 * i) / 6 - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const poly = (frac: number) => AXES.map((_, i) => pt(i, R * frac).join(',')).join(' ');
  const valuePoly = AXES.map((a, i) => pt(i, (R * scores[a as Axis]) / 100).join(',')).join(' ');
  const c = color ?? '#f2675c';
  const ICON = size * 0.115; // 축 아이콘 지름
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 시안: 바깥 점선 원 */}
      {withIcons && (
        <circle cx={cx} cy={cy} r={R * 1.42} fill="none" stroke="rgba(242,103,92,0.28)" strokeWidth={1} strokeDasharray="3 6" />
      )}
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={poly(f)} fill="none" stroke="rgba(84,62,55,0.16)" strokeWidth={1} />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(84,62,55,0.1)" />;
      })}
      <motion.polygon
        points={valuePoly}
        fill={`${c}44`}
        stroke={c}
        strokeWidth={3}
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* 값 꼭짓점 표시 (시안: 흰 점) */}
      {withIcons && AXES.map((a, i) => {
        const [x, y] = pt(i, (R * scores[a as Axis]) / 100);
        return <circle key={`d-${a}`} cx={x} cy={y} r={size * 0.014} fill="#fff" stroke={c} strokeWidth={2} />;
      })}
      {/* 축 아이콘 + 라벨 (시안: 아이콘 바깥, 라벨은 상반부 위 / 하반부 아래) */}
      {AXES.map((a, i) => {
        const [ix, iy] = pt(i, R * 1.40);
        const above = iy < cy - 1;
        const ly = iy + (above ? -1 : 1) * (ICON * 0.6 + size * 0.04);
        const [fx, fy] = pt(i, R * 1.22);
        return (
          <g key={a}>
            {withIcons && (
              <image href={ASSET(`axis-${a}`)} x={ix - ICON / 2} y={iy - ICON / 2} width={ICON} height={ICON} />
            )}
            <text
              x={withIcons ? ix : fx} y={withIcons ? ly : fy}
              textAnchor="middle" dominantBaseline="middle"
              fill={withIcons ? c : 'rgba(84,62,55,0.78)'}
              fontSize={size * (withIcons ? 0.042 : 0.045)} fontWeight={700}>
              {t(`dna.axes.${a}`)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 페르소나 젬 컬러 세트 */
export function personaColors(personaId: keyof typeof PERSONAS | null) {
  const p = personaId ? PERSONAS[personaId] : null;
  return { primary: p?.primaryColor ?? '#f2675c', secondary: p?.secondaryColor ?? '#f9938b' };
}

/** 축별 젬 컬러 (분석 애니메이션용) */
export const AXIS_COLORS: Record<Axis, string> = {
  repick: '#E8B84B',
  value: '#2456C8',
  care: '#4FD1C5',
  trend: '#FF7A6F',
  localFit: '#5DBB63',
  trust: '#8A2BE2',
};
