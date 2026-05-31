// 매장명 박스 — 위아래 1.5px 라인 안에 매장 1~3개 줄바꿈으로 연결

import { escHtml } from '../utils/esc.js';

export function StoreBox({ stores = [] } = {}) {
  const list = (Array.isArray(stores) ? stores : [stores]).filter(Boolean);
  if (!list.length) return '';   // 매장 미입력 시 빈 테두리 박스 대신 아무것도 안 그림
  const lines = list.map(escHtml).join('<br />');

  return `
    <div class="store-box">
      <div class="store-name">${lines}</div>
    </div>
  `;
}
