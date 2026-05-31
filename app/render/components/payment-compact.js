// 결제 안내 컴팩트 (케이스 B) — 1줄 가로 로고
// brands: [{ logoSrc, label }]

import { escHtml, escAttr } from '../utils/esc.js';

export function PaymentCompact({ title = '', brands = [] } = {}) {
  if (!Array.isArray(brands) || !brands.length) return '';   // 결제 포인트 없음 → 영역 숨김
  const imgs = brands
    .map((b) => `<img src="${escAttr(b.logoSrc)}" alt="${escAttr(b.label ?? '')}" />`)
    .join('<span class="divider">|</span>');
  return `
    <div class="payment">
      <div class="payment-title">${escHtml(title)}</div>
      <div class="payment-brands-compact">${imgs}</div>
    </div>
  `;
}
