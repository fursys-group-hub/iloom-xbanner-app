// PDF 추출 결과 → 어플 state 형태 변환
// 입력: { basic: { fields, meta }, benefit: { table, confidence } } (옵션)
// 출력: 어플 state (samples/case-a-default.json 형태)

import { pickTone, autoMainTitle } from './copy.js';

const DEFAULT_STATE = {
  _caseId: 'case-a',
  _version: 'v8',
  welcome:   'WELCOME HOME',
  aptName:   '',
  mainTitle: '입주 특별 프로모션',
  period:    { start: '', end: '' },
  stores:    [],
  maxBenefit: {
    before:       '입주박람회 현장에서만 드리는',
    amount:       '109만원',
    mainTemplate: '최대 {amount} 특별 혜택',
    after:        '지금 바로 만나 보세요!',
  },
  benefitTable: {
    title:   '구매 금액대별 혜택',
    columns: [
      { key: 'amount', label: '구매 금액',         style: 'amount' },
      { key: 'base',   label: '기존 혜택\n(상시)', style: 'normal' },
      { key: 'onsite', label: '현장 계약\n혜택',   style: 'normal' },
      { key: 'lg',     label: 'LG 연계\n혜택',     style: 'normal' },
      { key: 'total',  label: '총 혜택',          style: 'total'  },
    ],
    rows: [
      { amount: '200만원~',    base: '—',      onsite: '10만원', lg: '—',     total: '10만원'  },
      { amount: '300만원~',    base: '15만원', onsite: '5만원',  lg: '3만원', total: '23만원'  },
      { amount: '500만원~',    base: '30만원', onsite: '10만원', lg: '6만원', total: '46만원'  },
      { amount: '700만원~',    base: '40만원', onsite: '20만원', lg: '9만원', total: '69만원'  },
      { amount: '1,000만원~',  base: '80만원', onsite: '20만원', lg: '9만원', total: '109만원' },
    ],
  },
  payment: {
    title:    '프로모션 혜택 지급 안내',
    subtitle: '3가지 포인트 중 나에게 맞는 적립 혜택으로 선택하세요!',
    cards: [
      { label: 'POINT 01', logoSrc: '/assets/point%20logo/n%20pay.png',  desc: '네이버\n포인트 적립',   theme: 'npay'   },
      { label: 'POINT 02', logoSrc: '/assets/point%20logo/Lpoint.png',   desc: '롯데\nL.POINT 적립',    theme: 'lpoint' },
      { label: 'POINT 03', logoSrc: '/assets/point%20logo/ssgpay.svg',   desc: 'SSG\n페이머니 적립',    theme: 'ssgpay' },
    ],
  },
  notices: [
    '본 프로모션은 통합회원 한정 프로모션입니다.',
    '혜택은 기간 이후 주문건에는 적용이 불가합니다.',
    '타 프로모션과 중복 불가합니다. (LG전자 제휴 혜택 중복 가능)',
    '포인트는 마지막 납기 후 익월말 지급됩니다. (포인트 유효기간 이후 재발송 불가)',
    '박람회 현장 계약 시 계약금 10만원 이상 결제 필수.',
    '추후 품목 변경은 매장에서만 가능합니다.',
  ],
  footer: { logoSrc: '/assets/products/iloom-logo.png' },
};

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 특별 프로모션 키워드 → 2x2 그리드 카드 카피 프리셋
// headline 내 {강조} 토큰은 SpecialPromoGrid 가 <strong> 으로 처리
// theme 은 카드 순서대로 자동 순환 (coral/camel/green/blue) — 프리셋엔 지정 안 함
const PROMO_CARD_PRESETS = {
  한정프로모션:   { tag: '시즌오프 스페셜', headline: '{선착순}\n한정 특가',  sub: '정가 대비 최대 혜택\n재고 소진 시 조기 마감', icon: 'tag' },
  소파:          { tag: '소파 프로모션',   headline: '{가죽 스툴}\n증정',    sub: '지정 소파 구매 시',           icon: 'sofa' },
  학생방:        { tag: '학생방 패키지',   headline: '학생방 세트\n{특별 혜택}', sub: '지정 A/B 세트 구매 시',      icon: 'book' },
  단톡방공동구매: { tag: '단톡방 공동구매', headline: '세대 누적\n{추가 혜택}',  sub: '참여 세대 전원 적립',         icon: 'chat' },
  옷장단독:      { tag: '옷장 프로모션',   headline: '{키큰옷장}\n특가',     sub: '지정 옷장 구매 시',           icon: 'closet' },
  세트구매:      { tag: '세트 구매',       headline: '{패키지}\n할인',       sub: '지정 세트 구매 시',           icon: 'box' },
  모션:          { tag: '모션 프로모션',   headline: '{모션 가구}\n혜택',     sub: '지정 모션 구매 시',           icon: 'bed' },
};

