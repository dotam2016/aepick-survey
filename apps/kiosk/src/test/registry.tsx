/**
 * 갤러리에 나오는 모든 화면의 목록.
 *
 * 새 화면을 추가하면 여기에 한 줄만 넣으면 갤러리에 바로 나온다.
 * `source`는 그 화면을 고칠 때 열어야 하는 파일이다 (갤러리 하단에 표시된다).
 */
import React from 'react';
import type { PersonaId, Scores } from '@aepick/shared';
import type { ScreenId, SessionState } from '../state';
import { CompleteToast, TimeoutGuard } from '../components';
import {
  AttractScreen, LanguageScreen, ConsentScreen, IntroScreen, BridgeScreen,
  AnalyzingScreen, DnaResultScreen, QrScreen, EndScreen,
} from '../screens/flow';
import { Core1Screen, Core2Screen, Core3Screen, Core4Screen, Core5Screen, Core6Screen } from '../screens/games';
import { QrScanOverlay } from '../screens/QrScan';
import {
  MOCK_KIOSK_PRODUCTS, MOCK_PAIR_CODE, MOCK_PERCENTILE, MOCK_PERSONA,
  MOCK_SCORES, MOCK_SESSION_ID, MOCK_TOKEN, fakeQrDataUri,
} from './mockData';

export type Group = 'flow' | 'game' | 'bridge' | 'overlay' | 'mobile' | 'admin';

export const GROUP_LABEL: Record<Group, string> = {
  flow: '① Luồng chính · PAD',
  game: '② 6 Core Game · PAD',
  bridge: '③ Bridge (thông điệp giữa game)',
  overlay: '④ Overlay / Popup',
  mobile: '⑤ Web trên điện thoại',
  admin: '⑥ Trang vận hành (desktop)',
};

export interface ScreenEntry {
  id: string;
  group: Group;
  /** 화면 번호 (기능정의서 기준) */
  code?: string;
  label: string;
  note: string;
  /** 이 화면을 고칠 때 여는 파일 */
  source: string;
  kind: 'kiosk' | 'web';
  /* kiosk */
  Comp?: React.ComponentType;
  state?: Partial<SessionState>;
  /** 상단 공통 브랜드 워드마크 표시 여부 (기본: attract·intro만 제외) */
  header?: boolean;
  /* web */
  path?: string;
  device?: 'phone' | 'desktop';
}

const FLOW = 'apps/kiosk/src/screens/flow.tsx';
const GAMES = 'apps/kiosk/src/screens/games.tsx';
const COMPONENTS = 'apps/kiosk/src/components.tsx';

/** DNA 결과 이후 화면들이 공유하는 완료 상태 */
const RESULT_STATE: Partial<SessionState> = {
  sessionId: MOCK_SESSION_ID,
  scores: MOCK_SCORES as Scores,
  persona: MOCK_PERSONA as PersonaId,
  percentile: MOCK_PERCENTILE,
  resultToken: MOCK_TOKEN,
  qrPngUrl: fakeQrDataUri(),
  resultUrl: `/r/${MOCK_TOKEN}`,
  products: MOCK_KIOSK_PRODUCTS,
  fullName: 'Nguyễn Thu Hà',
  gender: 'female',
  ageGroup: 'twenties',
};

/** 타임아웃 경고 모달을 바로 띄우기 위한 래퍼 (10초 = 경고 구간이 즉시 시작) */
function TimeoutPreview() {
  return (
    <TimeoutGuard seconds={10}>
      <ConsentScreen />
    </TimeoutGuard>
  );
}

/** 게임 완료 토스트 미리보기 — onDone을 비워 두면 사라지지 않고 계속 보인다 */
function ToastPreview() {
  return (
    <>
      <Core2Screen />
      <CompleteToast message="✨ Bạn đầu tư thông minh — Smart Value!" onDone={() => {}} />
    </>
  );
}

/** S02 화면의 "Quét QR & bắt đầu" 버튼을 누른 직후 뜨는 오버레이 미리보기 */
function QrScanPreview() {
  return <QrScanOverlay onResult={() => {}} onClose={() => {}} />;
}

const bridge = (axis: string, label: string): ScreenEntry => ({
  id: `bridge-${axis}`,
  group: 'bridge',
  label,
  note: 'Ảnh full-screen chèn giữa các game. Đổi ảnh: public/assets/ui/bridge-*.jpg (3 giây rồi tự chuyển).',
  source: FLOW,
  kind: 'kiosk',
  Comp: BridgeScreen,
  state: { screen: 'bridge' as ScreenId, bridgeAxis: axis as SessionState['bridgeAxis'] },
});

