import React, { useEffect, useRef, useState } from 'react';
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
}

/** QR에서 읽은 문자열이 전화번호 형태가 아니면 조회 없이 바로 무효 처리한다.
 *  `onLog`는 화면에 직접 진행 상황을 찍기 위한 디버그용 콜백 — 폰으로 테스트할 때
 *  devtools를 못 켜는 상황을 위한 임시 로그다. */
export async function lookupProfileByPhone(raw: string, onLog?: (msg: string) => void): Promise<QrProfile | null> {
  const phone = raw.trim();
  onLog?.(`Kết quả quét QR: "${raw}"`);
  if (!PHONE_RE.test(phone)) {
    onLog?.(`Không đúng định dạng SĐT (10 số, bắt đầu bằng 0) → bỏ qua`);
    return null;
  }
  const url = `${API_BASE}/api/qr-lookup?phone=${encodeURIComponent(phone)}`;
  onLog?.(`Gọi API: ${url}`);
  try {
    const res = await fetch(url, { headers: { 'X-Device-Id': DEVICE_ID } });
    const text = await res.text();
    onLog?.(`Kết quả API (HTTP ${res.status}): ${text.slice(0, 500)}`);
    if (!res.ok) return null;
    const json = JSON.parse(text);
    if (!json.ok || !json.data) return null;
    return json.data as QrProfile;
  } catch (e) {
    onLog?.(`Lỗi mạng: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** 동의 화면 위에 뜨는 QR 스캔 오버레이. 후면 카메라로 프레임을 계속 읽어 jsQR로 디코딩한다. */
export function QrScanOverlay({ onResult, onClose }: { onResult: (profile: QrProfile) => void; onClose: () => void }) {
  const { s } = useStore();
  const t = makeT(s.language);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<'camera' | 'invalid' | null>(null);
  // 폰으로 테스트할 땐 devtools를 못 켜니, 진행 상황을 화면에 직접 찍는다 (임시 디버그용).
  const [logs, setLogs] = useState<string[]>([]);
  const pushLog = (msg: string) => setLogs((prev) => [...prev.slice(-11), msg]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let done = false;
    let looking = false;

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
          // 조회 중엔(looking) 같은 QR을 계속 들이대도 매 프레임 재요청하지 않는다.
          if (code && code.data && !done && !looking) {
            looking = true;
            lookupProfileByPhone(code.data, pushLog).then((profile) => {
              if (cancelled) return;
              looking = false;
              if (profile) {
                done = true;
                pushLog(`✅ Thành công: ${profile.fullName || '(không tên)'} / ${profile.gender ?? '?'} / ${profile.ageGroup ?? '?'} / ${profile.phone}`);
                // 성공 로그를 잠깐 보여준 뒤 다음 화면으로 넘어간다.
                setTimeout(() => { if (!cancelled) onResult(profile); }, 5000);
              } else {
                setError('invalid');
              }
            });
          }
        }
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
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <p style={{ color: '#fff', fontSize: 15, textAlign: 'center', minHeight: 22 }}>
        {error === 'camera' ? t('consent.qrScanCameraError') : error === 'invalid' ? t('consent.qrScanInvalid') : t('consent.qrScanTitle')}
      </p>
      <button className="btn ghost" style={{ padding: '10px 28px' }} onClick={onClose}>
        {t('consent.qrScanCancel')}
      </button>
      {/* 임시 디버그 로그 — devtools 없이 폰에서 테스트할 때 진행 상황을 바로 보기 위함 */}
      {logs.length > 0 && (
        <pre style={{
          width: '100%', maxWidth: 480, maxHeight: '28vh', overflowY: 'auto',
          background: 'rgba(0,0,0,0.6)', color: '#9f9', fontSize: 11, lineHeight: 1.5,
          padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
        }}>
          {logs.join('\n')}
        </pre>
      )}
    </div>
  );
}
