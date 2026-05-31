// 푸터 영역 — iloom 로고

import { escAttr } from '../utils/esc.js';

export function Footer({ logoSrc } = {}) {
  const src = logoSrc || '/assets/products/iloom-logo.png';
  return `
    <div class="footer">
      <img src="${escAttr(src)}" alt="iloom" />
    </div>
  `;
}
