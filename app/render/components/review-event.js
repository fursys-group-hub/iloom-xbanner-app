// 후기 이벤트 2카드 (케이스 D — 잠실) — 시제품 v11 패턴
// cards: [{ theme, tag, headline, sub, icon }]  (headline 내 {강조} 토큰 → <strong>)
// theme: 'naver'(그린) | 'cafe'(블루) → 'review-{theme}' 클래스로 컬러 결정

import { escHtml } from '../utils/esc.js';

// 후기 카드 아이콘 (캘린더=예약후기 / 말풍선=카페후기)
const ICONS = {
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>`,
  chat:     `<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`,
};

function iconSvg(key) {
  const path = ICONS[key] || ICONS.chat;
  return `<svg viewBox="0 0 24 24">${path}</svg>`;
}

// headline 내 {강조} 토큰 → <strong>강조</strong>, 줄바꿈 → <br />
function renderHeadline(headline) {
  return String(headline ?? '')
    .split('\n')
    .map((line) =>
      line.replace(/\{([^}]+)\}/g, (_, inner) => `<strong>${escHtml(inner)}</strong>`)
          .split(/(<strong>.*?<\/strong>)/)
          .map((seg) => (seg.startsWith('<strong>') ? seg : escHtml(seg)))
          .join('')
    )
    .join('<br />');
}

function ReviewCard({ theme = 'naver', tag = '', headline = '', sub = '', icon = 'chat' } = {}) {
  const subHtml = String(sub ?? '').split('\n').map(escHtml).join('<br />');
  return `
    <div class="review-card review-${escHtml(theme)}">
      <div class="review-icon">${iconSvg(icon)}</div>
      <div class="review-tag">${escHtml(tag)}</div>
      <div class="review-headline">${renderHeadline(headline)}</div>
      <div class="review-sub">${subHtml}</div>
    </div>
  `;
}

export function ReviewEvent({ title = '', cards = [] } = {}) {
  if (!cards.length) return '';
  const shown = cards.slice(0, 2);   // 2x1 그리드
  return `
    <div class="review-event-wrapper">
      <div class="review-event-title">${escHtml(title)}</div>
      <div class="review-cards-grid">
        ${shown.map(ReviewCard).join('')}
      </div>
    </div>
  `;
}
