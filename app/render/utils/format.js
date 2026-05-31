// 표시용 포맷 함수 — ISO 날짜를 X배너 표기로 변환 등

// "2026-03-07" → "2026.03.07."
export function formatDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[1]}.${m[2]}.${m[3]}.`;
}

// { start, end } → "2026.03.07. ~ 2026.03.08."
export function formatPeriod(period) {
  if (!period) return '';
  const s = formatDate(period.start);
  const e = formatDate(period.end);
  if (s && e) return `${s} ~ ${e}`;
  return s || e;
}
