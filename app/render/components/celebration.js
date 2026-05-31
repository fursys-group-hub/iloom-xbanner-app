// 축하형 메시지 (케이스 D — 잠실) — 시제품 v11 패턴
// MaxBenefit 의 "최대 N만원" 강조형 대신 입주 축하 톤.
// before / main / after 3줄, 각 줄의 {강조} 토큰을 <strong>(코랄) 으로 감싼다.

import { escHtml } from '../utils/esc.js';

function emphasize(text) {
  return String(text ?? '')
    .replace(/\{([^}]+)\}/g, (_, inner) => `<strong>${escHtml(inner)}</strong>`)
    .split(/(<strong>.*?<\/strong>)/)
    .map((seg) => (seg.startsWith('<strong>') ? seg : escHtml(seg)))
    .join('');
}

export function Celebration({ before = '', main = '', after = '' } = {}) {
  return `
    <div class="celebration">
      <div class="celebration-before">${emphasize(before)}</div>
      <div class="celebration-main">${emphasize(main)}</div>
      <div class="celebration-after">${emphasize(after)}</div>
    </div>
  `;
}
