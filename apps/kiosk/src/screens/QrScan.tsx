import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { useStore } from '../state';
import { makeT } from '../i18n';

const VALID_GENDERS = new Set(['male', 'female']);
const VALID_AGE_GROUPS = new Set(['teen', 'twenties', 'thirties', 'fortyPlus', 'skip']);

export interface QrProfile {
  fullName: string;
  gender: 'male' | 'female' | null;
  ageGroup: string | null;
}

/** QR 내용은 `{"fullName":"...","gender":"male|female","ageGroup":"teen|twenties|thirties|fortyPlus|skip"}` 형태의 JSON이어야 한다.
 *  개별 필드가 유효하지 않으면 그 필드만 비워두고, 파싱 자체가 실패하면 null을 반환해 재스캔을 유도한다. */
export function parseQrPayload(raw: string): QrProfile | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const fullName = typeof o.fullName === 'string' ? o.fullName.trim() : '';
  const gender = typeof o.gender === 'string' && VALID_GENDERS.has(o.gender) ? (o.gender as 'male' | 'female') : null;
  const ageGroup = typeof o.ageGroup === 'string' && VALID_AGE_GROUPS.has(o.ageGroup) ? o.ageGroup : null;
  return { fullName, gender, ageGroup };
}

/** 동의 화면 위에 뜨는 QR 스캔 오버레이. 후면 카메라로 프레임을 계속 읽어 jsQR로 디코딩한다. */
export function QrScanOverlay({ onResult, onClose }: { onResult: (profile: QrProfile) => void; onClose: () => void }) {
  const { s } = useStore();
  const t = makeT(s.language);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<'camera' | 'invalid' | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let done = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code && code.data && !done) {
            const profile = parseQrPayload(code.data);
            if (profile) {
              done = true;
              onResult(profile);
              return;
            }
            setError('invalid');
          }
        }
      }
      rafId = requestAnimationFrame(tick);
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
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', minHeight: 22 }}>
        {error === 'camera' ? t('consent.qrScanCameraError') : error === 'invalid' ? t('consent.qrScanInvalid') : t('consent.qrScanTitle')}
      </p>
      <button className="btn ghost" style={{ padding: '10px 28px' }} onClick={onClose}>
        {t('consent.qrScanCancel')}
      </button>
    </div>
  );
}