export const SCREENS: ScreenEntry[] = [
  /* ── ① 루트 플로우 ── */
  {
    id: 'attract', group: 'flow', code: 'S00', label: 'Màn hình chờ (Attract)',
    note: 'Màn hình đứng yên khi chưa có khách. Số liệu lấy từ /api/stats/today (ở bản test là dữ liệu giả).',
    source: FLOW, kind: 'kiosk', Comp: AttractScreen, state: { screen: 'attract' },
  },
  {
    id: 'language', group: 'flow', code: 'S01', label: 'Chọn ngôn ngữ',
    note: 'Chọn VI / EN / KO. Bấm thẳng vào thẻ để xem trạng thái được chọn.',
    source: FLOW, kind: 'kiosk', Comp: LanguageScreen, state: { screen: 'language' },
  },
  {
    id: 'consent', group: 'flow', code: 'S02', label: 'Đồng ý & thông tin',
    note: 'Hai ô đồng ý bắt buộc + họ tên + giới tính + nhóm tuổi. Nút Bắt đầu chỉ bật khi đủ.',
    source: FLOW, kind: 'kiosk', Comp: ConsentScreen, state: { screen: 'consent' },
  },
  {
    id: 'intro', group: 'flow', code: 'S05', label: 'Giới thiệu 6 Core',
    note: '6 viên gem xoay quanh tâm. Ở bản thật màn này tự chuyển sau 8 giây.',
    source: FLOW, kind: 'kiosk', Comp: IntroScreen, state: { screen: 'intro' },
  },
  {
    id: 'analyzing', group: 'flow', code: 'S12', label: 'Đang phân tích DNA',
    note: 'Nền tối (.dark-stage), quả cầu DNA + thanh tiến trình chạy tới 100%.',
    source: FLOW, kind: 'kiosk', Comp: AnalyzingScreen,
    state: { screen: 'analyzing', sessionId: MOCK_SESSION_ID },
  },
  {
    id: 'dnaResult', group: 'flow', code: 'S13', label: 'Kết quả Beauty DNA',
    note: 'Persona + từ khoá + biểu đồ radar 6 trục. Persona mẫu: Trend Muse.',
    source: FLOW, kind: 'kiosk', Comp: DnaResultScreen,
    state: { ...RESULT_STATE, screen: 'dnaResult' },
  },
  {
    id: 'qr', group: 'flow', code: 'S15', label: 'Mã QR nhận kết quả',
    note: 'Mã QR trong bản test là ảnh giả (không quét được), đúng kích thước để canh layout.',
    source: FLOW, kind: 'kiosk', Comp: QrScreen,
    state: { ...RESULT_STATE, screen: 'qr' },
  },
  {
    id: 'end', group: 'flow', code: 'S16', label: 'Kết thúc trải nghiệm',
    note: 'Ảnh hoàn chỉnh full-screen: public/assets/ui/end-final.jpg',
    source: FLOW, kind: 'kiosk', Comp: EndScreen, state: { ...RESULT_STATE, screen: 'end' },
  },

  /* ── ② 6개 게임 ── */
  {
    id: 'core1', group: 'game', code: 'CORE 1', label: 'EMPTY BOTTLE CHALLENGE',
    note: 'Chạm vào thẻ sản phẩm để mở popup 4 bước; kéo thẻ xuống vùng REPICK để chọn.',
    source: GAMES, kind: 'kiosk', Comp: Core1Screen, state: { screen: 'core1' },
  },
  {
    id: 'core2', group: 'game', code: 'CORE 2', label: 'BEAUTY BUDGET',
    note: '10 đồng xu chia cho 8 giá trị (tối đa 4 mỗi ô).',
    source: GAMES, kind: 'kiosk', Comp: Core2Screen, state: { screen: 'core2' },
  },
  {
    id: 'core3', group: 'game', code: 'CORE 3', label: 'BEAUTY SHIELD',
    note: 'Đếm ngược 10 giây, chọn 3 tín hiệu đáng tin trong 8 thẻ.',
    source: GAMES, kind: 'kiosk', Comp: Core3Screen, state: { screen: 'core3' },
  },
  {
    id: 'core4', group: 'game', code: 'CORE 4', label: 'NEXT BEAUTY WAVE',
    note: 'Vuốt thẻ trái / phải / lên. Ảnh: public/assets/ui/trend-*.png',
    source: GAMES, kind: 'kiosk', Comp: Core4Screen, state: { screen: 'core4' },
  },
  {
    id: 'core5', group: 'game', code: 'CORE 5', label: 'HANOI BEAUTY WEATHER LAB',
    note: 'Bối cảnh được chọn ngẫu nhiên mỗi lần vào — bấm ↻ để xem bối cảnh khác.',
    source: GAMES, kind: 'kiosk', Comp: Core5Screen, state: { screen: 'core5' },
  },
  {
    id: 'core6', group: 'game', code: 'CORE 6', label: 'REVIEW DETECTIVE',
    note: 'Bấm kính lúp để mở manh mối, rồi chọn review đáng tin nhất.',
    source: GAMES, kind: 'kiosk', Comp: Core6Screen, state: { screen: 'core6' },
  },

  /* ── ③ 브릿지 ── */
  bridge('repick', 'Bridge 1 · sau CORE 1 (Repick)'),
  bridge('value', 'Bridge 2 · sau CORE 2 (Value)'),
  bridge('care', 'Bridge 3 · sau CORE 3 (Care)'),
  bridge('trend', 'Bridge 4 · sau CORE 4 (Trend)'),
  bridge('localFit', 'Bridge 5 · sau CORE 5 (Local Fit)'),
  bridge('trust', 'Bridge 6 · sau CORE 6 (Trust)'),

  /* ── ④ 오버레이 ── */
  {
    id: 'timeout', group: 'overlay', label: 'Popup hết thời gian chờ',
    note: 'Hiện khi khách không chạm màn hình. Sửa trong components.tsx → TimeoutGuard.',
    source: COMPONENTS, kind: 'kiosk', Comp: TimeoutPreview, state: { screen: 'consent' },
  },
  {
    id: 'toast', group: 'overlay', label: 'Toast hoàn thành game',
    note: 'Băng chữ hiện 2,4 giây sau khi xong mỗi game. Sửa: components.tsx → CompleteToast.',
    source: COMPONENTS, kind: 'kiosk', Comp: ToastPreview, state: { screen: 'core2' },
  },
  {
    id: 'qrScan', group: 'overlay', label: 'Quét QR (từ màn S02)',
    note: 'Overlay bật khi khách bấm "Quét QR & bắt đầu" ở màn Đồng ý & thông tin. Cần cho phép trình duyệt dùng camera.',
    source: 'apps/kiosk/src/screens/QrScan.tsx',
    kind: 'kiosk', Comp: QrScanPreview, state: { screen: 'consent' },
  },

  /* ── ⑤ 모바일 웹 (서버 렌더링 페이지) ── */
  {
    id: 'pair', group: 'mobile', label: 'Quét QR · kết nối tài khoản',
    note: 'Trang mở ra khi khách quét QR trên PAD (bản mô phỏng app aepick).',
    source: 'server/src/pairingRoutes.ts → pairingPageHtml()',
    kind: 'web', path: `/p/${MOCK_PAIR_CODE}`, device: 'phone',
  },
  {
    id: 'result', group: 'mobile', label: 'Trang kết quả trên điện thoại',
    note: 'Persona + mã giảm giá + danh sách thương hiệu gợi ý + nút vào bình chọn.',
    source: 'server/src/pages.ts → resultPageHtml()',
    kind: 'web', path: `/r/${MOCK_TOKEN}`, device: 'phone',
  },
  {
    id: 'vote', group: 'mobile', label: 'Bình chọn 3 sản phẩm',
    note: 'Chọn đúng 3 sản phẩm rồi bấm nút — trong bản test sẽ nhảy sang màn hoàn tất.',
    source: 'server/src/votePages.ts → votePageHtml()',
    kind: 'web', path: `/v/${MOCK_TOKEN}`, device: 'phone',
  },
  {
    id: 'vote-done', group: 'mobile', label: 'Bình chọn xong (+ ô nhân viên)',
    note: 'Nhấn giữ 1,2 giây ở góc dưới bên phải để mở ô nhập PIN của nhân viên (PIN nào cũng được ở bản test).',
    source: 'server/src/votePages.ts → voteDonePageHtml()',
    kind: 'web', path: `/v/${MOCK_TOKEN}/done`, device: 'phone',
  },

  /* ── ⑥ 운영 화면 ── */
  {
    id: 'admin', group: 'admin', label: 'Dashboard vận hành',
    note: 'Số liệu theo thời gian thực trong ngày. Bản test dùng dữ liệu giả.',
    source: 'server/src/pages.ts → adminPageHtml()',
    kind: 'web', path: '/admin', device: 'desktop',
  },
  {
    id: 'catalog', group: 'admin', label: 'Quản lý thương hiệu · sản phẩm',
    note: 'Màn hình nhập thương hiệu/sản phẩm cho quầy. Mọi thao tác lưu đều không có tác dụng ở bản test.',
    source: 'server/src/catalogRoutes.ts → catalogPageHtml()',
    kind: 'web', path: '/admin/catalog', device: 'desktop',
  },
];

export const GROUPS = Object.keys(GROUP_LABEL) as Group[];

/** Router와 같은 규칙 — attract·intro는 자체 워드마크가 있어 공통 헤더를 숨긴다 */
export function showsHeader(e: ScreenEntry): boolean {
  if (e.header !== undefined) return e.header;
  const screen = e.state?.screen;
  return screen !== 'attract' && screen !== 'intro';
}
