import { createHash } from 'node:crypto';

/**
 * ────────────────────────────────────────────────────────────────
 *  aepick app 연동 지점  (BE 개발자 인계 대상)
 * ────────────────────────────────────────────────────────────────
 *
 * 고객이 PAD의 QR을 찍으면 aepick app(쇼핑몰) 계정과 체험 세션을 잇는다.
 * 그 "계정을 확인하는 방법"은 app 팀과 협의가 끝나야 정해지므로,
 * 여기서 인터페이스로 격리하고 지금은 목업으로 동작시킨다.
 *
 * 교체 방법: resolve() 만 실제 구현으로 바꾸면 나머지 코드는 그대로 둔다.
 *
 * ── app 팀에 확인해야 할 사항 ──────────────────────────────────
 *  1) QR을 누가 인식하는가?
 *     (a) app 내장 스캐너가 직접 읽는다        → app이 우리 API를 호출
 *     (b) 폰 기본 카메라가 읽고 딥링크로 app을 연다 → 딥링크 스킴 필요
 *     현재 목업은 (b)를 가정해 웹 페이지를 연다.
 *  2) 사용자 신원을 무엇으로 증명하는가?
 *     서명된 토큰(JWT 등)을 권장한다. 평문 user id 만 받으면
 *     타인의 id 를 넣어 방문 횟수를 조작할 수 있다.
 *  3) 우리가 받을 수 있는 필드는?
 *     필수: 사용자 식별자 / 선택: 선호 언어, 회원 등급
 *  4) 체험 완료 시 푸시를 보낼 수 있는가? (있으면 좋은 것, 없어도 무방)
 */

export interface AppIdentity {
  /** app 계정 식별자 원문. 서버에 그대로 저장하지 않는다(해시 후 저장). */
  appUserId: string;
  /** app 계정의 선호 언어. 없으면 PAD에서 선택한 언어를 쓴다. */
  language?: string;
}

export interface IdentityProvider {
  readonly name: string;
  /**
   * 폰이 보낸 자격 증명을 검증해 신원을 돌려준다.
   * 검증에 실패하면 null 을 반환한다(예외를 던지지 않는다).
   */
  resolve(credential: string): Promise<AppIdentity | null>;
}

/**
 * 목업 — 협의 전까지 쓰는 구현.
 * 폰 화면에서 아무 문자열이나 "계정"으로 받아 그대로 신원으로 인정한다.
 * 검증이 전혀 없으므로 실제 운영에 그대로 쓰면 안 된다.
 */
const mockProvider: IdentityProvider = {
  name: 'mock',
  async resolve(credential) {
    const id = credential.trim();
    if (!id) return null;
    return { appUserId: id };
  },
};

/**
 * 실제 구현 자리.
 * 예: app이 발급한 JWT를 검증하고 sub 클레임을 appUserId 로 쓴다.
 *
 *   const realProvider: IdentityProvider = {
 *     name: 'aepick-app',
 *     async resolve(token) {
 *       const payload = await verifyJwt(token, process.env.AEPICK_APP_JWT_PUBLIC_KEY!);
 *       return payload ? { appUserId: payload.sub, language: payload.lang } : null;
 *     },
 *   };
 */

export const identityProvider: IdentityProvider = mockProvider;

/** app 계정 원문을 저장하지 않기 위한 단방향 해시(개인정보 최소화). */
export function visitorIdOf(appUserId: string): string {
  const salt = process.env.VISITOR_HASH_SALT ?? 'aepick-dev-salt';
  return createHash('sha256').update(`${salt}:${appUserId}`).digest('base64url').slice(0, 22);
}

export const isIdentityMocked = identityProvider.name === 'mock';
