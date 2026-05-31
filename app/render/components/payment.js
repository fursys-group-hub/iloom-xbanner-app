// 결제 안내 통합 렌더 — 표시 방식 3종을 한 곳에서 분기
//   card_1 : 풀 카드 (라벨 + 로고 + 설명 + 화살표)   ← 여백 넉넉할 때
//   card_2 : 작은 카드 (라벨 + 로고만)                ← 중간
//   compact: 로고만 (가로 1줄)                        ← 콘텐츠 많을 때 / 여백의 미
// 모드 결정: data._payMode(사용자 선택) 우선, 없으면 케이스 기본값(defaultMode).
// 케이스 고정이 아니라 사용자가 편집 UI에서 바꿀 수 있게 하기 위한 단일 진입점.

import { PaymentCards }   from './payment-cards.js';
import { PaymentCompact } from './payment-compact.js';

export function renderPayment(data = {}, defaultMode = 'card_1') {
  const p = data.payment;
  if (!p || !Array.isArray(p.cards) || !p.cards.length) return '';   // 포인트 없음 → 영역 숨김
  const mode = data._payMode || defaultMode;

  if (mode === 'compact') {
    const brands = p.cards.map((c) => ({ logoSrc: c.logoSrc, label: c.label }));
    return PaymentCompact({ title: p.title || '3가지 포인트 中 택 1 적립', brands });
  }
  if (mode === 'card_2') {
    return PaymentCards({ ...p, variant: 'compact' });
  }
  return PaymentCards({ ...p, variant: 'full' });
}
