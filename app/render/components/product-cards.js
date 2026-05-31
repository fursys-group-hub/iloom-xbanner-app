// 제품 이미지 카드 (케이스 C — 디에이치 방배) — 시제품 v10 + 제품카드 디자인 표준
// cards: [{ imageSrc, name, condition, amount }]
//   amount: 포인트 숫자 문자열 ("100,000") → "+100,000 Point" 코랄 배지로 렌더
// 좌측 이미지(180px 베이지 박스, object-fit:cover, mix-blend-mode 금지) + 우측 카피 3단

import { escHtml, escAttr } from '../utils/esc.js';

// "100,000" / "100000" / "+100,000 Point" 어떤 형태든 숫자만 뽑아 콤마 표기로
function formatPoint(amount) {
  const digits = String(amount ?? '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
}

function ProductCard({ imageSrc = '', name = '', condition = '', amount = '' } = {}) {
  const point = formatPoint(amount);
  const badge = point
    ? `<div class="product-card-amount"><strong>+${escHtml(point)}</strong> Point</div>`
    : '';
  const cond = condition ? `<div class="product-card-condition">${escHtml(condition)}</div>` : '';
  return `
    <div class="product-card">
      <div class="product-card-image">
        <img src="${escAttr(imageSrc)}" alt="${escAttr(name)}" />
      </div>
      <div class="product-card-content">
        <div class="product-card-name">${escHtml(name)}</div>
        ${cond}
        ${badge}
      </div>
    </div>
  `;
}

export function ProductCards({ cards = [] } = {}) {
  if (!cards.length) return '';
  return cards.map(ProductCard).join('');
}
