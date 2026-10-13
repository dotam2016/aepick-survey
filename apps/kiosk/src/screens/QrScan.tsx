import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsQR from 'jsqr';
import { useStore } from '../state';
import { makeT } from '../i18n';
import { API_BASE, DEVICE_ID } from '../api';

// 이벤트 체크인 시스템(Zalo)이 발급한 QR에는 전화번호 하나만 들어있다.
// 이름·성별·생년월일 조회는 서버(/api/qr-lookup)를 거친다 — 조회용 람다의 CORS가
// 운영 프론트 origin 하나만 허용해, 브라우저에서 직접 부르면 로컬 개발 등 다른
// origin에서는 항상 막힌다.
const PHONE_RE = /^0\d{9}$/;

export interface QrProfile {
  fullName: string;
  gender: 'male' | 'female' | 'other' | null;
  ageGroup: string | null;
  phone: string;
  /** 이 번호로 이미 완료한 유효한 결과가 있으면 채워진다 — 게임 없이 QR 화면으로 이동 */
  existingResult?: { resultToken: string; resultUrl: string; qrPngUrl: string } | null;
}

export type QrLookupResult =
  | { ok: true; profile: QrProfile }
  // invalid: QR 자체가 잘못됨(형식 불일치·미등록 번호) — 다른 QR을 시도해야 한다.
  // claimed: 이미 선물을 수령한 번호 — 더 이상 참여 불가.
  // network: 서버/네트워크 문제 — QR은 정상이니 잠시 후 같은 QR로 재시도하면 된다.
  | { ok: false; reason: 'invalid' | 'network' | 'claimed' };

/** QR에서 읽은 문자열이 전화번호 형태가 아니면 조회 없이 바로 무효 처리한다. */
export async function lookupProfileByPhone(raw: string, sessionId?: string | null): Promise<QrLookupResult> {
  const phone = raw.trim();
  if (!PHONE_RE.test(phone)) return { ok: false, reason: 'invalid' };
  const url = `${API_BASE}/api/qr-lookup?phone=${encodeURIComponent(phone)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
  try {
    const res = await fetch(url, { headers: { 'X-Device-Id': DEVICE_ID } });
    // 400/404 = 번호 형식 오류·미등록 번호(QR 문제), 그 외(5xx 등)만 서버/네트워크 문제로 본다.
    if (res.status === 409) return { ok: false, reason: 'claimed' };
    if (res.status === 400 || res.status === 404) return { ok: false, reason: 'invalid' };
    if (!res.ok) return { ok: false, reason: 'network' };
    const json = await res.json();
    if (!json.ok || !json.data) return { ok: false, reason: 'invalid' };
    return { ok: true, profile: json.data as QrProfile };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/**
 * 한 프레임에서 QR을 읽는다. 브라우저 내장 BarcodeDetector(Chrome/Android)가 있으면 먼저 쓰고
 * (장식형·도트형 QR에도 강하다), 없거나 못 읽으면 jsQR로 폴백한다.
 * jsQR은 해상도가 큰 카메라 프레임(1080p+)에서 화면 QR의 모아레·노이즈에 약해,
 * 긴 변 720px로 줄인 사본을 먼저 시도하고 실패하면 원본 해상도로 한 번 더 시도한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nativeDetector: any = typeof (window as any).BarcodeDetector === 'function'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ? new (window as any).BarcodeDetector({ formats: ['qr_code'] }) : null;

async function decodeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<string | null> {
  const w = video.videoWidth, h = video.videoHeight;
  if (nativeDetector) {
    try {
      const found = await nativeDetector.detect(video);
      if (found[0]?.rawValue) return found[0].rawValue as string;
    } catch { /* 폴백 */ }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const scale = Math.min(1, 720 / Math.max(w, h));
  for (const k of scale < 1 ? [scale, 1] : [1]) {
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height);
    if (code?.data) return code.data;
  }
  return null;
}

/** 동의 화면 위에 뜨는 QR 스캔 오버레이. 후면 카메라로 프레임을 계속 읽어 jsQR로 디코딩한다. */
export function QrScanOverlay({ onResult, onClose }: { onResult: (profile: QrProfile) => void; onClose: () => void }) {
  const { s } = useStore();
  const t = makeT(s.language);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<'camera' | 'invalid' | 'network' | 'claimed' | null>(null);
  const [loading, setLoading] = useState(false);
  // 오류 팝업이 떠 있는 동안·"다시 시도"를 누르기 전까지는 같은 QR을 다시 조회하지 않는다.
  const blockedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let done = false;
    let looking = false;

    let busy = false;
    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !busy && !done && !looking && !blockedRef.current) {
        busy = true;
        decodeFrame(video, canvas).then((data) => {
          busy = false;
          // 조회 중엔(looking) 같은 QR을 계속 들이대도 매 프레임 재요청하지 않는다.
          if (!data || cancelled || done || looking || blockedRef.current) return;
          looking = true;
          setLoading(true);
          lookupProfileByPhone(data, s.sessionId).then((result) => {
            if (cancelled) return;
            looking = false;
            if (result.ok) {
              done = true; // 로딩은 유지 — 부모가 오버레이를 닫으며 언마운트된다
              onResult(result.profile);
            } else {
              setLoading(false);
              blockedRef.current = true;
              setError(result.reason);
            }
          });
        });
      }
      if (!done) rafId = requestAnimationFrame(tick);
    }

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        if (!cancelled) setError('camera');
      }
    })();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [onResult]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(10,6,10,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      }}
    >
      <div
        style={{
          position: 'relative', width: 'min(70vw, 420px)', aspectRatio: '1 / 1', borderRadius: 24, overflow: 'hidden',
          border: '3px solid var(--pink)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', background: '#000',
        }}
      >
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,6,10,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.25)',
              borderTopColor: 'var(--pink)', animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', minHeight: 22 }}>
        {t('consent.qrScanTitle')}
      </p>
      <button className="btn ghost" style={{ padding: '10px 28px' }} onClick={onClose}>
        {t('consent.qrScanCancel')}
      </button>
      {/* 오류(카메라·서버·유효하지 않은 QR)는 앱 공통 다이얼로그로 안내한다 (네이티브 alert 사용 안 함) */}
      <AnimatePresence>
        {error && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal card" style={{ maxWidth: 420 }} initial={{ y: 60 }} animate={{ y: 0 }}>
              <p style={{ fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                {error === 'camera' ? t('consent.qrScanCameraError')
                  : error === 'invalid' ? t('consent.qrScanInvalid')
                  : error === 'claimed' ? t('consent.qrScanClaimed') : t('consent.qrScanNetworkError')}
              </p>
              <button className="btn small"
                onClick={error === 'camera' || error === 'claimed' ? onClose : () => { blockedRef.current = false; setError(null); }}>
                {error === 'claimed' ? t('consent.qrScanClose')
                  : error === 'camera' ? t('consent.qrScanCancel') : t('common.retry')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
