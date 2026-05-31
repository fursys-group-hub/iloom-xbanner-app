// 헤더 영역 — Welcome / 아파트명 / 메인타이틀 / 박람회 기간
// periodDetail (옵션): 아파트별 개별 기간 보조 라인 (케이스 D — 잠실 2아파트)
//   [{ label: '잠실래미안', range: '11.22~23' }, ...] → "잠실래미안 11.22~23 · 잠실르엘 11.28~30"
//   label 은 코랄 강조(.label), 케이스 D 외에는 periodDetail 없으면 라인 자체를 안 그림

import { escHtml } from '../utils/esc.js';
import { formatPeriod } from '../utils/format.js';

function PeriodDetail(detail) {
  const list = Array.isArray(detail) ? detail.filter(Boolean) : [];
  if (!list.length) return '';
  const parts = list
    .map((d) => `<span class="label">${escHtml(d.label ?? '')}</span> ${escHtml(d.range ?? '')}`)
    .join(' · ');
  return `<div class="period-detail">${parts}</div>`;
}

export function Header({ welcome, aptName, mainTitle, period, periodDetail } = {}) {
  return `
    <div class="welcome">${escHtml(welcome ?? 'WELCOME HOME')}</div>
    <div class="apt-name">${escHtml(aptName ?? '')}</div>
    <div class="main-title">${escHtml(mainTitle ?? '')}</div>
    <div class="period">${escHtml(formatPeriod(period))}</div>
    ${PeriodDetail(periodDetail)}
  `;
}
