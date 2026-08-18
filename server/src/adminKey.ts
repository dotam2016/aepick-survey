import { randomBytes } from 'node:crypto';

/**
 * 운영자 대시보드 키.
 *
 * 로컬/LAN 시연에서는 외우기 쉬운 기본값을 쓰지만,
 * TUNNEL=1(Cloudflare Tunnel로 공개)일 때는 기본값을 쓰지 않는다.
 * 터널 주소는 인터넷 어디서나 열리므로 기본 키를 그대로 두면
 * 누구나 참가자 통계·세션 목록에 접근할 수 있기 때문.
 */
const TUNNELED = process.env.TUNNEL === '1';

export const ADMIN_KEY =
  process.env.ADMIN_KEY ?? (TUNNELED ? randomBytes(9).toString('base64url') : 'aepick-admin');

/** 콘솔 배너에서 키를 그대로 보여줘도 되는지(로컬 전용일 때만) */
export const ADMIN_KEY_IS_DEFAULT = !process.env.ADMIN_KEY && !TUNNELED;
