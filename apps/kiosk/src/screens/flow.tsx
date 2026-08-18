import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AXES,
  PERSONAS,
  determinePersona,
  type Axis,
  type Language,
  type Scores,
} from '@aepick/shared';
import { screenAfterBridge, useStore } from '../state';
import { makeT, makeTr } from '../i18n';
import { api, type PairingIssued, type TodayStats } from '../api';
import { ASSET, Deco, Logo, RadarChart, personaColors } from '../components';

/* ────────────────────── S00. Attract ────────────────────── */

/** 헤드라인의 "Beauty DNA"를 핑크로 강조 */
function AccentHeadline({ text, size }: { text: string; size?: string }) {
  const parts = text.split(/(Beauty DNA)/);
  return (
    <h1 className="display" style={{ whiteSpace: 'pre-line', fontSize: size ?? 'clamp(20px, 3.3vh, 33px)' }}>
      {parts.map((p, i) =>
        p === 'Beauty DNA' ? <span key={i} className="accent">Beauty DNA</span> : <React.Fragment key={i}>{p}</React.Fragment>,
      )}
    </h1>
  );
}

/** AI 결과 예시 포토카드 팬 (시안 슬라이스 에셋) */
function CardFan() {
  return (
    <motion.img src={ASSET('photocards')} alt=""
      initial={{ opacity: 0, y: 26, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 18 }}
      style={{ width: '96%', maxHeight: '27vh', objectFit: 'contain', alignSelf: 'center' }} />
  );
}

/*
 * 대기화면 3단계 안내.
 * 아이콘 파일명은 v1(사진·AI) 시절 그대로다. 디자이너가 새 아이콘으로
 * 교체할 때 같은 파일명을 쓰면 코드 수정 없이 반영된다(V2-7 가이드 참조).
 */
const STEP_ITEMS = [
  { asset: 'step-photo', label: 'Scan' },
  { asset: 'step-picks', label: '6 Picks' },
  { asset: 'step-ai', label: 'Brands' },
];

