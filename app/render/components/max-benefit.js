// 최대 혜택 강조 — 3줄 구조 (보조 / 메인 / 보조)
// mainTemplate 의 {amount} 토큰을 <strong> 으로 감싸 코랄 강조
// before / after 도 {강조} 토큰 지원 (도안 v14 "단 {3일간!} ...")

import { escHtml } from '../utils/esc.js';

function emphasize(text) {
  return String(text ?? '')
    .replace(/\{([^}]+)\}/g, (_, inner) => `<strong>${escHtml(inner)}</strong>`)
    .split(/(<strong>.*?<\/strong>)/)
    .map((seg) => (seg.startsWith('<strong>') ? seg : escHtml(seg)))
    .join('');
}

export function MaxBenefit({
  before = '',
  amount = '',
  mainTemplate = '최대 {amount} 특별 혜택',
  after = '',
} = {}) {
  const main = mainTemplate
    .split('{amount}')
    .map(escHtml)
    .join(`<strong>${escHtml(amount)}</strong>`);

  return `
    <div class="max-benefit">
      <div class="max-benefit-before">${emphasize(before)}</div>
      <div class="max-benefit-main">${main}</div>
      <div class="max-benefit-after">${emphasize(after)}</div>
    </div>
  `;
}
