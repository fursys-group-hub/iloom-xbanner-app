// 특별 프로모션 2x2 그리드 (케이스 B) — NAVER 광고 스타일
// cards: [{ theme, tag, headline, sub, icon }]  (headline 내 {강조} 토큰 → <strong>)
// theme 미지정 시 카드 순서대로 coral/camel/green/blue 순환

import { escHtml } from '../utils/esc.js';

const THEMES = ['coral', 'camel', 'green', 'blue'];

// 아이콘 SVG (시제품 v9 + 추가). 키 → path
const ICONS = {
  tag:    `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/>`,
  sofa:   `<path d="M3 12v-1a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1"/><path d="M3 12h18v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/><line x1="6" y1="19" x2="6" y2="22"/><line x1="18" y1="19" x2="18" y2="22"/>`,
  book:   `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/>`,
  chat:   `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`,
  closet: `<rect x="4" y="2" width="16" height="20" rx="1"/><line x1="12" y1="2" x2="12" y2="22"/><circle cx="10" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r="0.8" fill="currentColor" stroke="none"/>`,
  box:    `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22" x2="12" y2="12"/>`,
  bed:    `<path d="M2 9v11"/><path d="M2 13h20"/><path d="M22 20v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2"/><path d="M6 11V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>`,
};

function iconSvg(key) {
  const path = ICONS[key] || ICONS.tag;
  return `<svg viewBox="0 0 24 24">${path}</svg>`;
}

// headline 내 {강조} 토큰 → <strong>강조</strong>. rowMode 면 줄바꿈 없이 공백으로 이음
function renderHeadline(headline, rowMode = false) {
  return String(headline ?? '')
    .split('\n')
    .map((line) =>
      line.replace(/\{([^}]+)\}/g, (_, inner) => `<strong>${escHtml(inner)}</strong>`)
          .split(/(<strong>.*?<\/strong>)/)
          .map((seg) => seg.startsWith('<strong>') ? seg : escHtml(seg))
          .join('')
    )
    .join(rowMode ? ' ' : '<br />');
}

function PromoCard(card, idx, rowMode = false) {
  const theme = card.theme || THEMES[idx % THEMES.length];
  const sub = String(card.sub ?? '').split('\n').map(escHtml).join('<br />');
  return `
    <div class="promo-card theme-${escHtml(theme)}">
      <div class="promo-icon">${iconSvg(card.icon)}</div>
      <div class="promo-tag">${escHtml(card.tag ?? '')}</div>
      <div class="promo-headline">${renderHeadline(card.headline, rowMode)}</div>
      <div class="promo-sub">${sub}</div>
    </div>
  `;
}

export function SpecialPromoGrid({ title = '', cards = [], layout = 'card' } = {}) {
  if (!cards.length) return '';
  // 카드형 2x2(최대 4종) / 행형 전체 폭 가로줄로 위→아래
  const shown = cards.slice(0, 4);
  const rowMode = layout === 'row';
  const gridCls = rowMode ? 'promo-grid promo-grid--rows' : 'promo-grid';
  return `
    <div class="promo-wrapper">
      <div class="promo-title">${escHtml(title)}</div>
      <div class="${gridCls}">
        ${shown.map((c, i) => PromoCard(c, i, rowMode)).join('')}
      </div>
    </div>
  `;
}
