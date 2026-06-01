// 어플 본체 — PDF 업로드 + 미리보기 직접편집 + 검수 패널 + PNG/PDF 다운로드
// 흐름: 큰 미리보기에서 고칠 곳을 클릭 → 그 자리 편집 팝오버. 좌측은 "확인 필요" 검수 패널.

import { renderBanner } from '/render/render-banner.js';
import { fitBanner, applyBackground } from '/fit-banner.js';
import { maybeStartTour, startTour } from '/tour.js';

// ───────── 상태 ─────────
let state = null;
let initial = null;   // "기본값 복원" 용 (case-a-default.json 그대로)

// ───────── 자동 저장 (브라우저 localStorage) ─────────
const DRAFT_KEY = 'iloom-xbanner-draft';
let allowDraftSave = false;

function saveDraft() {
  if (!allowDraftSave || !state) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, savedAt: new Date().toISOString() }));
  } catch { /* 용량 초과 등은 조용히 무시 */ }
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}

function hasEdits() {
  return !!state && !!initial && JSON.stringify(state) !== JSON.stringify(initial);
}

const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ───────── DOM ─────────
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root          = $('#bannerRoot');
const startScreen   = $('#startScreen');
const startDrop     = $('#startDrop');
const pdfInput      = $('#pdfFile');
const extractStatus = $('#extractStatus');
const caseBadge     = $('#caseBadge');
const tableEditor   = $('#tableEditor');
const payPoints     = $('#payPoints');
const payModes      = $('#payModes');
const fPayTitle     = $('#f_payTitle');
const bgGroup       = $('#bgGroup');
const promoEditor   = $('#promoEditor');
const editPopover   = $('#editPopover');
const reviewList    = $('#reviewList');
const reviewCount   = $('#reviewCount');
const F = {
  welcome:     $('#f_welcome'),
  aptName:     $('#f_aptName'),
  mainTitle:   $('#f_mainTitle'),
  periodStart: $('#f_periodStart'),
  periodEnd:   $('#f_periodEnd'),
  stores:      $('#f_stores'),
  maxBefore:   $('#f_maxBefore'),
  maxAmount:   $('#f_maxAmount'),
  maxAfter:    $('#f_maxAfter'),
  celBefore:   $('#f_celBefore'),
  celMain:     $('#f_celMain'),
  celAfter:    $('#f_celAfter'),
  notices:     $('#f_notices'),
  tableTitle:  $('#f_tableTitle'),
};

// 결제 포인트 3종 (체크박스 ↔ payment.cards). logoSrc 부분문자열로 현재 카드 매칭.
const PAY_POINTS = [
  { id: 'npay',   match: 'n%20pay', label: '네이버 포인트 (N pay)', card: { label: 'N pay',   logoSrc: '/assets/point%20logo/n%20pay.png', theme: 'npay'   } },
  { id: 'lpoint', match: 'Lpoint',  label: '롯데 L.POINT',          card: { label: 'L.POINT', logoSrc: '/assets/point%20logo/Lpoint.png',  theme: 'lpoint' } },
  { id: 'ssgpay', match: 'ssgpay',  label: 'SSG 페이머니',          card: { label: 'SSGPAY',  logoSrc: '/assets/point%20logo/ssgpay.svg',  theme: 'ssgpay' } },
];

const PAY_MODES = [
  { id: 'card_1',  label: '풀 카드', desc: '라벨+로고+설명' },
  { id: 'card_2',  label: '작은 카드', desc: '라벨+로고' },
  { id: 'compact', label: '로고만',  desc: '가로 1줄' },
];
const CASE_PAY_DEFAULT = {
  'case-a': 'card_1', 'case-b': 'compact', 'case-c': 'compact',
  'case-d': 'card_2', 'case-e': 'compact', 'case-g': 'compact',
};

// ───────── 미리보기 직접편집 — 영역 ↔ 편집 패널 매핑 ─────────
// 렌더된 .x-banner 안의 안정적 클래스에 data-edit(=패널명)·data-field(=신뢰도 키)를 입힘.
// 렌더 컴포넌트는 건드리지 않음 → 시제품 픽셀 일치·서버 export·검증 회귀 위험 0.
const EDIT_MAP = [
  { sel: '.welcome',       panel: 'header' },
  { sel: '.apt-name',      panel: 'header',      field: 'aptName' },
  { sel: '.main-title',    panel: 'header' },
  { sel: '.period',        panel: 'header',      field: 'period' },
  { sel: '.period-detail', panel: 'header',      field: 'period' },
  { sel: '.store-box',     panel: 'stores',      field: 'stores' },
  { sel: '.max-benefit',   panel: 'maxBenefit' },
  { sel: '.celebration',   panel: 'celebration' },
  { sel: '.table-wrapper', panel: 'benefitTable', field: 'benefitTable' },
  { sel: '.payment',       panel: 'payment' },
  { sel: '.notices',       panel: 'notices',     field: 'notices' },
  { sel: '.promo-wrapper', panel: 'promo',        field: 'promotions' },
];

const PANEL_TITLES = {
  header: '제목 · 기간', stores: '매장', maxBenefit: '최대 혜택 문구',
  celebration: '축하 문구', benefitTable: '혜택표', payment: '결제 안내',
  notices: '유의사항', promo: '특별 프로모션',
};

// 좌측 "확인 필요" 검수 리스트에 올릴 자동추출 항목
const REVIEW_FIELDS = [
  { key: 'aptName',      label: '아파트명',          panel: 'header' },
  { key: 'period',       label: '박람회 기간',       panel: 'header' },
  { key: 'stores',       label: '매장',              panel: 'stores' },
  { key: 'benefitTable', label: '혜택표',            panel: 'benefitTable' },
  { key: 'notices',      label: '유의사항',          panel: 'notices' },
  { key: 'promotions',   label: '프로모션 카드 내용', panel: 'promo' },   // 조건·포인트가 프리셋 기본값 → 확인 권장
];

// 좌측 "품의서에서 읽은 값" 신뢰도 readout — 배너에 보이는 항목(고치기) + 참고 항목(객단가/약명 등)
const READOUT = [
  { key: 'aptName',          label: '아파트명',      panel: 'header' },
  { key: 'period',           label: '박람회 기간',   panel: 'header' },
  { key: 'stores',           label: '매장',          panel: 'stores' },
  { key: 'benefitTable',     label: '혜택표',        panel: 'benefitTable' },
  { key: 'notices',          label: '유의사항',      panel: 'notices' },
  { key: 'pricePerCustomer', label: '객단가',        ref: true },
  { key: 'shortName',        label: '약명',          ref: true },
  { key: 'households',       label: '세대수',        ref: true },
  { key: 'occupationMonth',  label: '입주월',        ref: true },
  { key: 'promotions',       label: '프로모션 카드', ref: true },
  { key: 'payment',          label: '결제 안내',     ref: true },
];

// 카드 4종 (제품/추가혜택/후기/박람회) — 미리보기 카드 클릭 → 그 카드 편집
const CARD_TITLES  = { product: '제품 카드', extra: '추가 혜택 카드', review: '후기 이벤트 카드', fair: '박람회 카드' };
const CARD_SECTION = { product: 'productSection', extra: 'extraSection', review: 'reviewSection', fair: 'fairsSection' };
const CARD_MAX     = { product: 3, extra: 6, review: 2, fair: 2 };
const REVIEW_THEMES = [['naver', '네이버 (그린)'], ['cafe', '카페 (블루)']];
const REVIEW_ICONS  = [['calendar', '달력'], ['chat', '말풍선']];
let currentCard = null;   // { kind, idx } — 편집 중인 카드
let productLib  = [];     // 제품 사진 라이브러리 (samples/product-images.json)

// 카피 톤 3종 — 큰 헤드라인 문구를 톤에 맞춰 한 번에 적용 (이후 미리보기에서 미세조정)
const TONES = ['금액강조', '기간강조', '축하형'];

// 하단 배경 사진 — 없음 / 침실 / 쿠시노 (경로 세그먼트별 인코딩)
const BG_ENC = (raw) => raw.split('/').map(encodeURIComponent).join('/');
const BACKGROUNDS = [
  { id: 'off',     label: '없음',   src: null },
  { id: 'bedroom', label: '침실',   src: '/assets/full bakground/침실 배경.jpg' },
  { id: 'cushino', label: '쿠시노', src: '/assets/full bakground/쿠시노 배경.jpg' },
  { id: 'rema',    label: '레마',   src: '/assets/full bakground/레마 배경.jpg' },
  { id: 'fields',  label: '필즈',   src: '/assets/full bakground/필즈 배경.jpg' },
  { id: 'hazel',   label: '헤이즐', src: '/assets/full bakground/헤이즐 배경.jpg' },
];
const BG_SRC = Object.fromEntries(BACKGROUNDS.filter((b) => b.src).map((b) => [b.id, BG_ENC(b.src)]));

// 영역 순서 조절 — 중간 영역만 (헤더/매장/푸터 고정). state._order 가 렌더(미리보기·내보내기 공통)를 정렬.
const REGION_LABELS = { maxBenefit: '최대 혜택 문구', celebration: '축하 문구', fairs: '박람회 카드', product: '제품 카드', extra: '추가 혜택 카드', table: '혜택표', review: '후기 이벤트', promo: '특별 프로모션', payment: '결제 안내', notices: '유의사항' };
const REGION_SEL = { maxBenefit: '.max-benefit', celebration: '.celebration', fairs: '.fairs-wrapper', product: '.product-card', extra: '.extra-section-title', table: '.table-wrapper', review: '.review-event-wrapper', promo: '.promo-wrapper', payment: '.payment', notices: '.notices' };
let dragRegion = null;

