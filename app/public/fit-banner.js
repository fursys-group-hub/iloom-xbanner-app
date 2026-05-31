// 배너별 "빈 공간 자동 채움 / 콘텐츠 넘침 자동 압축"
//
// fitBanner(banner): 렌더 직후 호출하는 단일 진입점. 두 가지를 순서대로 한다.
//   1) "최대 혜택" 블록을 v8 표준(scale 1)~최소(0.62) 사이에서 그 배너의 실제 콘텐츠에
//      맞춰 키우거나 줄인다(여백 많은 배너는 커지고 빽빽한 배너는 줄어든다).
//   2) 최대 혜택을 최소까지 줄여도 1800px 를 넘치면(예: 디에이치 — 제품카드3+표+결제+유의사항),
//      잘리지 않도록 안전한 영역(여백·줄간격·카드 높이 등)만 단계적으로 압축한다.
//      ★ 절대 압축 금지: 매장명 35px·WELCOME·로고·메인타이틀·아파트명 (CSS 변수로 안 빼서 보호).
//
// 케이스 고정값이 아니라 배너마다 독립 측정 → 여백 충분한 배너는 전혀 건드리지 않는다.
// 미리보기(app.js)·내보내기(preview-app.js) 양쪽에서 동일하게 동작.

const MB_MIN  = 0.62;   // 최대 혜택 최소 축소 (main 40 → 약 25px)
const MB_MAX  = 1.0;    // v8 표준이 상한 (그 이상으로는 안 키움)
const MB_STEP = 0.04;
const BANNER_H = 1800;
const BOTTOM   = 8;     // 바닥 여유
const FIT_H    = BANNER_H - BOTTOM;

// 넘침 압축 사다리 — 위에서 아래로 누적 적용(필요한 만큼만).
// 메모리 [[feedback_xbanner_auto_fill_blank_space]] "콘텐츠 초과 시 압축 순서" 준수:
// 유의사항 → 그룹 간격 → 결제/카드 간격 → (최후) 매장 박스·카드 높이.
// 각 단계는 [CSS변수, 값]. 측정하며 1800 안에 들어오는 순간 멈춘다.
const COMPRESS_STEPS = [
  ['--lh-notice',      '1.55'],   // 유의사항 줄간격 살짝
  ['--fs-notice',      '11px'],   // 유의사항 글자 살짝
  ['--gap-group',      '50px'],   // 그룹 간격 1차
  ['--gap-store-mb',   '18px'],
  ['--gap-section',    '12px'],
  ['--lh-notice',      '1.45'],
  ['--fs-notice',      '10px'],
  ['--gap-group',      '40px'],   // 그룹 간격 2차
  ['--gap-section',    '8px'],
  ['--card-gap',       '7px'],    // 카드 사이 간격
  ['--gap-pay',        '14px'],   // 결제 안내 아래 여백
  ['--store-pad-v',    '20px'],   // 매장 박스 위아래 패딩(이름 글자는 그대로)
  ['--gap-group',      '32px'],   // 그룹 간격 최소
  ['--gap-store-mb',   '14px'],
  ['--card-gap',       '5px'],
  ['--product-card-h', '140px'],  // 제품 카드 높이 (case-g 처럼 약간 낮춤)
  ['--store-pad-v',    '16px'],
  ['--product-card-h', '130px'],  // 최후 — 제품 카드 더 낮춤
];

// 빈 공간 분배 — 콘텐츠가 1800px 보다 충분히 짧으면, 모듈 사이 간격을 "모두 같은 비율"로 키워
// 1800 직전까지 균형 있게 채운다(한 변수만 키우면 결제↔유의사항 같은 작은 간격이 붙어 보임).
// 로고는 footer margin-top:auto 로 바닥 유지. 넘치는 배너는 반대로 COMPRESS_STEPS 가 처리.
const GROW_MIN_SLACK = 40;   // 이만큼 이상 남을 때만 분배 (미세 여백은 표준 그대로)
const GROW_GAP_BASE = {      // :root 표준 간격값 — 이 비율을 유지하며 함께 키움
  '--gap-group':    60,
  '--gap-store-mb': 24,
  '--gap-section':  16,
  '--gap-pay':      22,
};
const GROW_MAX_SCALE  = 2.6;   // 너무 적은 콘텐츠에서 간격이 과해지지 않게 상한
const GROW_SCALE_STEP = 0.06;

