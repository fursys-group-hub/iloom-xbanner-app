// 전체 배너 조립 — 케이스 분기 → 영역 조립 함수 호출
// 사용처: 브라우저(public/app.js) 와 서버(server.js) 둘 다

import { renderCaseA } from './cases/case-a/index.js';
import { renderCaseB } from './cases/case-b/index.js';
import { renderCaseC } from './cases/case-c/index.js';
import { renderCaseD } from './cases/case-d/index.js';
import { renderCaseE } from './cases/case-e/index.js';
import { renderCaseG } from './cases/case-g/index.js';

// 케이스 자동 분류 — 우선순위 순
// 케이스 D: 후기 이벤트 카드 보유 (잠실형 — 2아파트 + 6컬럼 + 후기)
// 케이스 E: 박람회 2회 카드 보유 (창원형 — 단지별 박람회 2회)
// 케이스 G: 추가혜택 카드 보유 + 결제 영역 없음 (도안형)
// 케이스 C: 제품 이미지 카드 보유 (디에이치형 — 제품 카드 + 컴팩트 결제)
// 케이스 B: 특별 프로모션 3종 이상 (2x2 그리드)
// 케이스 A: 기본 (5컬럼 + card_1 결제)
export function classifyCase(data) {
  const reviewCards  = data?.reviewSection?.cards?.length || 0;
  const fairsCards   = data?.fairsSection?.cards?.length || 0;
  const extraCards   = data?.extraSection?.cards?.length || 0;
  const productCards = data?.productSection?.cards?.length || 0;
  const promoCount   = data?._extraction?.specialPromotions?.length || 0;
  const promoCards   = data?.specialPromoSection?.cards?.length || 0;
  if (reviewCards >= 1) return 'case-d';
  if (fairsCards >= 2) return 'case-e';
  if (extraCards >= 1) return 'case-g';
  if (productCards >= 1) return 'case-c';
  if (promoCount >= 3 || promoCards >= 3) return 'case-b';
  return 'case-a';
}

const CASES = {
  'case-a': renderCaseA,
  'case-b': renderCaseB,
  'case-c': renderCaseC,
  'case-d': renderCaseD,
  'case-e': renderCaseE,
  'case-g': renderCaseG,
};

const DEFAULT_BG = '/assets/full%20bakground/%EC%B9%A8%EC%8B%A4%20%EB%B0%B0%EA%B2%BD.jpg';

export function renderBanner(data) {
  const caseId = data?._caseId || classifyCase(data);
  const fn = CASES[caseId];
  if (!fn) {
    return `<div class="x-banner"><div style="padding:40px;color:#E55A3D;">지원하지 않는 케이스: ${caseId}</div></div>`;
  }
  let html = fn(data);
  // 하단 배경 사진 — 켜져 있으면 .x-banner 첫 자식으로 <img> 주입 + has-bg.
  // 사진은 가로 폭에 맞춰 배치되고, 윗부분은 CSS 마스크로 페이드(사진 높이 무관하게 경계 제거).
  const bgOn = data?.background ?? (caseId === 'case-c');
  if (bgOn) {
    const src = String(data?.bgImage || DEFAULT_BG).replace(/"/g, '&quot;');
    const img = `<img class="banner-bg" src="${src}" alt="" aria-hidden="true" />`;
    html = html
      .replace('class="x-banner', 'class="x-banner has-bg')
      .replace(/(<div class="x-banner[^>]*>)/, `$1${img}`);
  }
  return html;
}
