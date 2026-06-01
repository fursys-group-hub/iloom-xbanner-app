// 매장명 박스 — 위아래 1.5px 라인 안에 매장 1~3개 줄바꿈으로 연결

import { escHtml } from '../utils/esc.js';

export function StoreBox({ stores = [], _draft = false } = {}) {
  const list = (Array.isArray(stores) ? stores : [stores]).filter(Boolean);
  if (!list.length) {
    // 미리보기(_draft)에선 "여기 채워야 함" 안내 박스를 코랄 점선으로 표시 → 클릭해 입력.
    // 출력(인쇄/PNG)에선 _draft 가 없어 빈 칸 — 안내 문구가 배너에 찍히지 않음.
    if (!_draft) return '';
    return `
    <div class="store-box store-box--ph">
      <div class="store-name ph-fill">매장명을 입력하세요</div>
    </div>
  `;
  }
  const lines = list.map(escHtml).join('<br />');

  return `
    <div class="store-box">
      <div class="store-name">${lines}</div>
    </div>
  `;
}
