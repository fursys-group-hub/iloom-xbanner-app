// 박람회 2회 안내 카드 (케이스 E — 창원 롯데캐슬) — 시제품 v12 패턴
// 단지별 타깃이 다른 박람회 2회를 1차/2차 2카드 그리드로 표시.
// cards: [{ tag, dates, target, sub }]
//   dates: "2026.01.17.\n~ 01.18." 처럼 \n 으로 줄바꿈 → <br>
//   1번째 카드 fair-1(코랄), 2번째 fair-2(블루) 테마 고정

import { escHtml } from '../utils/esc.js';

const CALENDAR_ICON =
  `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>` +
  `<line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>` +
  `<line x1="3" y1="10" x2="21" y2="10"/></svg>`;

function brLines(text) {
  return String(text ?? '').split('\n').map(escHtml).join('<br />');
}

function FairCard(card = {}, idx = 0) {
  const cls = idx === 0 ? 'fair-1' : 'fair-2';
  const target = card.target ? `<div class="fair-target">${escHtml(card.target)}</div>` : '';
  const sub = card.sub ? `<div class="fair-sub">${escHtml(card.sub)}</div>` : '';
  return `
        <div class="fair-card ${cls}">
          <div class="fair-icon">${CALENDAR_ICON}</div>
          <div class="fair-tag">${escHtml(card.tag ?? '')}</div>
          <div class="fair-dates">${brLines(card.dates)}</div>
          ${target}
          ${sub}
        </div>`;
}

export function Fairs({ title = '', cards = [] } = {}) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!list.length) return '';
  const shown = list.slice(0, 2);
  return `
    <div class="fairs-wrapper">
      <div class="fairs-title">${escHtml(title)}</div>
      <div class="fairs-grid">${shown.map((c, i) => FairCard(c, i)).join('')}
      </div>
    </div>
  `;
}