// 감지된 프로모션 이름 배열 → 카드 배열 (최대 4종, 우선순위 순)
const PROMO_PRIORITY = ['한정프로모션', '옷장단독', '소파', '학생방', '모션', '세트구매', '단톡방공동구매'];
function buildPromoCards(promoNames) {
  const set = new Set(promoNames);
  const ordered = PROMO_PRIORITY.filter((n) => set.has(n));
  // 우선순위에 없는 것도 뒤에 추가
  for (const n of promoNames) if (!ordered.includes(n)) ordered.push(n);
  return ordered
    .map((name) => PROMO_CARD_PRESETS[name] ? { name, ...PROMO_CARD_PRESETS[name] } : null)
    .filter(Boolean)
    .slice(0, 4);
}

// 후기 이벤트 키워드 → 카드 카피 프리셋 (케이스 D 2x1 그리드)
// 보상 상세(스타벅스/신세계 등)는 PDF마다 달라 medium 신뢰도 기본값 — 폼에서 확인 권장
const REVIEW_CARD_PRESETS = {
  네이버예약후기: { theme: 'naver', icon: 'calendar', tag: '네이버 예약 후기', headline: '{스타벅스}\n쿠폰 증정',      sub: '상담 예약 후 후기 작성 시' },
  입주카페후기:   { theme: 'cafe',  icon: 'chat',     tag: '입주카페 후기',   headline: '신세계 {1만원}\n상품권 증정', sub: '입주 카페 상담 후기 시' },
  SNS블로그후기:  { theme: 'naver', icon: 'calendar', tag: 'SNS·블로그 후기', headline: '{후기 작성}\n선물 증정',     sub: 'SNS/블로그 후기 작성 시' },
  단톡방후기:     { theme: 'cafe',  icon: 'chat',     tag: '입주 단톡방 후기', headline: '{단톡방}\n후기 이벤트',     sub: '입주민 단톡방 후기 시' },
};

// 후기 우선순위 — 네이버/카페를 우선해 2x1 그리드 채움
const REVIEW_PRIORITY = ['네이버예약후기', '입주카페후기', 'SNS블로그후기', '단톡방후기'];
function buildReviewCards(reviewNames) {
  const set = new Set(reviewNames);
  const ordered = REVIEW_PRIORITY.filter((n) => set.has(n));
  for (const n of reviewNames) if (!ordered.includes(n)) ordered.push(n);
  return ordered
    .map((name) => (REVIEW_CARD_PRESETS[name] ? { name, ...REVIEW_CARD_PRESETS[name] } : null))
    .filter(Boolean)
    .slice(0, 2);   // 2x1 그리드
}

// 제품 프로모션 키워드 → 제품 이미지 카드 프리셋 (케이스 C — 디에이치)
// imageSrc 는 assets/products 의 실제 크롤링 이미지(URL 인코딩). 조건/포인트는 PDF마다 달라 기본값(폼 보정).
const PRODUCT_CARD_PRESETS = {
  옷장단독: { name: '키큰 옷장',     condition: '지정 옷장 구매 시', amount: '100,000', imageSrc: '/assets/products/%EC%BB%AC%EB%A0%89%ED%8A%B8/04_481x481_tab1.jpg' },
  모션:     { name: '리빙 모션베드', condition: '구매 시',           amount: '100,000', imageSrc: '/assets/products/%EB%A6%AC%EB%B9%99_%EB%AA%A8%EC%85%98%EB%B2%A0%EB%93%9C/01_1024x669_tab1.png' },
};

// 2x2 그리드(케이스 B)로 보내는 추상형 프로모션 — 단독 제품 이미지가 없는 것들
const ABSTRACT_PROMOS = new Set(['한정프로모션', '단톡방공동구매', '세트구매']);