const ALL_VARS = ['--mb-scale', ...new Set([...COMPRESS_STEPS.map(([v]) => v), ...Object.keys(GROW_GAP_BASE)])];

export function fitBanner(banner) {
  if (!banner) return;
  // 이전 호출이 남긴 인라인 압축값 초기화 (같은 요소에 두 번 호출돼도 항상 표준에서 시작)
  for (const v of ALL_VARS) banner.style.removeProperty(v);

  // 측정용 클론을 height:auto 로 펼쳐 실제 콘텐츠 높이를 잰다
  // (배너는 1800 고정·overflow:hidden 이라 직접 측정 불가).
  const clone = banner.cloneNode(true);
  Object.assign(clone.style, {
    position: 'absolute', left: '-9999px', top: '0',
    height: 'auto', overflow: 'visible', transform: 'none',
  });
  document.body.appendChild(clone);
  const fits = () => clone.scrollHeight <= FIT_H;

  // 1) 최대 혜택: 1800 안에 들어오는 가장 큰 배율
  let mb = MB_MIN;
  if (banner.querySelector('.max-benefit')) {
    for (let s = MB_MAX; s >= MB_MIN - 1e-9; s -= MB_STEP) {
      clone.style.setProperty('--mb-scale', s.toFixed(3));
      if (fits()) { mb = s; break; }
    }
    clone.style.setProperty('--mb-scale', mb.toFixed(3));
    banner.style.setProperty('--mb-scale', mb.toFixed(3));
  }

  // 2) 넘치면 → 안전 영역 단계적 압축 / 충분히 남으면 → 모듈 간격에 빈 공간 분배
  if (!fits()) {
    const applied = [];
    for (const [v, val] of COMPRESS_STEPS) {
      clone.style.setProperty(v, val);
      applied.push([v, val]);
      if (fits()) break;
    }
    for (const [v, val] of applied) banner.style.setProperty(v, val);
  } else if (FIT_H - clone.scrollHeight > GROW_MIN_SLACK) {
    // 모든 간격을 같은 비율로 키워 균형 있게 채움 — 1800 직전까지 가장 큰 배율 선택
    let best = 1;
    for (let f = 1 + GROW_SCALE_STEP; f <= GROW_MAX_SCALE + 1e-9; f += GROW_SCALE_STEP) {
      for (const [v, base] of Object.entries(GROW_GAP_BASE)) clone.style.setProperty(v, `${Math.round(base * f)}px`);
      if (clone.scrollHeight <= FIT_H) best = f;
      else break;
    }
    if (best > 1) for (const [v, base] of Object.entries(GROW_GAP_BASE)) banner.style.setProperty(v, `${Math.round(base * best)}px`);
  }

  clone.remove();
}

// 하위호환: 기존에 fitMaxBenefit 를 직접 부르던 코드용 별칭.
export const fitMaxBenefit = fitBanner;

// 하단 배경 사진 ON/OFF + 이미지 선택 — 케이스 고정이 아니라 배너별 토글.
// data.background 미설정 시 기본값(case-c 만 ON). has-bg 클래스로 배경+흰 유의사항 적용.
// data.bgImage(인코딩된 URL) 가 있으면 그 이미지로 교체(--bg-image), 없으면 CSS 기본(침실).
export function applyBackground(banner, data) {
  if (!banner) return;
  const hasBg = data?.background ?? (data?._caseId === 'case-c');
  banner.classList.toggle('has-bg', !!hasBg);   // 배경 사진(<img class="banner-bg">)은 render-banner.js 가 주입
}
