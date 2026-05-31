// 유의사항 — 각 줄 앞에 "· " 가운뎃점 prefix
// 빈 문자열 / null 은 자동 제외

import { escHtml } from '../utils/esc.js';

export function Notices(items = []) {
  const arr = Array.isArray(items) ? items : [items];
  const lines = arr
    .filter((s) => s != null && String(s).trim() !== '')
    .map((s) => `<p>· ${escHtml(s)}</p>`)
    .join('\n        ');

  return `
    <div class="notices">
        ${lines}
    </div>
  `;
}
