// 혜택표 — 동적 컬럼 (4/5/6컬럼 모두 가능)
// columns: [{ key, label, style }] / rows: [{ [key]: value }]
// style: 'amount' | 'total' | 'normal' | 'dash'  → td 클래스
// label 내 '\n' 은 <br /> 로 변환

import { escHtml } from '../utils/esc.js';

function withLineBreaks(text) {
  return String(text ?? '')
    .split('\n')
    .map(escHtml)
    .join('<br />');
}

function resolveCellClass(columnStyle, value) {
  if (columnStyle === 'amount' || columnStyle === 'total') return columnStyle;
  if (value === '—' || value === '-') return 'dash';
  return '';
}

export function BenefitTable({ title = '', columns = [], rows = [] } = {}) {
  const thead = columns
    .map((c) => `<th>${withLineBreaks(c.label)}</th>`)
    .join('');

  const tbody = rows
    .map((row) => {
      const tds = columns
        .map((c) => {
          const v   = row?.[c.key] ?? '';
          const cls = resolveCellClass(c.style, v);
          return `<td${cls ? ` class="${cls}"` : ''}>${escHtml(v)}</td>`;
        })
        .join('');
      return `<tr>${tds}</tr>`;
    })
    .join('');

  return `
    <div class="table-wrapper">
      <div class="table-title">${escHtml(title)}</div>
      <table class="benefit-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  `;
}