export function AttractScreen() {
  const { s, go } = useStore();
  const t = makeT(s.language);
  const tr = makeTr(s.language);
  const [stats, setStats] = useState<TodayStats | null>(null);

  useEffect(() => {
    api.todayStats().then(setStats);
  }, []);

  const bullets = tr<string[]>('attract.bullets') ?? [];

  return (
    <div className="screen" style={{ justifyContent: 'space-between', padding: '3.5% 6% 3%' }}>
      {/* 배경 워시 + 장식 하트/스파클 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: -1,
        background: 'radial-gradient(80% 45% at 50% 12%, rgba(255,255,255,0.85) 0%, transparent 65%), radial-gradient(70% 40% at 50% 100%, rgba(247,148,176,0.4) 0%, transparent 70%)',
      }} />
      <Deco name="heart-glossy" style={{ top: '3%', right: '2%', width: '19%' }} />
      <Deco name="heart-small" style={{ top: '5%', left: '4%', width: '10%', animationDelay: '0.8s' }} />
      <Deco name="heart-big" style={{ top: '34%', right: '-8%', width: '22%', animationDelay: '2s', opacity: 0.75 }} />
      <Deco name="heart-glossy" style={{ bottom: '4%', right: '4%', width: '13%', animationDelay: '1.2s' }} />
      <Deco name="heart-small" style={{ bottom: '8%', left: '3%', width: '9%', animationDelay: '2.8s' }} />
      <span className="sparkle" style={{ top: '17%', left: '10%', fontSize: 20 }}>✦</span>
      <span className="sparkle" style={{ top: '30%', right: '16%', fontSize: 16 }}>✧</span>
      <span className="sparkle" style={{ bottom: '30%', left: '8%', fontSize: 18, opacity: 0.6 }}>✦</span>

      {/* 워드마크 */}
      <Logo height={62} />

      {/* AI 결과 예시 카드 팬 */}
      <CardFan />

      {/* 헤드라인 + 불릿 + 슬로건 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1vh', alignItems: 'center' }}>
        <AccentHeadline text={t('attract.headline')} />
        <p style={{ fontSize: 'clamp(13px, 1.8vh, 17px)', fontWeight: 700, color: 'var(--ink)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {bullets.map((b, i) => (
            <React.Fragment key={b}>
              {i > 0 && <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>}
              <span>{b}</span>
            </React.Fragment>
          ))}
        </p>
        <p className="hint" style={{ fontStyle: 'italic', fontWeight: 600, color: 'rgba(214,110,138,0.75)' }}>{t('attract.sub')}</p>
      </div>

      {/* 스탯 카드 2개 */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <div className="card" style={{ flex: 1, padding: '12px 14px', borderRadius: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={ASSET('icon-people')} alt="" style={{ width: 46, height: 46, flex: 'none' }} />
          <div style={{ textAlign: 'left' }}>
            <p className="hint" style={{ fontSize: 11.5 }}>{t('attract.participantsLabel')}</p>
            <p style={{ fontWeight: 800, fontSize: 'clamp(18px, 2.6vh, 26px)', color: 'var(--ink)' }}>
              {stats && stats.totalParticipants > 0 ? stats.totalParticipants.toLocaleString() : '—'}
            </p>
          </div>
        </div>
        <div className="card" style={{ flex: 1.2, padding: '12px 14px', borderRadius: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={ASSET('icon-fire')} alt="" style={{ width: 46, height: 46, flex: 'none' }} />
          <div style={{ textAlign: 'left' }}>
            <p className="hint" style={{ fontSize: 11.5 }}>{t('attract.topDnaLabel').replace('🔥 ', '')}</p>
            <p style={{ fontFamily: 'var(--wordmark-font)', fontStyle: 'italic', fontWeight: 900, fontSize: 'clamp(15px, 2.2vh, 22px)', color: 'var(--accent)', letterSpacing: '-0.02em' }}>
              {stats?.topPersona ? PERSONAS[stats.topPersona].name : '· · ·'}
            </p>
          </div>
        </div>
      </div>

      {/* 3단계 스텝 카드 */}
      <div className="card" style={{ width: '100%', padding: '14px 18px', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {STEP_ITEMS.map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && (
              <div style={{ flex: 1, borderTop: '3px dotted #f3bfcd', margin: '0 8px', transform: 'translateY(-12px)' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <img src={ASSET(step.asset)} alt="" style={{ width: 56, height: 56 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', color: '#fff',
                  fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center',
                }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{step.label}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* 페어링 QR — 고객이 폰으로 찍으면 체험이 시작된다 */}
      <PairingPanel />
    </div>
  );
}

/**
 * 대기화면의 페어링 QR.
 *
 * 체험 1회마다 일회용 코드를 발급해 QR로 띄우고, 폰이 스캔해 app 계정을
 * 연결할 때까지 폴링한다. 연결되면 세션 정보를 받아 언어 선택으로 넘어간다.
 * 코드가 만료되면 자동으로 새로 발급한다(PAD가 방치돼도 항상 유효한 QR 유지).
 */
const PAIRING_POLL_MS = 1500;

function PairingPanel() {
  const { s, update, go } = useStore();
  const t = makeT(s.language);
  const [qr, setQr] = useState<PairingIssued | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let pollTimer: ReturnType<typeof setTimeout>;

    const issue = async () => {
      const res = await api.issuePairing();
      if (!alive) return;
      if (!res) { setFailed(true); setTimeout(issue, 5000); return; }
      setFailed(false);
      setQr(res);
      poll(res);
    };

    const poll = (issued: PairingIssued) => {
      pollTimer = setTimeout(async () => {
        if (!alive) return;
        const r = await api.pollPairing(issued.code);
        if (!alive) return;
        if (r && r.status === 'claimed') {
          update({
            sessionId: r.sessionId,
            visitCount: r.visitCount,
            ...(r.language ? { language: r.language } : {}),
          });
          go('language');
          return;
        }
        if (r && r.status === 'expired') { issue(); return; }
        poll(issued);
      }, PAIRING_POLL_MS);
    };

    issue();
    return () => { alive = false; clearTimeout(pollTimer); };
  }, [update, go]);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.1vh', alignItems: 'center' }}>
      <div className="card" style={{
        padding: '14px 16px 12px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 18, width: '92%',
      }}>
        <div style={{
          width: 128, height: 128, flex: 'none', borderRadius: 16, background: '#fff',
          display: 'grid', placeItems: 'center', overflow: 'hidden',
        }}>
          {qr
            ? <img src={qr.qrPngUrl} alt="" style={{ width: '100%', height: '100%' }} draggable={false} />
            : <span className="hint" style={{ fontSize: 12 }}>{failed ? '· · ·' : ''}</span>}
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <p className="display" style={{ fontSize: 'clamp(17px, 2.4vh, 24px)', lineHeight: 1.3, marginBottom: 6 }}>
            {t('attract.scanTitle')}
          </p>
          <p className="hint" style={{ fontSize: 'clamp(12px, 1.6vh, 15px)', lineHeight: 1.55 }}>
            {t('attract.scanBody')}
          </p>
          {failed && (
            <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6, fontWeight: 700 }}>
              {t('attract.scanRetry')}
            </p>
          )}
        </div>
      </div>
      <p className="hint" style={{ fontSize: 'clamp(11px, 1.5vh, 14px)' }}>
        ⏱ Approx. 5 min
      </p>
    </div>
  );
}

/* ────────────────────── S01. 언어 선택 ────────────────────── */

const LANGS: { code: Language; label: string; short: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', short: 'VN', flag: 'flag-vn' },
  { code: 'en', label: 'English', short: 'EN', flag: 'flag-en' },
  { code: 'ko', label: '한국어', short: 'KR', flag: 'flag-kr' },
];

export function LanguageScreen() {
  const { s, update, go } = useStore();
  const [selected, setSelected] = useState<Language>(s.language ?? 'vi');

  const pick = (code: Language) => {
    setSelected(code);
    update({ language: code }); // 선택 즉시 전체 UI 언어 반영
  };

  // 세션은 페어링 시점에 이미 만들어져 있다. 여기서는 언어만 확정한다.
  const next = async () => {
    go('intro');
    if (!s.sessionId) { update({ offline: true }); return; }
    const res = await api.setLanguage(s.sessionId, selected);
    update({ offline: res === null });
  };

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: '2.4vh', paddingTop: '9%' }}>
      {/* 장식 — 화면 가장자리에 걸치게 배치 (텍스트 간섭 방지) */}
      <Deco name="heart-glossy" style={{ top: '3%', left: '-9%', width: '18%', opacity: 0.7 }} />
      <Deco name="heart-diamond" style={{ top: '7%', right: '-8%', width: '22%', animationDelay: '1.6s' }} />
      <Deco name="heart-small" style={{ bottom: '3%', left: '-2%', width: '13%', animationDelay: '2.6s' }} />
      <Deco name="heart-glossy" style={{ bottom: '6%', right: '-6%', width: '18%', animationDelay: '3.4s', opacity: 0.7 }} />
      <span className="sparkle" style={{ top: '4.5%', left: '11%', fontSize: 20 }}>✦</span>
      <span className="sparkle" style={{ top: '15%', right: '20%', fontSize: 15 }}>✧</span>
      <span className="sparkle" style={{ bottom: '11%', right: '12%', fontSize: 18 }}>✦</span>

      {/* 세리프 헤드라인 + 하트 디바이더 (시안: 언어 선택 전이므로 영문 고정) */}
      <div>
        <h1 style={{
          fontFamily: "Georgia, 'Palatino Linotype', 'Times New Roman', serif",
          fontSize: 'clamp(30px, 4.8vh, 48px)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}>
          Choose Your <span style={{ color: 'var(--accent)' }}>Language</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: '1.4vh', color: 'var(--accent)' }}>
          <span style={{ width: 44, borderTop: '1.5px solid rgba(242,92,124,0.45)' }} />
          <span style={{ fontSize: 13 }}>♥</span>
          <span style={{ width: 44, borderTop: '1.5px solid rgba(242,92,124,0.45)' }} />
        </div>
        <p className="hint" style={{ marginTop: '1.6vh' }}>Please select your preferred language to begin.</p>
      </div>

      {/* 언어 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.2vh', width: '100%', marginTop: '2.4vh' }}>
        {LANGS.map((l) => {
          const on = selected === l.code;
          return (
            <button key={l.code} onClick={() => pick(l.code)} style={{
              display: 'flex', alignItems: 'center', gap: 20, width: '100%',
              padding: '23px 26px', borderRadius: 36, cursor: 'pointer', font: 'inherit',
              textAlign: 'left', transition: 'all 0.2s ease',
              background: on
                ? 'linear-gradient(180deg, #fa93ad 0%, #f2547d 60%, #ee4270 100%)'
                : '#fff',
              border: on ? '2px solid rgba(255,255,255,0.75)' : '1.5px solid var(--card-border)',
              boxShadow: on
                ? '0 16px 36px rgba(242,92,124,0.45), inset 0 2px 3px rgba(255,255,255,0.55)'
                : '0 8px 22px rgba(242,92,124,0.1)',
            }}>
              <img src={ASSET(l.flag)} alt="" style={{
                width: 66, height: 66, flex: 'none', borderRadius: '50%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              }} />
              <span style={{ flex: 1 }}>
                <span style={{
                  display: 'block', fontSize: 'clamp(13px, 1.8vh, 16px)', fontWeight: 800, letterSpacing: '0.1em',
                  color: on ? 'rgba(255,255,255,0.85)' : 'var(--accent)',
                }}>{l.short}</span>
                <span style={{
                  display: 'block', fontSize: 'clamp(24px, 3.4vh, 33px)', fontWeight: 800, letterSpacing: '-0.01em',
                  color: on ? '#fff' : 'var(--ink)', lineHeight: 1.25,
                }}>{l.label}</span>
              </span>
              <span style={{
                width: 40, height: 40, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: on ? '#fff' : 'transparent',
                border: on ? 'none' : '1.5px solid #e9d3d9',
                color: on ? 'var(--accent)' : '#c9a9b3',
                fontSize: on ? 20 : 18, fontWeight: 900,
                boxShadow: on ? '0 3px 8px rgba(0,0,0,0.15)' : 'none',
              }}>{on ? '✓' : '›'}</span>
            </button>
          );
        })}
      </div>

      <button className="btn" style={{ width: '72%', marginTop: '2.6vh', padding: '23px 0', letterSpacing: '0.14em' }} onClick={next}>
        NEXT
      </button>
    </div>
  );
}

/* ────────────────────── S05. Core Value 안내 ────────────────────── */

/** 시안 젬 에셋 (상단부터 시계방향) */
const INTRO_GEMS = ['gem-gold', 'gem-blue', 'gem-teal', 'gem-pink', 'gem-green', 'gem-purple'];

export function IntroScreen() {
  const { s, go } = useStore();
  const t = makeT(s.language);
  useEffect(() => {
    const id = setTimeout(() => go('core1'), 8000);
    return () => clearTimeout(id);
  }, [go]);

  const R = 110; // 젬 원형 배치 반경
  const GEM = 74; // 젬 크기

  return (
    <div className="screen" style={{ justifyContent: 'center', gap: '2.6vh' }}>
      {/* 장식 하트 (가장자리) */}
      <Deco name="heart-big" style={{ top: '2%', right: '-10%', width: '30%', opacity: 0.8 }} />
      <Deco name="heart-glossy" style={{ top: '30%', left: '-8%', width: '19%', animationDelay: '1.8s', opacity: 0.75 }} />
      <Deco name="heart-glossy" style={{ bottom: '4%', right: '-7%', width: '18%', animationDelay: '2.8s', opacity: 0.7 }} />
      <Deco name="heart-small" style={{ bottom: '15%', left: '-3%', width: '12%', animationDelay: '3.6s' }} />

      {/* 워드마크 */}
      <div style={{ marginBottom: '1vh' }}>
        <Logo height={58} />
      </div>

      {/* 글로시 젬 6개 원형 배치 + 중앙 스파클 */}
      <div style={{ position: 'relative', width: R * 2 + GEM, height: R * 2 + GEM }}>
        <span style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 34, color: '#f8b7c9', textShadow: '0 0 18px rgba(242,92,124,0.5)',
        }}>✦</span>
        {INTRO_GEMS.map((gem, i) => {
          const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          return (
            <motion.img key={gem} src={ASSET(gem)} alt=""
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12 * i, type: 'spring', damping: 12 }}
              style={{
                position: 'absolute', width: GEM, height: GEM,
                left: R + R * Math.cos(ang), top: R + R * Math.sin(ang),
                filter: 'drop-shadow(0 8px 18px rgba(242,92,124,0.28))',
              }} />
          );
        })}
      </div>

      {/* 헤드라인 (Beauty DNA 핑크 강조) + 서브 + 슬로건 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh', alignItems: 'center', marginTop: '1vh' }}>
        <AccentHeadline text={t('intro.title')} />
        <p className="hint" style={{ whiteSpace: 'pre-line', fontSize: 'clamp(14px, 1.9vh, 18px)' }}>{t('intro.sub')}</p>
        <p style={{ fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'var(--accent)' }}>{t('attract.sub')}</p>
      </div>

      <button className="btn" style={{ width: '82%', padding: '23px 0', marginTop: '1.5vh' }} onClick={() => go('core1')}>
        {t('common.start')} <span style={{ fontSize: 18, verticalAlign: 'middle' }}>✦</span>
      </button>
    </div>
  );
}

/* ────────── 게임 사이 브랜드 메시지 (브릿지) ────────── */

/** 브릿지 자동 전환 시간 */
const BRIDGE_MS = 3000;

/**
 * 게임 사이 브랜드 메시지 화면.
 * 디자인 시안이 문구까지 포함된 완성 이미지이므로 전체 화면으로 그대로 표시한다.
 * (문구가 이미지에 구워져 있어 현재는 한국어 고정 — 언어별 이미지가 준비되면 확장)
 */
export function BridgeScreen() {
  const { s, go, update } = useStore();
  const key = s.bridgeAxis;

  useEffect(() => {
    const id = setTimeout(() => {
      update({ bridgeAxis: null });
      go(screenAfterBridge(key));
    }, BRIDGE_MS);
    return () => clearTimeout(id);
  }, [key, go, update]);

  if (!key) return null;

  return (
    <div className="screen" style={{ padding: 0, justifyContent: 'center' }}>
      <motion.img key={key} src={ASSET(`bridge-${key}`, 'jpg')} alt="" draggable={false}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  );
}

/* ────────────────────── S12. DNA 분석 ────────────────────── */

export function AnalyzingScreen() {
  const { s, update, go } = useStore();
  const t = makeT(s.language);
  const started = useRef(false);
  const [progress, setProgress] = useState(0);

  // 진행률 연출 — 최소 대기(8초) 동안 0→96%까지 차오르고, 완료 시 100%
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      setProgress((p) => (p >= 96 ? p : Math.min(96, Math.round(((Date.now() - t0) / 3500) * 96))));
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // 로컬 점수 (항상 계산 — 오프라인 폴백)
    const localScores = Object.fromEntries(
      AXES.map((a) => [a, s.results[a as Axis]?.score ?? 50]),
    ) as Scores;
    const localPersona = determinePersona(localScores);

    const minWait = new Promise((r) => setTimeout(r, 3500));
    const serverCall = s.sessionId ? api.complete(s.sessionId) : Promise.resolve(null);

    Promise.all([minWait, serverCall]).then(([, res]) => {
      if (res) {
        update({
          scores: res.scores, persona: res.persona, percentile: res.percentile,
          resultToken: res.resultToken, qrPngUrl: res.qrPngUrl, resultUrl: res.resultUrl,
          products: res.products, offline: false,
        });
      } else {
        update({ scores: localScores, persona: localPersona.personaId, offline: true });
      }
      setProgress(100);
      go('dnaResult');
    });
  }, [s.sessionId, s.results, update, go]);

  const R = 132; // 젬 궤도 반경
  const GEM = 62;
  const STAGE = R * 2 + GEM;

  return (
    <div className="screen dark-stage" style={{ justifyContent: 'center', gap: '3vh' }}>
      {/* 궤도 + DNA 오브 + 아이콘 젬 6종 */}
      <div style={{ position: 'relative', width: STAGE, height: STAGE, display: 'grid', placeItems: 'center' }}>
        {[0.72, 0.88, 1.04].map((f, i) => (
          <motion.div key={f}
            animate={{ rotate: i % 2 ? -360 : 360 }}
            transition={{ duration: 26 + i * 8, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', width: STAGE * f, height: STAGE * f, borderRadius: '50%',
              border: '1px solid rgba(255,190,212,0.22)', borderTopColor: 'rgba(255,190,212,0.6)',
            }} />
        ))}
        <motion.img src={ASSET('dna-orb')} alt="" draggable={false}
          animate={{ scale: [1, 1.045, 1], opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: STAGE * 0.62, height: 'auto', filter: 'drop-shadow(0 0 40px rgba(242,92,124,0.7))' }} />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0 }}>
          {[1, 2, 3, 4, 5, 6].map((n, i) => {
            const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            return (
              <motion.img key={n} src={ASSET(`dna-gem-${n}`)} alt="" draggable={false}
                animate={{ rotate: -360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', width: GEM, height: GEM,
                  left: STAGE / 2 - GEM / 2 + R * Math.cos(ang),
                  top: STAGE / 2 - GEM / 2 + R * Math.sin(ang),
                  filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.35))',
                }} />
            );
          })}
        </motion.div>
      </div>

      {/* 헤드라인 + 서브 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4vh', alignItems: 'center' }}>
        <h1 className="display" style={{ whiteSpace: 'pre-line', fontSize: 'clamp(24px, 3.9vh, 40px)' }}>
          {t('dna.analyzing').split(/(Beauty DNA)/).map((part, i) =>
            part === 'Beauty DNA'
              ? <span key={i} style={{ color: 'var(--accent)' }}>Beauty DNA</span>
              : <React.Fragment key={i}>{part}</React.Fragment>,
          )}
        </h1>
        <p className="hint" style={{ whiteSpace: 'pre-line' }}>{t('dna.analyzingSub')}</p>
      </div>

      {/* 진행 바 */}
      <div style={{
        width: '86%', padding: '12px 20px', borderRadius: 999,
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,190,212,0.28)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 'clamp(12px, 1.7vh, 15px)', fontWeight: 700, color: 'rgba(255,214,226,0.9)', whiteSpace: 'nowrap' }}>
          {t('dna.analyzingProgress')}
        </span>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`, borderRadius: 999,
            transition: 'width 0.2s linear',
            background: 'linear-gradient(90deg, #fa93ad, var(--accent-deep))',
            boxShadow: '0 0 12px rgba(242,92,124,0.8)',
          }} />
        </div>
        <span style={{ fontSize: 'clamp(18px, 2.6vh, 26px)', fontWeight: 900, color: 'var(--accent)', minWidth: 62, textAlign: 'right' }}>
          {progress}%
        </span>
      </div>

      {/* 하단 배지 */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderRadius: 999,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,190,212,0.3)',
        fontSize: 'clamp(12px, 1.7vh, 16px)', fontWeight: 700, color: 'rgba(255,232,240,0.95)',
      }}>
        <span style={{ color: 'var(--accent)' }}>✦</span>
        {t('dna.analyzingComing')}
        <span style={{ color: 'var(--accent)' }}>✦</span>
      </div>
    </div>
  );
}

/* ────────────────────── S13. DNA 결과 ────────────────────── */

export function DnaResultScreen() {
  const { s, go } = useStore();
  const t = makeT(s.language);
  const tr = makeTr(s.language);
  if (!s.persona || !s.scores) return null;
  const p = PERSONAS[s.persona];
  const keywords = tr<string[]>(`dna.personas.${s.persona}.keywords`) ?? [];
  return (
    <div className="screen" style={{ justifyContent: 'center', padding: '6% 5% 4%' }}>
      <Deco name="heart-glossy" style={{ bottom: '6%', left: '-7%', width: '17%', opacity: 0.7 }} />
      <Deco name="heart-diamond" style={{ bottom: '14%', right: '-7%', width: '19%', animationDelay: '1.8s' }} />

      {/* 글래스 결과 카드 */}
      <div style={{
        width: '100%', flex: 1, minHeight: 0, borderRadius: 40, padding: '3.5% 5%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,240,245,0.85))',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 18px 50px rgba(242,92,124,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* 배지 + You are a */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2vh' }}>
          <span style={{
            padding: '7px 22px', borderRadius: 999, border: '1.5px solid rgba(242,92,124,0.45)',
            background: 'rgba(255,255,255,0.75)', color: 'var(--accent)',
            fontSize: 'clamp(11px, 1.6vh, 14px)', fontWeight: 800, whiteSpace: 'nowrap',
          }}>✦ {t('dna.resultBadge')} ✦</span>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: '0.24em',
            fontSize: 'clamp(13px, 1.9vh, 17px)', color: 'var(--ink-dim)', textIndent: '0.24em',
          }}>✦ {t('dna.youAre')} ✦</p>
        </div>

        {/* 페르소나명 + 하트 젬 */}
        <div style={{ position: 'relative', width: '100%' }}>
          <motion.h1 initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700,
              fontSize: 'clamp(28px, 5.1vh, 50px)', lineHeight: 1.06, letterSpacing: '-0.01em',
              color: 'var(--accent)', textShadow: '0 4px 18px rgba(242,92,124,0.25)',
              padding: '0 14% 0 4%', // 우측 하트 젬과 겹치지 않도록 여백 확보
            }}>
            {p.name}
          </motion.h1>
          <img src={ASSET('heart-gem')} alt="" draggable={false}
            style={{ position: 'absolute', right: '-3%', top: '50%', transform: 'translateY(-50%)', width: '17%', height: 'auto' }} />
        </div>

        {/* 디바이더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '70%', color: 'var(--accent)' }}>
          <span style={{ flex: 1, borderTop: '1px solid rgba(242,92,124,0.35)' }} />
          <span style={{ fontSize: 11 }}>✦</span>
          <span style={{ flex: 1, borderTop: '1px solid rgba(242,92,124,0.35)' }} />
        </div>

        {/* 설명 + 키워드 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.4vh' }}>
          <p style={{ whiteSpace: 'pre-line', fontWeight: 800, fontSize: 'clamp(15px, 2.3vh, 22px)', lineHeight: 1.4 }}>
            {t(`dna.personas.${s.persona}.desc`)}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {keywords.map((k) => (
              <span key={k} style={{
                padding: '7px 16px', borderRadius: 999, background: '#fff',
                border: '1.5px solid rgba(242,92,124,0.35)', color: 'var(--accent)',
                fontSize: 'clamp(12px, 1.8vh, 16px)', fontWeight: 700,
              }}>#{k}</span>
            ))}
          </div>
        </div>

        {/* 레이더 차트 (축 아이콘 포함) */}
        <RadarChart scores={s.scores} size={330} withIcons />

        {/* 참여자 비율 배지 */}
        {!s.offline && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 20px 8px 8px', borderRadius: 999,
            background: 'rgba(255,255,255,0.9)', border: '1px solid var(--card-border)',
            boxShadow: '0 4px 14px rgba(242,92,124,0.12)',
          }}>
            <img src={ASSET('heart-badge')} alt="" draggable={false} style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 'clamp(12px, 1.8vh, 16px)', fontWeight: 700 }}>
              {t('dna.percentile', { p: s.percentile })}
            </span>
          </div>
        )}
      </div>

      <button className="btn" style={{ width: '88%', padding: '22px 0', marginTop: '2.4vh' }} onClick={() => go('qr')}>
        {t('dna.viewAura')} ✨
      </button>
    </div>
  );
}

/* ────────────────────── S15. QR·추천 ────────────────────── */

export function QrScreen() {
  const { s, go } = useStore();
  const t = makeT(s.language);
  useEffect(() => {
    if (s.resultToken) api.sendEvent('qr.issued', s.sessionId);
  }, [s.resultToken, s.sessionId]);
  const p = s.persona ? PERSONAS[s.persona] : null;
  return (
    <div className="screen" style={{ justifyContent: 'center', gap: 20 }}>
      <h1 className="display" style={{ fontSize: 'clamp(22px,3.2vh,34px)' }}>{t('qr.scanTitle')}</h1>
      {s.qrPngUrl ? (
        <div className="card" style={{ padding: 22, background: '#fff', borderRadius: 24 }}>
          <img src={s.qrPngUrl} alt="QR" style={{ width: 240, height: 240, display: 'block' }} />
        </div>
      ) : (
        <div className="card" style={{ padding: 40 }}>
          <p className="hint">QR unavailable (offline)</p>
        </div>
      )}
      <div>
        <p className="hint">⏳ {t('qr.retention')}</p>
        <p className="hint">🗑 {t('qr.deleteNotice')}</p>
      </div>
      {s.products.length > 0 && p && (
        <div style={{ width: '100%' }}>
          <p className="question" style={{ marginBottom: 12 }}>{t('qr.productsTitle', { persona: p.name })}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            {s.products.map((prod) => (
              <div key={prod.id} className="card" style={{ flex: 1, padding: 16 }}>
                <div style={{ fontSize: 36 }}>🧴</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{prod.name[s.language]}</div>
                <div className="hint" style={{ fontSize: 12, marginTop: 4 }}>{t(prod.reasonKey)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className="btn" onClick={() => go('end')}>{t('qr.finish')}</button>
    </div>
  );
}

/* ────────────────────── S16. 종료 ────────────────────── */

export function EndScreen() {
  const { s, resetSession } = useStore();
  const t = makeT(s.language);
  useEffect(() => {
    api.sendEvent('session.completed', s.sessionId);
    const id = setTimeout(resetSession, 8000);
    return () => clearTimeout(id);
  }, [resetSession, s.sessionId]);
  // 체험 마무리 화면 — 디자인 시안(문구 포함 완성 이미지)을 전체 화면으로 표시
  return (
    <div className="screen" style={{ padding: 0, justifyContent: 'center' }}>
      <motion.img src={ASSET('end-final', 'jpg')} alt={t('end.thanks')} draggable={false}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  );
}
