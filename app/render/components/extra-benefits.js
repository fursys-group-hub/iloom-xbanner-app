// 추가 혜택 카드 (케이스 G — 도안 우미린 트리쉐이드) — 시제품 v14 패턴
// 제품 카드 패턴 재사용 + 섹션 헤더 + 공동구매 세대수 칩 변형.
// cards: [{ imageSrc, name, condition, badge, units }]
//   condition / badge 의 {강조} 토큰 → <strong>(코랄)
//   badge: "네이버 포인트 {5만원} 증정" 형태 (자유 문구)
//   units: [20, 40, 80, 100] 있으면 badge 대신 세대수 칩 렌더 (공동구매 카드)

import { escHtml, escAttr } from '../utils/esc.js';

function emphasize(text) {
  return String(text ?? '')
    .replace(/\{([^}]+)\}/g, (_, inner) => `<strong>${escHtml(inner)}</strong>`)
    .split(/(<strong>.*?<\/strong>)/)
    .map((seg) => (seg.startsWith('<strong>') ? seg : escHtml(seg)))
    .join('');
}

function UnitChips(units) {
  const chips = units
    .map((u) => `<div class="unit-chip">${escHtml(String(u))}<span>세대</span></div>`)
    .join('');
  return `<div class="product-card-units">${chips}</div>`;
}

function ExtraCard({ imageSrc = '', name = '', condition = '', badge = '', units } = {}) {
  const img = imageSrc
    ? `<div class="product-card-image"><img src="${escAttr(imageSrc)}" alt="${escAttr(name)}" /></div>`
    : '';
  const cond = condition ? `<div class="product-card-condition">${emphasize(condition)}</div>` : '';
  let foot = '';
  if (Array.isArray(units) && units.length) foot = UnitChips(units);
  else if (badge) foot = `<div class="product-card-amount">${emphasize(badge)}</div>`;
  return `
    <div class="product-card">
      ${img}
      <div class="product-card-content">
        <div class="product-card-name">${escHtml(name)}</div>
        ${cond}
        ${foot}
      </div>
    </div>`;
}

export function ExtraBenefits({ title = '', cards = [] } = {}) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!list.length) return '';
  return `
    <div class="extra-section-title">${escHtml(title)}</div>
    ${list.map(ExtraCard).join('')}
  `;
}