// ───────── 신뢰도 / 검토완료 ─────────
function confOf(key)     { return state?._extraction?.fields?.[key]?.confidence; }
function isLowConf(key)  { const c = confOf(key); return c === 'medium' || c === 'low' || c === 'missing'; }
function isReviewed(key) { return !!state?._reviewed?.[key]; }
function needsReview(key){ return isLowConf(key) && !isReviewed(key); }

// 자동 추출 카드(프로모션/제품/후기/박람회)가 하나라도 있나 — 있을 때만 "프로모션 확인" 노출
function hasPromoCards() {
  return !!(state?.specialPromoSection?.cards?.length || state?.productSection?.cards?.length
    || state?.reviewSection?.cards?.length || state?.fairsSection?.cards?.length || state?.extraSection?.cards?.length);
}
function promoNeedsReview() { return needsReview('promotions') && hasPromoCards(); }

// ───────── 신뢰도 → 사용자 친절 표현 (개발 용어 high/medium/low/missing 노출 금지) ─────────
// 인라인 SVG 아이콘 (currentColor — 색은 부모 텍스트색 상속). 이모지 대신 사용.
const ICON = {
  check:    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
  alert:    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  xCircle:  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  dash:     `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash:    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  download: `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  copy:     `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  close:    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info:     `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  spinner:  `<svg class="icon icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`,
};

const CONF_LABEL = { high: '정확', medium: '확인 권장', low: '확인 필요', missing: '못 찾음' };
const CONF_DOT   = { high: 'ok', medium: 'warn', low: 'bad', missing: 'na' };
const CONF_ICO   = { high: 'check', medium: 'alert', low: 'alert', missing: 'dash' };
function confChip(key) {
  const c = confOf(key) || 'missing';
  return `<span class="conf-chip conf-${CONF_DOT[c]}">${ICON[CONF_ICO[c]]}${CONF_LABEL[c]}</span>`;
}
// 필드의 "품의서 원문" 또는 값 요약 (추출 원문 보기 / 신뢰도 readout 공용)
function fieldRaw(key) {
  const f = state?._extraction?.fields?.[key];
  if (!f) return '';
  if (f.raw) return f.raw;
  if (key === 'benefitTable') return f.rows ? `${f.rows}행${f.columns ? ' · ' + f.columns + '컬럼' : ''}` : '';
  if (key === 'notices')      return f.count ? `${f.count}줄` : '';
  if (key === 'payment')      return state.payment ? '포인트 적립 안내 표시' : '표시 안 함';
  return '';
}

// 편집 팝오버 상단 "품의서에서 가져온 내용" — 패널/카드별로 연결된 추출 필드
const SOURCE_LABEL  = { aptName: '아파트명', period: '박람회 기간', stores: '매장', benefitTable: '혜택표', notices: '유의사항', payment: '결제 안내', promotions: '프로모션 카드' };
const PANEL_SOURCE  = { header: ['aptName', 'period'], stores: ['stores'], benefitTable: ['benefitTable'], notices: ['notices'], payment: ['payment'], promo: ['promotions'] };

function markReviewedSilent(key) {
  (state._reviewed ||= {})[key] = true;
  renderReviewList();
}
function markReviewed(key) {
  (state._reviewed ||= {})[key] = true;
  renderReviewList();
  rerender();   // 미리보기 형광 제거
  saveDraft();
}

function showStart() { startScreen.classList.remove('is-hidden'); }
function hideStart() { startScreen.classList.add('is-hidden'); }

// ───────── 렌더 ─────────
function rerender() {
  if (!root || !state) return;
  // _draft: 미리보기에만 빈 필수항목 안내 placeholder 표시 (출력 state 엔 안 들어감 — 얕은 복사로 원본 보존)
  root.innerHTML = renderBanner({ ...state, _draft: true });
  const banner = root.querySelector('.x-banner');
  applyBackground(banner, state);
  fitBanner(banner);
  decorateEditable(banner);
  if (caseBadge) caseBadge.textContent = `${state._caseId === 'case-a' ? '케이스 A' : state._caseId} · ${state._version || 'v8'}`;
  updateOverflowChip();
  afterRenderImageCheck();
  renderGuide();
  renderReviewList();
  renderExtractReadout();
  renderToneGroup();
  renderBgGroup();
  renderRegionOrder();
  renderDoneSummary();
  renderOrderAuto();
  saveDraft();
}

// 렌더 직후 미리보기 영역에 data-edit / 형광 입히기
function decorateEditable(banner) {
  if (!banner) return;
  for (const m of EDIT_MAP) {
    for (const el of banner.querySelectorAll(m.sel)) {
      el.dataset.edit = m.panel;
      if (m.field) {
        el.dataset.field = m.field;
        el.classList.toggle('is-flag', needsReview(m.field));
      }
    }
  }
  // 카드 — 종류별로 data-edit=card + 인덱스 (제품/추가혜택은 같은 .product-card 라 state 로 구분)
  const flagPromo = promoNeedsReview();
  const cardKind = state.productSection?.cards?.length ? 'product'
                 : (state.extraSection?.cards?.length ? 'extra' : null);
  const cards = [];
  if (cardKind) {
    banner.querySelectorAll('.product-card').forEach((el, i) => {
      el.dataset.edit = 'card'; el.dataset.kind = cardKind; el.dataset.idx = i; cards.push(el);
    });
  }
  banner.querySelectorAll('.review-card').forEach((el, i) => {
    el.dataset.edit = 'card'; el.dataset.kind = 'review'; el.dataset.idx = i; cards.push(el);
  });
  banner.querySelectorAll('.fair-card').forEach((el, i) => {
    el.dataset.edit = 'card'; el.dataset.kind = 'fair'; el.dataset.idx = i; cards.push(el);
  });
  // 프로모션 카드 확인 필요 시 — 모든 카드에 코랄 형광 + 첫 카드를 검수 리스트 점프 대상으로
  cards.forEach((el) => el.classList.toggle('is-flag', flagPromo));
  if (flagPromo && cards[0]) cards[0].dataset.field = 'promotions';
}

function afterRenderImageCheck() {
  recheckImages();
  for (const img of root.querySelectorAll('.x-banner img')) {
    if (!img.complete) img.addEventListener('load', onImgLoaded, { once: true });
  }
}
function onImgLoaded() {
  if (recheckImages()) renderDoneSummary();
}

// ───────── 인쇄 전 점검 ─────────
function measureOverflow() {
  const banner = root?.querySelector('.x-banner');
  if (!banner) return 0;
  const clone = banner.cloneNode(true);
  Object.assign(clone.style, {
    position: 'absolute', left: '-9999px', top: '0',
    height: 'auto', overflow: 'visible', transform: 'none',
  });
  document.body.appendChild(clone);
  const h = clone.scrollHeight;
  clone.remove();
  return Math.max(0, h - 1800);
}

function emptyRequired() {
  const out = [];
  if (!state.aptName?.trim()) out.push('아파트명');
  if (!(state.period?.start && state.period?.end)) out.push('박람회 기간');
  if (!(state.stores || []).length) out.push('매장');
  return out;
}

// ───────── 이미지 해상도 점검 ─────────
let imgWarnings = [];
function recheckImages() {
  const imgs = [...(root?.querySelectorAll('.x-banner img') || [])];
  const out = [];
  for (const img of imgs) {
    if (!img.complete || !img.naturalWidth) continue;
    const w = img.offsetWidth;
    if (!w) continue;
    const dpi = Math.round(img.naturalWidth * 25.4 / w);
    if (dpi < 100) {
      const name = (img.alt || '사진').trim();
      out.push(`사진 "${name}" 해상도 낮음 (약 ${dpi}DPI) — 가까이서 보면 뭉개질 수 있어 고해상도 교체 권장`);
    }
  }
  const changed = JSON.stringify(out) !== JSON.stringify(imgWarnings);
  imgWarnings = out;
  return changed;
}

function validationWarnings() {
  const out = emptyRequired().map((k) => `${k} 항목이 비어 있습니다.`);
  const over = measureOverflow();
  if (over > 4) out.push(`내용이 배너 영역을 약 ${Math.round(over)}px 넘칩니다. 글자가 잘릴 수 있어요.`);
  out.push(...imgWarnings);
  return out;
}

function updateOverflowChip() {
  const chip = $('#overflowChip');
  if (!chip) return;
  chip.hidden = measureOverflow() <= 4;
}

// ───────── 검수 패널 (확인 필요) ─────────
function reviewValuePreview(key) {
  if (key === 'aptName') return state.aptName || '';
  if (key === 'period')  return (state.period?.start && state.period?.end) ? `${state.period.start} ~ ${state.period.end}` : '';
  if (key === 'stores')  return (state.stores || []).join(', ');
  if (key === 'notices') return `${(state.notices || []).length}줄`;
  if (key === 'benefitTable') return `${state.benefitTable?.rows?.length || 0}행`;
  return '';
}

function renderReviewList() {
  if (!reviewList) return;
  const f = state?._extraction?.fields;
  // 프로모션은 자동 추출 카드가 실제로 있을 때만 (없으면 신뢰도 낮아도 검수할 게 없음)
  const items = REVIEW_FIELDS.filter((it) => it.key === 'promotions' ? promoNeedsReview() : needsReview(it.key));
  reviewCount.textContent = items.length;
  reviewCount.classList.toggle('is-clear', items.length === 0);

  if (!f) {
    reviewList.innerHTML = `<div class="rv-empty">${ICON.info}<span>PDF에서 자동으로 채운 항목이 없어요. 미리보기에서 고칠 곳을 직접 눌러 편집하세요.</span></div>`;
    return;
  }
  if (!items.length) {
    reviewList.innerHTML = `<div class="rv-empty rv-empty--ok">${ICON.check}<span>모두 확인했어요. 미리보기를 눌러 더 다듬을 수 있어요.</span></div>`;
    return;
  }
  reviewList.innerHTML = items.map((it) => {
    const raw = f[it.key]?.raw;
    const desc = it.key === 'promotions'
      ? (raw ? `카드: ${raw} — 조건·포인트를 확인하세요` : '카드 내용을 확인하세요')
      : (raw ? `품의서: ${raw}` : reviewValuePreview(it.key));
    return `<div class="rv-item" data-go="${escAttr(it.key)}">
      <div class="rv-item-main">
        <div class="rv-item-label">${escAttr(it.label)}</div>
        ${desc ? `<div class="rv-item-desc">${escAttr(String(desc).slice(0, 64))}</div>` : ''}
      </div>
      <button class="rv-item-ok" data-ok="${escAttr(it.key)}">${ICON.check}확인</button>
    </div>`;
  }).join('');
}

