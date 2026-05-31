// 결제 안내 (card_1 모드) — 3카드 그리드
// cards: [{ label, logoSrc, desc, theme }]
// theme: 'npay' | 'lpoint' | 'ssgpay' → '{theme}-card' 클래스로 컬러 결정
// desc 내 '\n' 은 <br /> 로 변환
// variant: 'full'(기본, 설명+화살표) | 'compact'(라벨+로고만 — 케이스 D)

import { escHtml, escAttr } from '../utils/esc.js';

const ARROW_SVG = `<svg viewBox="0 0 24 24"><polyline points="12 5 12 19"></polyline><polyline points="5 12 12 19 19 12"></polyline></svg>`;

function PointCard({ label = '', logoSrc = '', desc = '', theme = '' } = {}, variant = 'full') {
  const compact = variant === 'compact';
  const descHtml = compact ? '' : String(desc).split('\n').map(escHtml).join('<br />');
  return `
    <div class="point-card ${escAttr(theme)}-card${compact ? ' compact' : ''}">
      <div class="card-label">${escHtml(label)}</div>
      <div class="card-logo">
        <img src="${escAttr(logoSrc)}" alt="${escAttr(label)}" />
      </div>
      ${compact ? '' : `<div class="card-desc">${descHtml}</div>`}
      ${compact ? '' : `<div class="card-arrow">${ARROW_SVG}</div>`}
    </div>
  `;
}

export function PaymentCards(input = {}) {
  const { title = '', subtitle = '', cards = [], variant = 'full' } = input || {};
  if (!Array.isArray(cards) || !cards.length) return '';   // 결제 포인트 없음 → 영역 숨김
  const cardsHtml = cards.map((c) => PointCard(c, variant)).join('');
  return `
    <div class="payment">
      <div class="payment-title">${escHtml(title)}</div>
      ${subtitle ? `<div class="payment-subtitle">${escHtml(subtitle)}</div>` : ''}
      <div class="payment-brands">${cardsHtml}</div>
    </div>
  `;
}