const PRODUCT_PRIORITY = ['옷장단독', '모션'];
function buildProductCards(promoNames) {
  const set = new Set(promoNames);
  return PRODUCT_PRIORITY
    .filter((n) => set.has(n) && PRODUCT_CARD_PRESETS[n])
    .map((n) => ({ name: n, ...PRODUCT_CARD_PRESETS[n] }))
    .slice(0, 3);
}

// 6컬럼(잠실형) 셀 표기 정리 — 값 셀은 "10만원" → "10만"(폭 절약), 금액 셀은 "200만원" → "200만원~"
function formatSixColCells(table) {
  if (!table?.rows?.length) return table;
  const isSix = (table.columns || []).length === 6;
  if (!isSix) return table;
  table.rows = table.rows.map((row) => {
    const out = {};
    for (const col of table.columns) {
      let v = row[col.key] ?? '';
      if (col.key === 'amount') {
        v = String(v).replace(/~?$/, '~').replace(/~+$/, '~');   // 끝에 ~ 하나
      } else if (col.key !== 'total' || /\d/.test(String(v))) {
        v = String(v).replace(/만원/g, '만');                    // "10만원" → "10만"
      }
      out[col.key] = v;
    }
    return out;
  });
  return table;
}

// 혜택표 마지막 행의 total 값에서 "최대 N만원" 자동 산출
function pickMaxAmount(table) {
  if (!table?.rows?.length) return null;
  const lastTotal = table.rows[table.rows.length - 1]?.total;
  if (!lastTotal) return null;
  // "100만원" 또는 "109만원" 같은 형태 그대로 반환
  return lastTotal;
}

// 박람회 일수
function dayCount(period) {
  if (!period?.start || !period?.end) return 0;
  const a = new Date(period.start), b = new Date(period.end);
  return Math.round((b - a) / 86400000) + 1;
}