// ───────── 추출 원문 보기 (편집 팝오버 상단) ─────────
function renderEditSource(panel, isCard) {
  const box = $('#edPopSource');
  if (!box) return;
  const keys = isCard ? ['promotions'] : (PANEL_SOURCE[panel] || []);
  const fields = state?._extraction?.fields;
  if (!fields || !keys.length) { box.hidden = true; box.innerHTML = ''; return; }
  const rows = keys.map((k) => {
    if (!fields[k]) return '';
    const raw = fieldRaw(k);
    return `<div class="src-row">${confChip(k)}<div class="src-text"><b>${escAttr(SOURCE_LABEL[k] || k)}</b>${
      raw ? ` <span class="src-raw">품의서: ${escAttr(String(raw).slice(0, 90))}</span>` : ' <span class="src-raw is-empty">품의서에서 못 찾아 직접 입력하세요</span>'
    }</div></div>`;
  }).filter(Boolean).join('');
  if (!rows) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="src-head">품의서에서 가져온 내용</div>${rows}`;
}

// ───────── 신뢰도 readout (좌측 "품의서에서 읽은 값") ─────────
function renderExtractReadout() {
  const wrap = $('#extractReadoutWrap');
  const list = $('#extractReadout');
  if (!wrap || !list) return;
  const fields = state?._extraction?.fields;
  if (!fields) { wrap.hidden = true; return; }
  wrap.hidden = false;
  list.innerHTML = READOUT.filter((it) => fields[it.key]).map((it) => {
    const raw = fieldRaw(it.key);
    const editable = !!it.panel;
    return `<div class="ro-line${editable ? ' is-editable' : ''}"${editable ? ` data-go="${escAttr(it.key)}"` : ''}>
      <div class="ro-line-top">${confChip(it.key)}<span class="ro-line-label">${escAttr(it.label)}</span>${
        editable ? '<span class="ro-line-tag">고치기</span>' : '<span class="ro-line-tag ro-ref">참고</span>'
      }</div>
      <div class="ro-line-raw${raw ? '' : ' is-empty'}">${raw ? escAttr(String(raw).slice(0, 90)) : '품의서에서 못 찾음 — 직접 입력'}</div>
    </div>`;
  }).join('');
}

// ───────── 내보내기 점검 요약 + 완료 신호 ─────────
let lastWarnN = 0;   // renderExportStatus 가 재사용 (measureOverflow 중복 호출 줄임)
function renderDoneSummary() {
  const el = $('#doneSummary');
  if (!el) return;
  const period = (state.period?.start && state.period?.end)
    ? `${state.period.start} ~ ${state.period.end}` : '';
  const rows = [
    ['아파트명',    state.aptName,                          !state.aptName?.trim()],
    ['박람회 기간', period,                                 !period],
    ['매장',        (state.stores || []).join(', '),        !(state.stores || []).length],
    ['혜택표',      `${state.benefitTable?.rows?.length || 0}행`, !(state.benefitTable?.rows?.length)],
    ['결제 안내',   state.payment ? '표시' : '숨김',          false],
  ];
  const warns = validationWarnings();
  lastWarnN = warns.length;
  let html = '';
  if (warns.length) {
    html += `<div class="done-warn">${warns.map((w) => `<div class="done-warn-line">${escAttr(w)}</div>`).join('')}</div>`;
  }
  html += `<div class="spec-list done-list">${rows.map(([k, v, bad]) =>
    `<div class="spec-row done-row${bad ? ' is-bad' : ''}"><span class="spec-k done-k">${escAttr(k)}</span><span class="spec-v done-v">${bad ? '비어 있음' : escAttr(v)}</span></div>`
  ).join('')}</div>`;
  el.innerHTML = html;
  // 문제 있으면 다운로드 버튼에 주의 상태(코랄 테두리)
  ['#btnPng', '#btnPdf', '#btnPng2', '#btnPdf2'].forEach((sel) => $(sel)?.classList.toggle('btn-caution', warns.length > 0));
  renderExportStatus();
}

// 완료 신호 — 확인필요 0 + 경고 0 이면 "인쇄해도 좋아요", 아니면 "확인할 게 N개"
function reviewCountNow() {
  return REVIEW_FIELDS.filter((it) => it.key === 'promotions' ? promoNeedsReview() : needsReview(it.key)).length;
}
function renderExportStatus() {
  const el = $('#exportStatus');
  if (!el) return;
  const left = reviewCountNow() + lastWarnN;
  if (left === 0) {
    el.className = 'export-status is-ready';
    el.innerHTML = `${ICON.check}<span>다 확인했어요 — 인쇄해도 좋아요</span>`;
  } else {
    el.className = 'export-status is-pending';
    el.innerHTML = `${ICON.alert}<span>확인할 게 ${left}개 남았어요 — 아래를 확인한 뒤 받으세요</span>`;
  }
}

// ───────── 인쇄 발주 사양서 ─────────
function orderTitle() {
  return `${state.aptName || ''} ${state.mainTitle || '입주 특별 프로모션'}`.trim();
}
const ORDER_AUTO = [
  ['크기', '600 × 1800 mm (X배너)'],
  ['색상', 'CMYK'],
  ['도련', '3mm (재단 여유 포함)'],
  ['형식', 'PDF (벡터)'],
];
function renderOrderAuto() {
  const auto = $('#orderAuto');
  if (!auto) return;
  auto.innerHTML = [['제목', orderTitle()], ...ORDER_AUTO]
    .map(([k, v]) => `<div class="spec-row order-row"><span class="spec-k order-k">${escAttr(k)}</span><span class="spec-v order-v">${escAttr(v)}</span></div>`).join('');
}
function fillOrderInputs() {
  const o = state._order || {};
  $('#o_qty').value      = o.qty ?? '';
  $('#o_due').value      = o.due ?? '';
  $('#o_material').value = o.material ?? '일반 배너 원단';
  $('#o_stand').checked  = !!o.stand;
  $('#o_manager').value  = o.manager ?? '';
  $('#o_contact').value  = o.contact ?? '';
}
function saveOrderFromForm() {
  state._order = {
    qty: $('#o_qty').value, due: $('#o_due').value, material: $('#o_material').value,
    stand: $('#o_stand').checked, manager: $('#o_manager').value, contact: $('#o_contact').value,
  };
  saveDraft();
}
function buildOrderText() {
  const o = state._order || {};
  return [
    '[일룸 X배너 인쇄 발주]',
    `제목: ${orderTitle()}`,
    ...ORDER_AUTO.map(([k, v]) => `${k}: ${v}`),
    `수량: ${o.qty || '(미입력)'}`,
    `재질: ${o.material || '일반 배너 원단'}`,
    `거치대: ${o.stand ? '포함' : '미포함'}`,
    `납기일: ${o.due || '(미입력)'}`,
    `담당자: ${o.manager || ''}${o.contact ? ' / ' + o.contact : ''}`,
    '',
    '※ PDF(벡터) 파일 첨부. 600×1800mm 확대 출력, CMYK·도련 3mm 적용 요청드립니다.',
  ].join('\n');
}

// ───────── 미리보기 줌 / 전체화면 ─────────
function setZoom(scale) {
  const rootEl = $('#bannerRoot');
  const frame  = $('.preview-frame');
  if (rootEl) rootEl.style.transform = `scale(${scale})`;
  if (frame)  frame.style.width = `${600 * scale}px`;
  $$('.zoom-btn').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.zoom) === scale));
}

function openFullscreen() {
  const overlay = $('#zoomOverlay');
  const inner   = $('#zoomOverlayBanner');
  if (!overlay || !inner) return;
  inner.innerHTML = renderBanner(state);
  applyBackground(inner.querySelector('.x-banner'), state);
  fitBanner(inner.querySelector('.x-banner'));
  overlay.classList.remove('is-hidden');
  const stage = overlay.querySelector('.zoom-overlay-stage');
  const s = Math.max(0.3, Math.min((stage.clientHeight - 48) / 1800, (stage.clientWidth - 48) / 600));
  inner.style.transform = `scale(${s})`;
  inner.style.height = `${1800 * s}px`;
}
function closeFullscreen() {
  $('#zoomOverlay')?.classList.add('is-hidden');
}

// ───────── 인쇄 가이드 오버레이 ─────────
let guideOn = false;
const GUIDE_HTML = `
  <div class="print-guide" aria-hidden="true">
    <div class="pg-edge"></div>
    <div class="pg-band pg-top"><span>상단 거치대 영역 — 가려질 수 있어요</span></div>
    <div class="pg-band pg-bot"><span>하단 거치대 영역</span></div>
  </div>`;
function renderGuide() {
  if (!root) return;
  root.querySelector('.print-guide')?.remove();
  if (guideOn) root.insertAdjacentHTML('beforeend', GUIDE_HTML);
}

// ───────── state → 폼 ─────────
function syncFormFromState() {
  F.welcome.value     = state.welcome ?? '';
  F.aptName.value     = state.aptName ?? '';
  F.mainTitle.value   = state.mainTitle ?? '';
  F.periodStart.value = state.period?.start ?? '';
  F.periodEnd.value   = state.period?.end ?? '';
  F.stores.value      = (state.stores ?? []).join('\n');
  F.maxBefore.value   = state.maxBenefit?.before ?? '';
  F.maxAmount.value   = state.maxBenefit?.amount ?? '';
  F.maxAfter.value    = state.maxBenefit?.after ?? '';
  F.celBefore.value   = state.celebration?.before ?? '';
  F.celMain.value     = state.celebration?.main ?? '';
  F.celAfter.value    = state.celebration?.after ?? '';
  F.notices.value     = (state.notices ?? []).join('\n');
  renderBgGroup();

  renderTableEditor();
  renderPaymentEditor();
  renderPayModes();
  renderPromoEditor();
  applyConfidenceStyles();
  renderOrderAuto();
  fillOrderInputs();
}

// ───────── 혜택표 편집기 ─────────
function renderTableEditor() {
  const t = state?.benefitTable;
  F.tableTitle.value = t?.title ?? '';
  if (!t || !Array.isArray(t.columns) || !t.columns.length) {
    tableEditor.innerHTML = '<p class="panel-hint">혜택표 없음</p>';
    return;
  }
  const cols = t.columns;
  const gridCols = `repeat(${cols.length}, minmax(44px, 1fr)) 26px`;
  let html = `<div class="te-grid" style="grid-template-columns:${gridCols}">`;
  cols.forEach((c, ci) => {
    html += `<input class="te-head" data-col="${ci}" value="${escAttr((c.label ?? '').replace(/\n/g, ' '))}" />`;
  });
  html += `<span class="te-spacer"></span>`;
  // 열 삭제 행 (각 열 머리 아래 × 버튼)
  cols.forEach((c, ci) => {
    html += `<button class="te-coldel" data-col="${ci}" title="열 삭제" aria-label="열 삭제">${ICON.close}</button>`;
  });
  html += `<span class="te-spacer"></span>`;
  (t.rows || []).forEach((row, ri) => {
    cols.forEach((c) => {
      html += `<input class="te-cell" data-row="${ri}" data-key="${escAttr(c.key)}" value="${escAttr(row[c.key] ?? '')}" />`;
    });
    html += `<button class="te-del" data-row="${ri}" title="행 삭제" aria-label="행 삭제">${ICON.trash}</button>`;
  });
  html += `</div>`;
  tableEditor.innerHTML = html;
}

// ───────── 결제 포인트 편집기 ─────────
function currentPayIds() {
  const cards = state?.payment?.cards || [];
  return new Set(PAY_POINTS.filter((p) => cards.some((c) => String(c.logoSrc || '').includes(p.match))).map((p) => p.id));
}
function renderPaymentEditor() {
  const active = currentPayIds();
  payPoints.innerHTML = PAY_POINTS.map((p) => `
    <label class="pay-point${active.has(p.id) ? '' : ' is-off'}">
      <input type="checkbox" data-pt="${p.id}" ${active.has(p.id) ? 'checked' : ''} />
      <span>${escAttr(p.label)}</span>
    </label>`).join('');
  if (fPayTitle) {
    fPayTitle.value = state.payment?.title ?? '';
    fPayTitle.disabled = !state.payment;
  }
}
function renderPayModes() {
  if (!payModes) return;
  const cur = state?._payMode || CASE_PAY_DEFAULT[state?._caseId] || 'card_1';
  payModes.innerHTML = PAY_MODES.map((m) => `
    <button type="button" class="pay-mode${m.id === cur ? ' is-active' : ''}" data-mode="${m.id}">
      <span class="pay-mode-title">${escAttr(m.label)}</span>
      <span class="pay-mode-desc">${escAttr(m.desc)}</span>
    </button>`).join('');
}
function rebuildPaymentFromChecks() {
  const checked = [...payPoints.querySelectorAll('input[data-pt]')].filter((i) => i.checked).map((i) => i.dataset.pt);
  if (!checked.length) { state.payment = null; return; }
  const title = state.payment?.title || '3가지 포인트 中 택 1 적립';
  const subtitle = state.payment?.subtitle ?? '';
  const cards = PAY_POINTS.filter((p) => checked.includes(p.id)).map((p) => ({ ...p.card }));
  state.payment = { title, subtitle, cards };
}

// ───────── 특별 프로모션 카드 편집기 (케이스 B) ─────────
function renderPromoEditor() {
  const cards = state?.specialPromoSection?.cards;
  if (!Array.isArray(cards) || !cards.length) {
    promoEditor.innerHTML = '<p class="panel-hint">특별 프로모션 카드 없음</p>';
    return;
  }
  const layout = state._promoLayout === 'row' ? 'row' : 'card';
  const layoutToggle = `
    <div class="ed-field">
      <span class="field-label">표시 방식</span>
      <div class="tone-group tone-group--2">
        <button type="button" class="tone-btn${layout === 'card' ? ' is-active' : ''}" data-promo-layout="card">카드형</button>
        <button type="button" class="tone-btn${layout === 'row' ? ' is-active' : ''}" data-promo-layout="row">행형</button>
      </div>
      <p class="panel-hint">카드형은 색 블록, 행형은 전체 폭 가로줄로 쌓아요. 이 배너에만 적용돼요.</p>
    </div>`;
  promoEditor.innerHTML = layoutToggle + cards.map((c, i) => `
    <div class="promo-card-edit">
      <div class="pce-tag">카드 ${i + 1}</div>
      <label class="field">
        <span class="field-label">태그</span>
        <input class="field-input pce-field" data-idx="${i}" data-k="tag" value="${escAttr(c.tag ?? '')}" />
      </label>
      <div class="field">
        <span class="field-label">헤드라인</span>
        <textarea class="field-input field-textarea pce-field" data-idx="${i}" data-k="headline" rows="2">${escAttr(c.headline ?? '')}</textarea>
        <div class="pce-tools">
          <button type="button" class="btn-emph" data-emph="${i}">선택한 글자 강조</button>
          <span class="pce-help">강조할 글자를 드래그한 뒤 버튼을 누르세요 (코랄색으로 표시)</span>
        </div>
      </div>
      <label class="field">
        <span class="field-label">설명</span>
        <input class="field-input pce-field" data-idx="${i}" data-k="sub" value="${escAttr(c.sub ?? '')}" />
      </label>
    </div>`).join('');
}

// 신뢰도 → 팝오버 입력 테두리
function setConf(input, c) {
  if (!input) return;
  input.classList.remove('conf-high', 'conf-medium', 'conf-low');
  if (c === 'high')   input.classList.add('conf-high');
  else if (c === 'medium') input.classList.add('conf-medium');
  else if (c === 'low' || c === 'missing') input.classList.add('conf-low');
}
function applyConfidenceStyles() {
  const f = state._extraction?.fields || {};
  setConf(F.aptName,     f.aptName?.confidence);
  setConf(F.periodStart, f.period?.confidence);
  setConf(F.periodEnd,   f.period?.confidence);
  setConf(F.stores,      f.stores?.confidence);
  setConf(F.notices,     f.notices?.confidence);
  setConf(F.tableTitle,  f.benefitTable?.confidence);
}

// ───────── 폼 → state (디바운스) ─────────
let debounceTimer;
function scheduleSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(syncStateFromForm, 80);
}
function syncStateFromForm() {
  state.welcome     = F.welcome.value;
  state.aptName     = F.aptName.value;
  state.mainTitle   = F.mainTitle.value;
  state.period      = { start: F.periodStart.value, end: F.periodEnd.value };
  state.stores      = F.stores.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (state.maxBenefit) {
    state.maxBenefit.before = F.maxBefore.value;
    state.maxBenefit.amount = F.maxAmount.value;
    state.maxBenefit.after  = F.maxAfter.value;
  }
  if (state.celebration) {
    state.celebration.before = F.celBefore.value;
    state.celebration.main   = F.celMain.value;
    state.celebration.after  = F.celAfter.value;
  }
  state.notices     = F.notices.value.split('\n').map((s) => s.trim()).filter(Boolean);
  rerender();
}

// ───────── 편집 팝오버 ─────────
function openEditor(panel, anchorEl, opts = {}) {
  if (!editPopover) return;
  if (panel === 'card') {
    if (!renderCardEditor(opts.kind, +opts.idx)) return;
    $('#edPopTitle').textContent = CARD_TITLES[opts.kind] || '카드';
  } else {
    if (!PANEL_TITLES[panel]) return;
    $('#edPopTitle').textContent = PANEL_TITLES[panel];
  }
  renderEditSource(panel, panel === 'card');   // 추출 원문 보기
  editPopover.querySelectorAll('.ed-panel').forEach((p) => { p.hidden = (p.dataset.panel !== panel); });
  editPopover.classList.remove('is-hidden');
  positionPopover(anchorEl);
  const first = editPopover.querySelector(`.ed-panel[data-panel="${panel}"] input, .ed-panel[data-panel="${panel}"] textarea, .ed-panel[data-panel="${panel}"] select`);
  first?.focus();
}

// ───────── 카드 편집기 (제품/추가혜택/후기/박람회) ─────────
function renderCardEditor(kind, idx) {
  const body = $('#cardPanelBody');
  const sec = CARD_SECTION[kind];
  const cards = state?.[sec]?.cards;
  if (!body || !sec || !Array.isArray(cards) || !cards[idx]) return false;
  currentCard = { kind, idx };
  const c = cards[idx];
  const e = escAttr;
  const text = (label, k, val, ph = '') => `<label class="ed-field"><span class="field-label">${label}</span><input class="field-input cf" data-k="${k}" value="${e(val ?? '')}" placeholder="${e(ph)}" /></label>`;
  const area = (label, k, val, ph = '') => `<div class="ed-field"><span class="field-label">${label}</span><textarea class="field-input field-textarea cf" data-k="${k}" rows="2" placeholder="${e(ph)}">${e(val ?? '')}</textarea></div>`;
  const sel  = (label, k, val, opts) => `<label class="ed-field"><span class="field-label">${label}</span><select class="field-input cf" data-k="${k}">${opts.map(([v, t]) => `<option value="${e(v)}"${v === val ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></label>`;
  const emph = (k) => `<div class="emph-tool"><button type="button" class="btn-emph" data-emph="${k}">선택한 글자 강조</button><span class="pce-help">강조할 글자를 드래그한 뒤 누르세요 (코랄색)</span></div>`;
  const img  = (src) => `<div class="ed-field"><span class="field-label">사진</span><div class="card-img-row"><img class="card-img-thumb" src="${e(src || '')}" alt="" /><button type="button" class="btn btn-ghost btn-sm" data-imgpick="1">사진 바꾸기</button></div></div>`;

  let fields = '';
  if (kind === 'product') {
    fields = img(c.imageSrc) + text('제품명', 'name', c.name) + text('조건', 'condition', c.condition) + text('포인트 (숫자만)', 'amount', c.amount, '예: 100,000');
  } else if (kind === 'extra') {
    fields = img(c.imageSrc) + text('제품명·항목', 'name', c.name) + text('조건', 'condition', c.condition)
      + text('뱃지 문구', 'badge', c.badge, '예: 네이버 포인트 {5만원} 증정') + emph('badge')
      + text('공동구매 세대수 (쉼표, 비우면 뱃지 사용)', 'units', Array.isArray(c.units) ? c.units.join(', ') : '', '예: 20, 40, 80, 100');
  } else if (kind === 'review') {
    fields = sel('색상', 'theme', c.theme, REVIEW_THEMES) + sel('아이콘', 'icon', c.icon, REVIEW_ICONS)
      + text('태그', 'tag', c.tag) + area('헤드라인', 'headline', c.headline) + emph('headline') + text('설명', 'sub', c.sub);
  } else if (kind === 'fair') {
    fields = text('태그', 'tag', c.tag, '예: 1차 박람회') + area('날짜 (줄바꿈 가능)', 'dates', c.dates) + text('대상', 'target', c.target, '예: 2단지 입주민') + text('설명', 'sub', c.sub, '예: 2026년 2월 입주 예정');
  }
  const addBtn = cards.length < (CARD_MAX[kind] || 9) ? `<button type="button" class="btn btn-ghost btn-sm" data-card-add="1">+ 카드 추가</button>` : '<span></span>';
  const delBtn = cards.length > 1 ? `<button type="button" class="btn-link-text card-del" data-card-del="1">이 카드 삭제</button>` : '';
  body.innerHTML = `<div class="card-edit-head">카드 ${idx + 1} / ${cards.length}</div>${fields}`
    + `<div class="card-edit-foot">${addBtn}${delBtn}</div>`
    + `<button type="button" class="btn-link-text card-hide" data-card-hide="${kind}">이 영역 전체 안 보이기 (나중에 다시 켤 수 있어요)</button>`;
  return true;
}

function updateCardField(k, value) {
  if (!currentCard) return;
  const c = state[CARD_SECTION[currentCard.kind]]?.cards?.[currentCard.idx];
  if (!c) return;
  if (currentCard.kind === 'extra' && k === 'units') {
    const arr = String(value).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    if (arr.length) c.units = arr; else delete c.units;
  } else {
    c[k] = value;
  }
  rerender();
}

// 드래그 선택 글자를 {…}로 감싸 코랄 강조 (input/textarea 공용)
function wrapEmphasis(el) {
  if (!el) return;
  const s = el.selectionStart, en = el.selectionEnd;
  if (s == null || s === en) return;
  const v = el.value;
  el.value = `${v.slice(0, s)}{${v.slice(s, en)}}${v.slice(en)}`;
  updateCardField(el.dataset.k, el.value);
  el.focus();
  el.setSelectionRange(s, en + 2);
}

function blankCard(kind) {
  if (kind === 'product') return { imageSrc: '', name: '', condition: '', amount: '' };
  if (kind === 'extra')   return { imageSrc: '', name: '', condition: '', badge: '' };
  if (kind === 'review')  return { theme: 'naver', icon: 'calendar', tag: '', headline: '', sub: '' };
  if (kind === 'fair')    return { tag: '', dates: '', target: '', sub: '' };
  return {};
}
function addCard() {
  if (!currentCard) return;
  const arr = state[CARD_SECTION[currentCard.kind]].cards;
  if (arr.length >= (CARD_MAX[currentCard.kind] || 9)) return;
  arr.push(blankCard(currentCard.kind));
  renderCardEditor(currentCard.kind, arr.length - 1);
  rerender();
}
function delCard() {
  if (!currentCard) return;
  const arr = state[CARD_SECTION[currentCard.kind]].cards;
  arr.splice(currentCard.idx, 1);
  rerender();
  if (arr.length) renderCardEditor(currentCard.kind, Math.min(currentCard.idx, arr.length - 1));
  else closeEditor();
}

// ───────── 제품 사진 라이브러리 피커 ─────────
async function ensureProductLib() {
  if (productLib.length) return productLib;
  try { productLib = await (await fetch('/samples/product-images.json')).json(); } catch { productLib = []; }
  return productLib;
}
async function openImgPicker() {
  await ensureProductLib();
  const body = $('#imgPickerBody');
  const mine = `
    <div class="ip-group">
      <p class="ip-group-title">내 사진</p>
      <div class="swatch-grid"><button type="button" class="swatch swatch--add" data-prod-upload="1">${PLUS_SVG}<span>내 사진 추가</span></button></div>
      <p class="panel-hint">정사각형에 가까운 사진을 권장해요. 카드 모양에 맞춰 사진이 잘려 보일 수 있어요.</p>
    </div>`;
  body.innerHTML = mine + productLib.map((p) => `
    <div class="ip-group">
      <p class="ip-group-title">${escAttr(p.name)}</p>
      <div class="ip-grid">${p.images.map((src) => `<img class="ip-thumb" data-src="${escAttr(src)}" src="${escAttr(src)}" loading="lazy" alt="${escAttr(p.name)}" />`).join('')}</div>
    </div>`).join('');
  $('#imgPicker').classList.remove('is-hidden');
}
function closeImgPicker() { $('#imgPicker').classList.add('is-hidden'); }
function pickImage(src) {
  if (!currentCard) return;
  const c = state[CARD_SECTION[currentCard.kind]]?.cards?.[currentCard.idx];
  if (c) { c.imageSrc = src; renderCardEditor(currentCard.kind, currentCard.idx); rerender(); }
  closeImgPicker();
}

// ───────── 내 사진 올리기 (배경·제품 공용) ─────────
// 업로드한 사진을 캔버스로 축소해 data URL 로 state 에 박는다 → 미리보기·인쇄 내보내기 공통 반영,
// 용량을 줄여 자동저장(브라우저 기억)·인쇄 전송도 안전. 너무 작은 사진은 rerender 의 해상도 안내가 잡음.
function loadBitmap(file) {
  if (window.createImageBitmap) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
async function downscaleToDataUrl(file, { maxDim, quality = 0.85, mime = 'image/jpeg' }) {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return canvas.toDataURL(mime, quality);
}
async function handleBgUpload(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('사진 파일(JPG·PNG)만 올릴 수 있어요.', 'err'); return; }
  try {
    state.background = true;
    state.bgImage = await downscaleToDataUrl(file, { maxDim: 2400 });
    rerender();
  } catch { showToast('사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.', 'err'); }
}
async function handleProdUpload(file) {
  if (!file || !currentCard) return;
  if (!file.type.startsWith('image/')) { showToast('사진 파일(JPG·PNG)만 올릴 수 있어요.', 'err'); return; }
  try {
    pickImage(await downscaleToDataUrl(file, { maxDim: 1200 }));
  } catch { showToast('사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.', 'err'); }
}

// ───────── 카피 톤 (큰 헤드라인 문구) ─────────
function fairDays() {
  const s = state.period?.start, e = state.period?.end;
  if (!s || !e) return null;
  const d = Math.round((new Date(e) - new Date(s)) / 86_400_000) + 1;
  return (d > 0 && d < 90) ? d : null;
}
function tonePresetMax(tone, days) {
  if (tone === '기간강조') return { before: days ? `단 ${days}일간! 입주박람회 현장에서만 드리는` : '입주박람회 기간 한정', mainTemplate: '최대 {amount} 특별 혜택', after: '이 기회를 놓치지 마세요!' };
  if (tone === '축하형')   return { before: '입주를 진심으로 축하드립니다', mainTemplate: '최대 {amount} 특별 혜택', after: '감사 혜택으로 보답하겠습니다' };
  return { before: '입주박람회 현장에서만 드리는', mainTemplate: '최대 {amount} 특별 혜택', after: '지금 바로 만나 보세요!' };  // 금액강조
}
function tonePresetCel(tone, days) {
  if (tone === '금액강조') return { before: '입주를 축하드립니다', main: '최대 {특별 혜택}을 드립니다', after: '지금 매장에서 만나보세요' };
  if (tone === '기간강조') return { before: days ? `단 {${days}일간}` : '기간 한정 특별', main: '입주 특별 혜택', after: '놓치지 마세요' };
  return { before: '입주를', main: '진심으로 {축하}드립니다', after: '특별 혜택으로 보답하겠습니다' };  // 축하형
}
function renderToneGroup() {
  const g = $('#toneGroup');
  if (!g) return;
  const cur = state?._copyTone;
  g.innerHTML = TONES.map((t) => `<button type="button" class="tone-btn${t === cur ? ' is-active' : ''}" data-tone="${t}">${t}</button>`).join('');
}

// 배경 사진 선택 (없음/침실/쿠시노/내 사진) — 텍스트 버튼 대신 썸네일 스와치
const PLUS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
function bgActiveId() {
  const on = state.background ?? (state._caseId === 'case-c');
  if (!on) return 'off';
  if (typeof state.bgImage === 'string' && state.bgImage.startsWith('data:')) return 'custom';   // 내 사진
  return Object.keys(BG_SRC).find((id) => BG_SRC[id] === state.bgImage) || 'bedroom';   // bgImage 미설정 시 기본 침실
}
function renderBgGroup() {
  if (!bgGroup) return;
  const cur = bgActiveId();
  const act = (id) => (id === cur ? ' is-active' : '');
  let html = '';
  for (const b of BACKGROUNDS) {
    if (b.id === 'off') {
      html += `<button type="button" class="swatch swatch--none${act('off')}" data-bg="off" title="배경 없음"><span class="swatch-label">없음</span></button>`;
    } else {
      html += `<button type="button" class="swatch swatch--image${act(b.id)}" data-bg="${b.id}"><img src="${BG_SRC[b.id]}" alt="${escAttr(b.label)} 배경 미리보기" loading="lazy"><span class="swatch-cap">${escAttr(b.label)}</span></button>`;
    }
  }
  if (cur === 'custom') {
    html += `<button type="button" class="swatch swatch--image is-active" data-bg="custom"><img src="${escAttr(state.bgImage)}" alt="내 사진 배경"><span class="swatch-cap">내 사진</span></button>`;
  }
  html += `<button type="button" class="swatch swatch--add" data-bg-upload="1" title="내 컴퓨터에서 사진 고르기">${PLUS_SVG}<span>내 사진 추가</span></button>`;
  bgGroup.innerHTML = html;
}
function applyBgChoice(id) {
  if (id === 'off') { state.background = false; state.bgImage = null; }
  else if (id === 'custom') { state.background = true; }   // 올린 내 사진 유지
  else { state.background = true; state.bgImage = BG_SRC[id] || null; }
  rerender();
}
function applyTone(tone) {
  if (!state) return;
  state._copyTone = tone;
  const days = fairDays();
  // 실제 화면에 그려진 헤드라인에 적용 — case-d 는 maxBenefit·celebration 둘 다 state 에 있지만
  // celebration 만 렌더되므로, 보이는 쪽을 바꿔야 한다.
  const celRendered = !!root.querySelector('.x-banner .celebration');
  if (celRendered && state.celebration) {
    Object.assign(state.celebration, tonePresetCel(tone, days));
  } else if (state.maxBenefit) {
    Object.assign(state.maxBenefit, tonePresetMax(tone, days));  // amount 는 유지
  } else if (state.celebration) {
    Object.assign(state.celebration, tonePresetCel(tone, days));
  }
  syncFormFromState();
  rerender();
}

// ───────── 영역 순서 (드래그로 조절) ─────────
function presentRegions() {
  const r = [];
  if (state.maxBenefit) r.push('maxBenefit');
  if (state.celebration) r.push('celebration');
  if (state.fairsSection?.cards?.length) r.push('fairs');
  if (state.productSection?.cards?.length) r.push('product');
  if (state.extraSection?.cards?.length) r.push('extra');
  if (state.benefitTable?.columns?.length) r.push('table');
  if (state.reviewSection?.cards?.length) r.push('review');
  if (state.specialPromoSection?.cards?.length) r.push('promo');
  if (state.payment?.cards?.length) r.push('payment');
  if (state.notices?.length) r.push('notices');
  return r;
}
// 현재 화면(=렌더)에 그려진 순서대로 영역 키 반환
function currentRegionOrder(banner) {
  const items = presentRegions()
    .map((key) => { const el = banner.querySelector(REGION_SEL[key]); return { key, top: el ? el.getBoundingClientRect().top : NaN }; })
    .filter((i) => !Number.isNaN(i.top));
  items.sort((a, b) => a.top - b.top);
  return items.map((i) => i.key);
}
function renderRegionOrder() {
  const wrap = $('#regionOrder');
  if (!wrap) return;
  const banner = root.querySelector('.x-banner');
  const hidden = Array.isArray(state._hidden) ? state._hidden : [];
  const visible = banner ? currentRegionOrder(banner) : [];          // 화면에 보이는(숨김 아닌) 영역, 순서대로
  const hiddenPresent = presentRegions().filter((k) => hidden.includes(k));   // 데이터는 있는데 숨긴 영역
  if (!visible.length && !hiddenPresent.length) { wrap.innerHTML = '<p class="panel-hint">조절할 영역이 없어요.</p>'; return; }

  const lbl = (k) => escAttr(REGION_LABELS[k] || k);
  let html = visible.map((k) =>
    `<div class="ro-row" draggable="true" data-region="${k}"><span class="ro-grip">⠿</span><span class="ro-label">${lbl(k)}</span><button type="button" class="ro-hide" data-hide="${k}" title="이 영역 숨기기">숨기기</button></div>`).join('');
  if (hiddenPresent.length) {
    html += `<div class="ro-sep">숨긴 영역 (배너에 안 나옴)</div>`;
    html += hiddenPresent.map((k) =>
      `<div class="ro-row ro-hidden" data-region="${k}"><span class="ro-label">${lbl(k)}</span><button type="button" class="ro-show" data-show="${k}">다시 보이기</button></div>`).join('');
  }
  wrap.innerHTML = html;
}

// 영역 숨김 / 다시 보이기 (비파괴 — 데이터는 보존)
function hideRegion(key) {
  const set = new Set(state._hidden || []);
  set.add(key);
  state._hidden = [...set];
  rerender();
}
function showRegion(key) {
  state._hidden = (state._hidden || []).filter((k) => k !== key);
  rerender();
}
function closeEditor() {
  editPopover?.classList.add('is-hidden');
}
function positionPopover(anchorEl) {
  const pop = editPopover;
  pop.style.left = '0px';
  pop.style.top  = '0px';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const m = 14, pad = 8;
  let left, top;
  if (anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    if (r.left - w - m >= pad) left = r.left - w - m;             // 왼쪽 우선 (편집 중 영역이 안 가려짐)
    else if (r.right + m + w <= window.innerWidth - pad) left = r.right + m;
    else left = Math.max(pad, (window.innerWidth - w) / 2);
    top = Math.min(Math.max(r.top, pad), Math.max(pad, window.innerHeight - h - pad));
  } else {
    left = (window.innerWidth - w) / 2;
    top  = Math.max(pad, (window.innerHeight - h) / 2);
  }
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top  = `${Math.round(top)}px`;
}

// 검수 리스트에서 항목 누르면 미리보기 해당 위치로 이동 + 잠깐 강조
function targetField(key) {
  const el = root.querySelector(`.x-banner [data-field="${key}"]`);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('is-target');
  setTimeout(() => el.classList.remove('is-target'), 2300);
  return el;
}

// 검수 리스트·신뢰도 readout 공용 — 그 필드 미리보기로 점프 + 알맞은 편집 팝오버 오픈
function goToField(key) {
  if (!key) return;
  const el = targetField(key);
  if (key === 'promotions') {
    if (state.specialPromoSection?.cards?.length) { openEditor('promo', el); return; }
    const card = root.querySelector('.x-banner [data-edit="card"]');   // 제품/후기/박람회 첫 카드
    if (card) openEditor('card', card, { kind: card.dataset.kind, idx: card.dataset.idx });
    return;
  }
  const meta = REVIEW_FIELDS.find((it) => it.key === key) || READOUT.find((it) => it.key === key);
  if (meta?.panel) openEditor(meta.panel, el);
}

// ───────── PDF 업로드 ─────────
function showExtractGuide(msg) {
  // 막다른 길 방지 — 기술 에러 대신 "무엇을 하면 되는지" 안내. 시작화면은 그대로 둬서 다시 시도 가능.
  extractStatus.innerHTML = `${escAttr(msg)} <button type="button" class="status-act" id="guideBlank">직접 입력해서 만들기</button>`;
  extractStatus.className = 'status status--err';
  $('#guideBlank')?.addEventListener('click', () => $('#startBlank')?.click(), { once: true });
}

async function handlePdfUpload(file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    showExtractGuide('PDF 파일만 올릴 수 있어요. 품의서를 PDF로 저장해서 다시 올려주세요.');
    return;
  }
  extractStatus.textContent = `분석 중: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`;
  extractStatus.className = 'status status--busy';

  const form = new FormData();
  form.append('pdf', file);

  let res;
  try {
    res = await fetch('/api/extract', { method: 'POST', body: form });
  } catch {
    showExtractGuide('서버에 연결하지 못했어요. 어플 서버가 실행 중인지 확인한 뒤 다시 시도해 주세요.');
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showExtractGuide(err.error || '품의서를 읽지 못했어요. 다른 PDF로 다시 시도하거나 직접 입력해 만들 수 있어요.');
    return;
  }

  const newState = await res.json();
  state = newState;
  allowDraftSave = true;
  syncFormFromState();
  rerender();

  const hi = countConfidence(newState, 'high');
  const me = countConfidence(newState, 'medium');
  const lo = countConfidence(newState, 'low');
  extractStatus.innerHTML = `<b>${file.name}</b> 분석 완료 · 정확 ${hi} 항목 / 확인필요 ${me + lo} 항목`;
  extractStatus.className = 'status status--ok';
  hideStart();
  maybeStartTour();
}
function countConfidence(s, level) {
  const f = s._extraction?.fields || {};
  return Object.values(f).filter((m) => m.confidence === level).length;
}

// ───────── 일시 알림(토스트) · 확인 모달 ─────────
let _toastTimer = null;
const TOAST_ICO = { ok: 'check', err: 'xCircle', busy: 'spinner' };
function showToast(html, kind = 'ok') {
  let el = document.getElementById('uiToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'uiToast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.className = `toast toast--${kind}`;
  el.innerHTML = `<span class="toast-ico">${ICON[TOAST_ICO[kind] || 'check']}</span><span class="toast-msg">${html}</span>`;
  void el.offsetWidth;            // 리플로우 — 페이드 트랜지션 재생
  el.classList.add('is-show');
  clearTimeout(_toastTimer);
  const dur = kind === 'busy' ? 0 : kind === 'err' ? 6000 : 3500;   // busy 는 자동으로 안 사라짐(다음 알림이 교체)
  if (dur) _toastTimer = setTimeout(() => el.classList.remove('is-show'), dur);
}

// 스타일 확인 모달 (네이티브 confirm 대체). Promise<boolean> 반환.
const DLG_ICO = { danger: 'alert', warning: 'alert', success: 'check', info: 'info' };
function confirmDialog({ title, bodyHtml = '', okText = '확인', cancelText = '취소', danger = false, variant = null }) {
  const v = variant || (danger ? 'danger' : '');
  const iconHtml = v ? `<div class="ui-dialog-icon ui-dialog-icon--${v}">${ICON[DLG_ICO[v] || 'info']}</div>` : '';
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'ui-dialog-overlay';
    overlay.innerHTML = `
      <div class="ui-dialog" role="dialog" aria-modal="true">
        ${iconHtml}
        <h3 class="ui-dialog-title">${title}</h3>
        ${bodyHtml ? `<div class="ui-dialog-body">${bodyHtml}</div>` : ''}
        <div class="ui-dialog-actions">
          <button type="button" class="btn btn-ghost" data-act="cancel">${cancelText}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (val) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.classList.remove('is-show');
      setTimeout(() => overlay.remove(), 150);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(false); }
      else if (e.key === 'Enter') { e.stopPropagation(); close(true); }
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return close(false);   // 배경 클릭 = 취소
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok') close(true);
      else if (act === 'cancel') close(false);
    });
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      overlay.classList.add('is-show');
      overlay.querySelector('[data-act="ok"]')?.focus();
    });
  });
}

// ───────── 다운로드 ─────────
function showMainStatus(html, kind) {
  showToast(html, kind);
}
function setDownloadBusy(busy) {
  ['#btnPng', '#btnPdf', '#btnPng2', '#btnPdf2'].forEach((sel) => {
    const b = $(sel);
    if (b) b.disabled = busy;
  });
}
async function download(format) {
  // 인쇄 전 종합 점검 — 빈 필수항목 + 글자 잘림(넘침) + 저해상도 사진. 하나라도 있으면 강한 확인.
  recheckImages();
  const warns = validationWarnings();
  if (warns.length) {
    const ok = await confirmDialog({
      title: '인쇄 전에 확인해 주세요',
      bodyHtml: `이대로 인쇄하면 잘리거나 흐리게 나올 수 있어요:<ul class="ui-dialog-list">${warns.map((w) => `<li>${escAttr(w)}</li>`).join('')}</ul>`,
      okText: '그래도 받기',
      variant: 'warning',
    });
    if (!ok) return;
  }

  const label = format === 'pdf' ? '인쇄용 PDF' : 'PNG 이미지';
  setDownloadBusy(true);
  showMainStatus(`${label}를 만들고 있어요… (최대 10초)`, 'busy');
  try {
    const res = await fetch(`/api/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '알 수 없는 오류' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const colorMode = (res.headers.get('X-Color-Mode') || '').toLowerCase();
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m  = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/);
    const filename = m ? decodeURIComponent(m[1]) : `xbanner.${format}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    let note = '', kind = 'ok';
    if (format === 'pdf') {
      if (colorMode === 'cmyk') note = ' (CMYK · 도련 3mm 적용)';
      else { note = ' 주의: 색상이 RGB 입니다(서버에 Ghostscript 미설치). 인쇄소가 CMYK를 요구하면 설치 후 다시 받으세요.'; kind = 'busy'; }
    }
    showMainStatus(`다운로드 완료 — 다운로드 폴더의 <b>${escAttr(filename)}</b> 파일을 인쇄소에 보내세요.${note}`, kind);
  } catch (err) {
    showMainStatus(`다운로드 실패: ${escAttr(err.message)}`, 'err');
  } finally {
    setDownloadBusy(false);
  }
}

// ───────── 부트 ─────────
async function boot() {
  const res = await fetch('/samples/case-a-default.json');
  initial = await res.json();
  state   = JSON.parse(JSON.stringify(initial));
  syncFormFromState();
  rerender();
  showStart();
  document.fonts?.ready?.then(() => {
    const bn = root.querySelector('.x-banner');
    applyBackground(bn, state);
    fitBanner(bn);
  });

  // ── 시작화면 ──
  $('#startUpload').addEventListener('click', () => pdfInput.click());
  $('#startBlank').addEventListener('click', () => {
    state = JSON.parse(JSON.stringify(initial));
    allowDraftSave = true;
    syncFormFromState();
    rerender();
    hideStart();
    maybeStartTour();
  });

  const draft = loadDraft();
  if (draft?.state) {
    const resumeBtn = $('#startResume');
    resumeBtn.hidden = false;
    const when = draft.savedAt
      ? new Date(draft.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    $('#startResumeDesc').textContent = when ? `마지막 작업: ${when}` : '마지막 작업 이어서';
    resumeBtn.addEventListener('click', () => {
      state = JSON.parse(JSON.stringify(draft.state));
      allowDraftSave = true;
      syncFormFromState();
      rerender();
      hideStart();
      maybeStartTour();
    });
  }

  pdfInput.addEventListener('change', (e) => handlePdfUpload(e.target.files?.[0]));
  ['dragenter', 'dragover'].forEach((ev) => startDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    startDrop.classList.add('dz-active');
  }));
  ['dragleave', 'drop'].forEach((ev) => startDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    startDrop.classList.remove('dz-active');
  }));
  startDrop.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type === 'application/pdf') handlePdfUpload(file);
    else if (file) showToast('PDF 파일만 업로드 가능합니다.', 'err');
  });

  // ── 미리보기 직접편집 ──
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-edit]');
    if (!el) return;
    if (el.dataset.edit === 'card') openEditor('card', el, { kind: el.dataset.kind, idx: el.dataset.idx });
    else openEditor(el.dataset.edit, el);
  });
  $('#btnEditClose').addEventListener('click', closeEditor);
  // 팝오버·미리보기 영역·사진피커 바깥 클릭 시 닫기
  document.addEventListener('mousedown', (e) => {
    if (editPopover.classList.contains('is-hidden')) return;
    if (editPopover.contains(e.target)) return;
    if (e.target.closest('#imgPicker')) return;                // 사진 피커는 팝오버를 닫지 않음
    if (e.target.closest('#bannerRoot [data-edit]')) return;   // 다른 영역 클릭은 click 에서 재오픈
    closeEditor();
  });

  // ── 카드 편집기 (제품/추가혜택/후기/박람회) ──
  const cardBody = $('#cardPanelBody');
  cardBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('cf')) updateCardField(e.target.dataset.k, e.target.value);
  });
  cardBody.addEventListener('change', (e) => {
    if (e.target.tagName === 'SELECT' && e.target.classList.contains('cf')) updateCardField(e.target.dataset.k, e.target.value);
  });
  cardBody.addEventListener('click', (e) => {
    if (e.target.closest('[data-imgpick]')) { openImgPicker(); return; }
    const em = e.target.closest('[data-emph]');
    if (em) { wrapEmphasis(cardBody.querySelector(`.cf[data-k="${em.dataset.emph}"]`)); return; }
    if (e.target.closest('[data-card-add]')) { addCard(); return; }
    if (e.target.closest('[data-card-del]')) { delCard(); return; }
    const hideBtn = e.target.closest('[data-card-hide]');
    if (hideBtn) { closeEditor(); hideRegion(hideBtn.dataset.cardHide); return; }
  });

  // ── 제품 사진 피커 ──
  $('#imgPickerClose').addEventListener('click', closeImgPicker);
  $('#imgPicker').addEventListener('click', (e) => { if (e.target.id === 'imgPicker') closeImgPicker(); });
  $('#imgPickerBody').addEventListener('click', (e) => {
    if (e.target.closest('[data-prod-upload]')) { $('#prodUpload').click(); return; }
    const t = e.target.closest('.ip-thumb');
    if (t) pickImage(t.dataset.src);
  });
  $('#prodUpload').addEventListener('change', (e) => { handleProdUpload(e.target.files?.[0]); e.target.value = ''; });

  // ── 검수 리스트 ──
  reviewList.addEventListener('click', (e) => {
    const ok = e.target.closest('.rv-item-ok');
    if (ok) { markReviewed(ok.dataset.ok); return; }
    const item = e.target.closest('.rv-item');
    if (item) goToField(item.dataset.go);
  });

  // ── 신뢰도 readout — 고치기 가능한 줄 클릭 시 미리보기로 점프 + 편집 ──
  $('#extractReadout')?.addEventListener('click', (e) => {
    const line = e.target.closest('.ro-line.is-editable');
    if (line) goToField(line.dataset.go);
  });

  // 줌 / 전체화면 / 가이드
  $$('.zoom-btn[data-zoom]').forEach((b) => b.addEventListener('click', () => setZoom(Number(b.dataset.zoom))));
  $('#btnGuide').addEventListener('click', () => {
    guideOn = !guideOn;
    $('#btnGuide').classList.toggle('is-active', guideOn);
    renderGuide();
  });
  $('#btnFull').addEventListener('click', openFullscreen);
  $('#btnFullClose').addEventListener('click', closeFullscreen);
  $('#zoomOverlay').addEventListener('click', (e) => { if (e.target.id === 'zoomOverlay') closeFullscreen(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#imgPicker').classList.contains('is-hidden')) { closeImgPicker(); return; }
    if (!editPopover.classList.contains('is-hidden')) { closeEditor(); return; }
    closeFullscreen();
  });

  // 도움말 — 튜토리얼 다시 보기
  $('#btnHelp')?.addEventListener('click', () => startTour());

  // 처음으로 / 새 배너 / 기본값
  $('#btnHome').addEventListener('click', showStart);
  $('#btnRestart').addEventListener('click', async () => {
    if (hasEdits() && !(await confirmDialog({ title: '새 배너를 시작할까요?', bodyHtml: '지금 편집한 내용이 사라집니다.', okText: '계속', danger: true }))) return;
    clearDraft();
    allowDraftSave = false;
    state = JSON.parse(JSON.stringify(initial));
    syncFormFromState();
    rerender();
    extractStatus.textContent = '';
    extractStatus.className = 'status';
    showStart();
  });
  $('#btnReset').addEventListener('click', async () => {
    if (hasEdits() && !(await confirmDialog({ title: '기본값으로 되돌릴까요?', bodyHtml: '편집한 내용이 사라지고 기본값(광주데시앙)으로 돌아갑니다.', okText: '되돌리기', danger: true }))) return;
    state = JSON.parse(JSON.stringify(initial));
    syncFormFromState();
    rerender();
    clearDraft();
    extractStatus.textContent = '';
    extractStatus.className = 'status';
  });

  // 다운로드 (툴바 + 좌측 패널)
  $('#btnPng').addEventListener('click', () => download('png'));
  $('#btnPdf').addEventListener('click', () => download('pdf'));
  $('#btnPng2').addEventListener('click', () => download('png'));
  $('#btnPdf2').addEventListener('click', () => download('pdf'));

  // 정적 버튼 아이콘 주입 (다운로드/복사/닫기)
  ['#btnPng', '#btnPdf', '#btnPng2', '#btnPdf2', '#btnOrderTxt'].forEach((sel) => $(sel)?.insertAdjacentHTML('afterbegin', ICON.download));
  $('#btnOrderCopy')?.insertAdjacentHTML('afterbegin', ICON.copy);
  $('#btnEditClose') && ($('#btnEditClose').innerHTML = ICON.close);
  $('#imgPickerClose') && ($('#imgPickerClose').innerHTML = ICON.close);

  // 발주 사양서
  ['#o_qty', '#o_due', '#o_material', '#o_stand', '#o_manager', '#o_contact'].forEach((sel) => {
    $(sel)?.addEventListener('input', saveOrderFromForm);
    $(sel)?.addEventListener('change', saveOrderFromForm);
  });
  $('#btnOrderCopy').addEventListener('click', async () => {
    saveOrderFromForm();
    try {
      await navigator.clipboard.writeText(buildOrderText());
      showMainStatus('발주서를 복사했습니다. 인쇄소 메일/메시지에 붙여넣으세요.', 'ok');
    } catch {
      showMainStatus('복사 실패 — .txt 다운로드를 이용하세요.', 'err');
    }
  });
  $('#btnOrderTxt').addEventListener('click', () => {
    saveOrderFromForm();
    const blob = new Blob(['﻿' + buildOrderText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `발주서_${(state.aptName || 'xbanner').replace(/\s+/g, '')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  // 기본 텍스트 필드 (표 제목은 별도)
  for (const [key, el] of Object.entries(F)) {
    if (key === 'tableTitle') continue;
    el.addEventListener('input', scheduleSync);
  }
  // 자동추출 항목 — 편집하면 "확인 완료"로 간주
  const REVIEW_INPUT = { aptName: 'aptName', periodStart: 'period', periodEnd: 'period', stores: 'stores', notices: 'notices' };
  for (const [fkey, rvkey] of Object.entries(REVIEW_INPUT)) {
    F[fkey].addEventListener('input', () => markReviewedSilent(rvkey));
  }

  // 표 제목
  F.tableTitle.addEventListener('input', () => {
    if (state.benefitTable) { state.benefitTable.title = F.tableTitle.value; rerender(); }
  });

  // 혜택표 — 셀/라벨 편집 (포커스 유지 위해 미리보기만 갱신)
  tableEditor.addEventListener('input', (e) => {
    const el = e.target;
    if (el.classList.contains('te-cell')) {
      state.benefitTable.rows[+el.dataset.row][el.dataset.key] = el.value;
      markReviewedSilent('benefitTable');
      rerender();
    } else if (el.classList.contains('te-head')) {
      state.benefitTable.columns[+el.dataset.col].label = el.value;
      markReviewedSilent('benefitTable');
      rerender();
    }
  });
  tableEditor.addEventListener('click', (e) => {
    const colBtn = e.target.closest('.te-coldel');
    if (colBtn) {
      const cols = state.benefitTable?.columns || [];
      if (cols.length <= 2) { showToast('열은 최소 2개가 필요해요.', 'err'); return; }
      const ci = +colBtn.dataset.col;
      const key = cols[ci]?.key;
      cols.splice(ci, 1);
      if (key) (state.benefitTable.rows || []).forEach((row) => { delete row[key]; });
      renderTableEditor();
      rerender();
      return;
    }
    const btn = e.target.closest('.te-del');
    if (!btn) return;
    state.benefitTable.rows.splice(+btn.dataset.row, 1);
    renderTableEditor();
    rerender();
  });
  $('#btnAddRow').addEventListener('click', () => {
    if (!state.benefitTable?.columns?.length) return;
    const row = {};
    state.benefitTable.columns.forEach((c) => { row[c.key] = ''; });
    (state.benefitTable.rows ||= []).push(row);
    renderTableEditor();
    rerender();
  });
  // 열 추가 — 새 열은 "총 혜택" 바로 앞에(총 혜택은 맨 오른쪽 유지)
  $('#btnAddCol')?.addEventListener('click', () => {
    const t = state.benefitTable;
    if (!t || !Array.isArray(t.columns)) return;
    let n = 1, key;
    do { key = 'col' + n++; } while (t.columns.some((c) => c.key === key));
    const totalIdx = t.columns.findIndex((c) => c.style === 'total');
    const at = totalIdx >= 0 ? totalIdx : t.columns.length;
    t.columns.splice(at, 0, { key, label: '새 혜택', style: 'normal' });
    (t.rows || []).forEach((row) => { row[key] = ''; });
    renderTableEditor();
    rerender();
  });

  // 결제 포인트 / 표시 방식 / 제목
  payPoints.addEventListener('change', (e) => {
    if (!e.target.matches('input[data-pt]')) return;
    rebuildPaymentFromChecks();
    renderPaymentEditor();
    rerender();
  });
  payModes.addEventListener('click', (e) => {
    const b = e.target.closest('.pay-mode');
    if (!b) return;
    state._payMode = b.dataset.mode;
    renderPayModes();
    rerender();
  });
  fPayTitle.addEventListener('input', () => {
    if (state.payment) { state.payment.title = fPayTitle.value; rerender(); }
  });

  // 배경 사진 선택 (없음/침실/쿠시노/내 사진)
  bgGroup.addEventListener('click', (e) => {
    if (e.target.closest('[data-bg-upload]')) { $('#bgUpload').click(); return; }
    const b = e.target.closest('[data-bg]');
    if (b) applyBgChoice(b.dataset.bg);
  });
  $('#bgUpload').addEventListener('change', (e) => { handleBgUpload(e.target.files?.[0]); e.target.value = ''; });

  // 카피 톤 선택 (큰 헤드라인 문구)
  $('#toneGroup').addEventListener('click', (e) => {
    const b = e.target.closest('.tone-btn');
    if (b) applyTone(b.dataset.tone);
  });

  // 영역 순서 드래그앤드롭
  const roEl = $('#regionOrder');
  roEl.addEventListener('dragstart', (e) => {
    const r = e.target.closest('.ro-row');
    if (!r) return;
    dragRegion = r.dataset.region;
    r.classList.add('dragging');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  roEl.addEventListener('dragend', () => {
    roEl.querySelectorAll('.ro-row').forEach((r) => r.classList.remove('dragging', 'ro-over'));
    dragRegion = null;
  });
  roEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const r = e.target.closest('.ro-row');
    roEl.querySelectorAll('.ro-row').forEach((x) => x.classList.remove('ro-over'));
    if (r && r.dataset.region !== dragRegion) r.classList.add('ro-over');
  });
  roEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const r = e.target.closest('.ro-row');
    if (!r || !dragRegion || r.dataset.region === dragRegion) return;
    const order = [...roEl.querySelectorAll('.ro-row:not(.ro-hidden)')].map((x) => x.dataset.region);
    const from = order.indexOf(dragRegion), to = order.indexOf(r.dataset.region);
    order.splice(from, 1);
    order.splice(to, 0, dragRegion);
    state._order = order;
    rerender();
  });
  roEl.addEventListener('click', (e) => {
    const hideBtn = e.target.closest('[data-hide]');
    if (hideBtn) { hideRegion(hideBtn.dataset.hide); return; }
    const showBtn = e.target.closest('[data-show]');
    if (showBtn) { showRegion(showBtn.dataset.show); return; }
  });

  // 특별 프로모션 카드
  promoEditor.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.classList.contains('pce-field')) return;
    const card = state.specialPromoSection?.cards?.[+el.dataset.idx];
    if (card) { card[el.dataset.k] = el.value; rerender(); }
  });
  promoEditor.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-promo-layout]');
    if (seg) { state._promoLayout = seg.dataset.promoLayout; renderPromoEditor(); rerender(); return; }
    const btn = e.target.closest('.btn-emph');
    if (!btn) return;
    const idx = +btn.dataset.emph;
    const ta = promoEditor.querySelector(`textarea[data-k="headline"][data-idx="${idx}"]`);
    if (!ta) return;
    const s = ta.selectionStart, en = ta.selectionEnd;
    if (s === en) return;
    const v = ta.value;
    ta.value = `${v.slice(0, s)}{${v.slice(s, en)}}${v.slice(en)}`;
    const card = state.specialPromoSection?.cards?.[idx];
    if (card) { card.headline = ta.value; rerender(); }
    ta.focus();
    ta.setSelectionRange(s, en + 2);
  });

  // 디버그 편의 (state 는 재할당되므로 게터로 최신값 노출)
  Object.defineProperty(window, 'state', { configurable: true, get: () => state });
  window.rerender = rerender;
  window.openEditor = openEditor;
}

boot();
