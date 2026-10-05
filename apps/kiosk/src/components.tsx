import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AXES, PERSONAS, type Axis, type PersonaId, type Scores } from '@aepick/shared';
import { useStore, CORE_ORDER, type ScreenId } from './state';
import { makeT } from './i18n';
import { api } from './api';

/* ────────── 시안에서 슬라이스한 UI 에셋 (public/assets/ui) ────────── */
export const ASSET = (name: string, ext: 'png' | 'jpg' | 'webp' = 'png') => `/assets/ui/${name}.${ext}`;

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
export function RadarChart({ scores, size = 300, color, dashedColor, fillGradient, outerGradient, withIcons = false }: {
  scores: Scores; size?: number; color?: string; dashedColor?: string;
  fillGradient?: { from: string; to: string }; outerGradient?: { from: string; to: string }; withIcons?: boolean;
}) {
  const { s } = useStore();
  const t = makeT(s.language);
  const fillId = useId();
  const cx = size / 2;
  const cy = size / 2;
  const R = size * (withIcons ? 0.26 : 0.36);
  const angle = (i: number) => (Math.PI * 2 * i) / 6 - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const poly = (frac: number) => AXES.map((_, i) => pt(i, R * frac).join(',')).join(' ');
  const valuePoly = AXES.map((a, i) => pt(i, (R * scores[a as Axis]) / 100).join(',')).join(' ');
  const c = color ?? '#f2675c';
  const dc = dashedColor ?? c;
  const ICON = size * 0.115; // 축 아이콘 지름
  const BADGE = ICON; // 배경 원 지름 (아이콘과 동일, 아이콘 자체는 안쪽에 여백을 두고 그린다)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        {fillGradient && (
          <linearGradient id={`fill-${fillId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={fillGradient.from} />
            <stop offset="100%" stopColor={fillGradient.to} />
          </linearGradient>
        )}
        {outerGradient && (
          <linearGradient id={`outer-${fillId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={outerGradient.from} />
            <stop offset="100%" stopColor={outerGradient.to} />
          </linearGradient>
        )}
        {withIcons && (
          /* 배지 유리광택 하이라이트 — 우상단에 치우친 밝은 반점 (시안 참고) */
          <radialGradient id={`axisGloss-${fillId}`} cx="78%" cy="20%" r="30%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      {/* 시안: 바깥 점선 원 */}
      {withIcons && (
        <circle cx={cx} cy={cy} r={R * 1.42} fill="none" stroke={hexA(dc, 0.28)} strokeWidth={1} strokeDasharray="3 6" />
      )}
      {[1, 0.66, 0.33].map((f) => (
        <polygon
          key={f} points={poly(f)}
          fill={f === 1 && outerGradient ? `url(#outer-${fillId})` : 'none'}
          stroke={hexA(dc, 0.25)} strokeWidth={1}
        />
      ))}
      {AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={hexA(dc, 0.18)} />;
      })}
      <motion.polygon
        points={valuePoly}
        fill={fillGradient ? `url(#fill-${fillId})` : '#fff'}
        fillOpacity={0.55}
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
              <>
                <circle
                  cx={ix} cy={iy} r={BADGE / 2}
                  fill={fillGradient ? `url(#fill-${fillId})` : AXIS_COLORS[a as Axis]}
                />
                <circle cx={ix} cy={iy} r={BADGE / 2} fill={`url(#axisGloss-${fillId})`} />
                <image
                  href={ASSET(`axis-${a}`)}
                  x={ix - ICON * 0.32} y={iy - ICON * 0.32} width={ICON * 0.64} height={ICON * 0.64}
                />
              </>
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

const hexA = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

/** 페르소나별 레이더 차트 색상 (데이터 폴리곤 테두리 / 배경 그리드·점선 테두리 / 폴리곤 내부 그라디언트 / 바깥 육각형 배경 그라디언트) */
export const PERSONA_CHART_COLORS: Record<PersonaId, {
  solid: string; dashed: string; fillFrom: string; fillTo: string; outerFrom: string; outerTo: string;
}> = {
  localBeautyExpert: { solid: '#467c45', dashed: '#467c45', fillFrom: '#D2FEAB', fillTo: '#5F9B5A', outerFrom: '#FFFFFF', outerTo: '#FEFFD3' },
  loyalGlowKeeper: { solid: '#bba47a', dashed: '#bba47a', fillFrom: '#F5DFC0', fillTo: '#C49B69', outerFrom: '#FFFFFF', outerTo: '#FDEFE4' },
  smartBeautyCurator: { solid: '#405ebb', dashed: '#405ebb', fillFrom: '#A5C1F5', fillTo: '#3270C5', outerFrom: '#FFFFFF', outerTo: '#E5E6E8' },
  beautyExplorer: { solid: '#ea6e00', dashed: '#f7931d', fillFrom: '#F9E6B0', fillTo: '#F9C238', outerFrom: '#FFFFFF', outerTo: '#FDE4D4' },
  trendMuse: { solid: '#5b41cc', dashed: '#d51766', fillFrom: '#D2BFF5', fillTo: '#9670E3', outerFrom: '#FFFCFD', outerTo: '#FCDCE8' },
  trustGuardian: { solid: '#12aeab', dashed: '#40cccc', fillFrom: '#AAF4F4', fillTo: '#76D9DA', outerFrom: '#FFFFFF', outerTo: '#FDEFE4' },
};