export function pdfDataToAppState({ basic, benefit, promotions, notices, payment } = {}) {
  const { fields = {}, meta = {} } = basic || {};
  const state = deepCopy(DEFAULT_STATE);

  // ── 기본 정보 ──
  if (fields.aptName) state.aptName = fields.aptName;
  if (fields.period?.start && fields.period?.end) {
    state.period = { start: fields.period.start, end: fields.period.end };
  }
  if (Array.isArray(fields.stores) && fields.stores.length) {
    // 매장 2개 이상이면 "프리미엄샵" 접두어 제거(지점명만) — 줄바꿈 방지 + 중복 축약
    // 예: 잠실 "프리미엄샵 송파/강동아이파크" → "일룸 송파"/"일룸 강동아이파크" (단일 매장은 풀네임 유지)
    const multi = fields.stores.length >= 2;
    state.stores = fields.stores.map((s) => {
      let n = s.name || s;
      if (multi) n = n.replace(/^프리미엄샵\s+/, '');
      return `일룸 ${n}`;
    });
  }

  // 다중 아파트(잠실형) — basic-info 가 풀 아파트명 + 아파트별 기간(periodDetail)을 채움
  if (Array.isArray(fields.periodDetail) && fields.periodDetail.length) {
    state.periodDetail = fields.periodDetail;
  }

  // ── 혜택표 ──
  if (benefit?.ok && benefit.table?.rows?.length) {
    state.benefitTable = benefit.table;
  }

  // ── 최대 혜택 금액 자동 계산 (혜택표 마지막 행 total) ──
  const maxAmount = pickMaxAmount(state.benefitTable);
  if (maxAmount) state.maxBenefit.amount = maxAmount;

  // ── 특별 프로모션 / 제품 카드 / 후기 이벤트 카드 ──
  const promoNames   = promotions?.specialPromos?.map((p) => p.name) || [];
  const promoCards   = buildPromoCards(promoNames);
  // 제품 카드 — PDF에서 직접 추출한 제품 프로모션 우선(이름/조건/포인트 정확), 없으면 키워드 프리셋
  const productCards = (promotions?.productPromos?.length)
    ? promotions.productPromos.slice(0, 3)
    : buildProductCards(promoNames);
  const reviewNames  = promotions?.reviews?.map((p) => p.name) || [];
  const reviewCards  = buildReviewCards(reviewNames);

  // ── 케이스 자동 분류 (우선순위) ──
  // D: 잠실형 — 네이버/입주카페 후기 강신호 + 후기 카드 2장 + 잠실 시그니처(6컬럼표 또는 2아파트)
  //    (수원성중흥처럼 단일 아파트·4컬럼인데 후기 언급만 있는 경우는 D 아님)
  // C: 제품 이미지 카드 — 단독 제품 프로모션(옷장/모션) + 추상형(한정/단톡방/세트) 없음 + 3종 이하
  // B: 특별 프로모션 3종 이상 (2x2 그리드)
  const strongReview  = reviewNames.includes('네이버예약후기') || reviewNames.includes('입주카페후기');
  const hasAbstract   = promoNames.some((n) => ABSTRACT_PROMOS.has(n));
  const isProductCase = productCards.length >= 1 && !hasAbstract && promoNames.length <= 3;
  const sixCol        = (state.benefitTable?.columns?.length || 0) >= 6;
  const multiApt      = Array.isArray(basic?.fields?.periodDetail) && basic.fields.periodDetail.length >= 2;
  // E: 창원형 — 단지별 타깃이 다른 박람회 2회. 제품카드보다 우선(창원도 옷장 카드가 있어 C로 빠짐 방지)
  const fairs         = Array.isArray(basic?.fields?.fairs) ? basic.fields.fairs : [];

  let caseId = 'case-a';
  if (strongReview && reviewCards.length >= 2 && (sixCol || multiApt)) caseId = 'case-d';
  else if (fairs.length >= 2) caseId = 'case-e';
  else if (isProductCase) caseId = 'case-c';
  else if (promoCards.length >= 3) caseId = 'case-b';
  state._caseId = caseId;

  // ── 카피 자동 추천 ──
  if (caseId === 'case-c') {
    // 제품 카드 + 컴팩트 결제 + 기간강조 톤
    const days = dayCount(state.period);
    state.productSection = { cards: productCards };
    state.maxBenefit.before       = `${state.aptName} 입주민을 위한`;
    state.maxBenefit.mainTemplate = days >= 1
      ? `${days}일간 최대 {amount} 특별 혜택`
      : '최대 {amount} 특별 혜택';
    state.maxBenefit.after        = '지금 매장에서 만나보세요!';
    state.payment.title = '3가지 포인트 中 택 1 적립';
    state.payment.subtitle = '';
  } else if (caseId === 'case-d') {
    // 축하형 — 6컬럼 표기 정리 + 후기 섹션 + 최대혜택 금액 강조
    formatSixColCells(state.benefitTable);
    const maxMan = String(state.maxBenefit.amount).replace(/만원/, '만원');
    state.celebration = {
      before: '입주를 진심으로',
      main:   '{축하}드립니다',
      after:  `최대 {${maxMan}} 특별 혜택`,
    };
    state.reviewSection = {
      title: '입주민 후기 이벤트 — 나눌수록 커지는 혜택',
      cards: reviewCards,
    };
    // 결제 안내 — 케이스 D 는 컴팩트(설명 없는 라벨+로고) + 간결 타이틀
    state.payment.title = '3가지 포인트 中 택 1 적립';
    state.payment.subtitle = '';
  } else if (caseId === 'case-e') {
    // 박람회 2회 단지별 카드 + 제품 1종(옷장) + 컴팩트 결제
    state.fairsSection = {
      title: `입주박람회 ${fairs.length}회 — 단지별 안내`,
      cards: fairs.map((f) => ({ tag: f.tag, dates: f.dates, target: f.target, sub: f.sub })),
    };
    if (productCards.length) state.productSection = { cards: productCards.slice(0, 1) };
    state.maxBenefit.before       = `${state.aptName} 입주민을 위한`;
    state.maxBenefit.mainTemplate = '최대 {amount} 특별 혜택';
    state.maxBenefit.after        = '지금 매장에서 만나보세요!';
    state.payment.title = '3가지 포인트 中 택 1 적립';
    state.payment.subtitle = '';
  } else if (basic?.fields?.noFair) {
    // 박람회 미참여(매장 단독 프로모션) — "박람회 현장에서만" 문구 금지
    // "매장 단독"은 메인 타이틀이 담당(autoMainTitle) → 헤드라인 중복 제거
    state.maxBenefit.before       = `${state.aptName} 입주민을 위한`;
    state.maxBenefit.mainTemplate = '최대 {amount} 특별 혜택';
    state.maxBenefit.after        = '지금 매장에서 만나보세요!';
  } else {
    const days = dayCount(state.period);
    if (days >= 3) {
      state.maxBenefit.mainTemplate = '단 {days}일간!'.replace('{days}', days);
      state.maxBenefit.before = `${state.aptName} 입주 특별`;
      state.maxBenefit.after  = `최대 ${state.maxBenefit.amount} 혜택`;
    } else {
      state.maxBenefit.before       = '입주박람회 현장에서만 드리는';
      state.maxBenefit.mainTemplate = '최대 {amount} 특별 혜택';
      state.maxBenefit.after        = '지금 바로 만나 보세요!';
    }
  }

  // ── 카피 자동 추천 (톤 + 메인 타이틀) ── 카피_뱅크 _자동_추천_규칙
  // 톤은 라벨로 노출(폼에서 수동 변경 대비), 메인 타이틀은 박람회 미참여 시 "매장 단독 특별 혜택"
  const copyTone = pickTone({
    caseId,
    noFair:   !!basic?.fields?.noFair,
    fairDays: dayCount(state.period),
    multiApt,
  });
  state._copyTone = copyTone;
  state.mainTitle = autoMainTitle({ noFair: !!basic?.fields?.noFair });

  // ── 결제 안내 표시/숨김 ── (사용자 규칙: 포인트 브랜드 언급 있으면 기본 3카드, 전혀 없으면 숨김)
  // payment 미전달(구 호출부)이면 기본 3카드 유지 — 하위호환
  if (payment && payment.ok === false) {
    state.payment = null;
  }

  // ── 유의사항 — PDF에서 추출된 게 있으면 그걸 우선 사용, 없으면 기본 6줄 ──
  if (notices?.ok && notices.notices?.length >= 2) {
    // 추출된 내용 (최대 5줄) + 매장명 마지막 줄
    state.notices = notices.notices.slice(0, 5);
  }
  // 마지막 줄은 매장명 반영 (추출/기본 둘 다 적용)
  const lastNotice = state.stores.length
    ? `추후 품목 변경은 ${state.stores.join(', ')}에서만 가능합니다.`
    : '추후 품목 변경은 매장에서만 가능합니다.';
  if (notices?.ok) {
    state.notices.push(lastNotice);
  } else {
    state.notices[state.notices.length - 1] = lastNotice;
  }

  // ── 특별 프로모션 카드 (케이스 B 2x2 그리드만) ── (분류는 위에서 결정됨)
  if (caseId === 'case-b' && promoCards.length) {
    state.specialPromoSection = {
      title: `특별 프로모션 ${promoCards.length}종`,
      cards: promoCards,
    };
  }

  // ── 신뢰도 메타데이터 ──
  state._extraction = {
    source: null,
    extractedAt: new Date().toISOString(),
    fields: {
      ...Object.fromEntries(
        Object.entries(meta).map(([k, m]) => [k, {
          confidence: m.confidence,
          raw: m.raw,
          label: m.label,
        }])
      ),
      benefitTable: {
        confidence: benefit?.confidence || 'missing',
        rows: benefit?.table?.rows?.length || 0,
        columns: benefit?.detectedColumnCount || 0,
      },
      notices: {
        confidence: notices?.confidence || 'missing',
        count: notices?.notices?.length || 0,
      },
      // 프로모션/제품/후기/박람회 카드 — 조건·포인트가 프리셋 기본값이라 확인 권장(신뢰도 표시 확대용)
      promotions: {
        confidence: promotions?.confidence || 'missing',
        raw: [
          ...(promotions?.specialPromos || []).map((p) => p.name),
          ...(promotions?.reviews || []).map((p) => p.name),
          ...(promotions?.productPromos || []).map((p) => p.name),
        ].filter(Boolean).join(', ') || null,
      },
      // 결제 안내 — 포인트 브랜드가 PDF에 언급됐는지(표시) / 전혀 없는지(숨김)
      payment: {
        confidence: payment ? payment.confidence : 'missing',
        raw: payment?.raw || null,
      },
    },
    specialPromotions: promotions?.specialPromos?.map((p) => p.name) || [],
    reviewEvents:      promotions?.reviews?.map((p) => p.name)        || [],
    hasDantokbang:     !!promotions?.hasDantokbang,
  };

  return state;
}
