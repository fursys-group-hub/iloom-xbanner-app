// 혜택표 자동 추출 — 좌표 기반 컬럼 클러스터링
//
// 전략: 텍스트 줄(line)을 토큰 개수로 나누면, PDF 안에서 빈 셀(추가혜택 빈칸)이나
//       병합된 셀("2만원42만원", "- -12만원")이 있을 때 토큰 수가 행마다 달라져
//       일부 행이 통째로 누락된다(잠실 5행 중 3행만 잡히던 버그).
//       → 각 토큰의 x 좌표로 컬럼을 정한다.
//  1. "N00만원" 버킷 토큰들을 모아 가장 흔한 x = 금액 컬럼 위치로 확정
//  2. 그 x 근처에서 시작하는 행만 데이터 행으로 채택 (본문 잡문 "참가비 200만원" 배제)
//  3. 데이터 행 토큰들의 x 를 클러스터링 → 컬럼 중심들 확정 (4/5/6컬럼 자동)
//  4. 각 토큰을 가장 가까운 컬럼 중심에 배정 → 빈 셀은 자동으로 "—"
//  5. 한 셀로 쪼개진 토큰("12만"+"원")은 같은 컬럼에 모여 합쳐짐

import { flattenLines } from '../anchor-search.js';

// 표 컬럼 라벨 (style: 표 시제품 v8 의 thead 와 일치하도록)
const COLUMN_PRESETS = {
  4: [   // 4컬럼: 한화포레나형 (기존/추가/총)
    { key: 'amount', label: '구매 금액',     style: 'amount' },
    { key: 'base',   label: '기존 혜택\n(상시)', style: 'normal' },
    { key: 'extra',  label: '추가 혜택\n(박람회)', style: 'normal' },
    { key: 'total',  label: '총 혜택',        style: 'total'  },
  ],
  5: [   // 5컬럼: 광주데시앙형 (기존/현장계약/LG연계/총)
    { key: 'amount', label: '구매 금액',     style: 'amount' },
    { key: 'base',   label: '기존 혜택\n(상시)',  style: 'normal' },
    { key: 'onsite', label: '현장 계약\n혜택',    style: 'normal' },
    { key: 'lg',     label: 'LG 연계\n혜택',      style: 'normal' },
    { key: 'total',  label: '총 혜택',        style: 'total'  },
  ],
  6: [   // 6컬럼: 잠실형 (아파트특별/기존/LG연계/박람회현장/최대) — 시제품 v11 라벨
    { key: 'amount', label: '구매 금액', style: 'amount' },
    { key: 'base',   label: '아파트\n특별', style: 'normal' },
    { key: 'onsite', label: '기존\n혜택',   style: 'normal' },
    { key: 'lg',     label: 'LG\n연계',     style: 'normal' },
    { key: 'extra',  label: '박람회\n현장', style: 'normal' },
    { key: 'total',  label: '최대\n혜택',   style: 'total'  },
  ],
};

// 붙어있는 토큰 병합 — 같은 줄에서 오른쪽 끝과 다음 토큰 시작 간격이 maxGap 이하면 한 토큰으로.
// PDF 가 "700만원" 을 "700"+"만원" 으로 쪼개 놓는 경우(디에이치 700 행)를 복원한다.
// 셀 간격(약 60px+)보다 훨씬 작은 6px 만 병합하므로 옆 셀을 잘못 붙이지 않는다.
function mergeAdjacentItems(items, maxGap = 6) {
  const sorted = [...(items || [])]
    .filter((it) => (it.str || '').trim())
    .sort((a, b) => a.x - b.x);
  const out = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last) {
      const lastRight = last.x + (last.width || 0);
      if (it.x - lastRight <= maxGap) {
        last.str += it.str;
        last.width = Math.max(lastRight, it.x + (it.width || 0)) - last.x;
        continue;
      }
    }
    out.push({ ...it });
  }
  return out;
}

// 1차원 x 좌표 클러스터링 — 인접 값이 gap 이하면 같은 컬럼
function clusterX(xs, gap = 40) {
  const sorted = [...xs].sort((a, b) => a - b);
  const clusters = [];
  for (const x of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && x - last.max <= gap) {
      last.items.push(x);
      last.max = x;
    } else {
      clusters.push({ items: [x], max: x });
    }
  }
  return clusters.map((c) => ({
    center: Math.round(c.items.reduce((a, b) => a + b, 0) / c.items.length),
    count: c.items.length,
  }));
}

// 표 셀에 들어갈 수 있는 토큰만 인정 — 금액("200만원"), 분리된 "원"/숫자, dash.
// 표 안/아래에 섞인 각주 산문("추가혜택(박람회전용)의 경우", "본사:대리점=5:5", "부담", "※...")은
// 별도 컬럼으로 잘못 잡히므로 컬럼 계산·셀 배정 전에 제거한다.
function isValueToken(s) {
  const t = (s || '').trim();
  if (!t) return false;
  if (/^[-―—–]+$/.test(t)) return true;               // dash = 혜택 없음
  if (/^[\d,]+\s*만\s*원?~?$/.test(t)) return true;    // "200만원" / "12만" / "200만원~"
  if (/^원~?$/.test(t)) return true;                   // 분리된 "원"
  if (/^[\d,]+$/.test(t)) return true;                 // 분리된 숫자
  return false;
}

// 셀 토큰 합치기 정규화 — 빈 배열은 빈칸(null), dash 만 있으면 "—", 값이면 공백 제거
function normalizeCell(tokens) {
  const joined = tokens.join('').replace(/\s+/g, '');
  if (!joined) return null;                       // 토큰이 아예 없는 진짜 빈 셀
  if (/^[-―—–]+$/.test(joined)) return '—';       // dash = 명시적 "혜택 없음"
  return joined;
}

// 세로 병합 셀 전파 — 어떤 컬럼이 한 행에만 금액 값이 있고 나머지는 모두 진짜 빈칸이면
// (PDF 에서 셀이 세로로 합쳐져 가운데 행에만 값이 찍힌 경우) 그 값을 전 행에 채운다.
// 예: 잠실 "추가혜택" 이 모든 행 2만원인데 PDF 상 500만원 행에만 표시됨.
function propagateMergedColumns(rawCells, columns) {
  for (let c = 1; c < columns.length; c++) {       // amount(0) 제외
    if (columns[c].key === 'total') continue;      // 총 혜택은 행마다 다름 — 제외
    let valueRow = -1, valueCount = 0, emptyCount = 0;
    for (let r = 0; r < rawCells.length; r++) {
      const v = normalizeCell(rawCells[r][c]);
      if (v === null) emptyCount++;
      else if (/\d/.test(v)) { valueCount++; valueRow = r; }
    }
    // 정확히 한 행만 값 + 나머지 전부 진짜 빈칸 → 병합 셀로 간주, 전 행에 전파
    if (valueCount === 1 && emptyCount === rawCells.length - 1) {
      const fill = rawCells[valueRow][c];
      for (let r = 0; r < rawCells.length; r++) {
        if (normalizeCell(rawCells[r][c]) === null) rawCells[r][c] = [...fill];
      }
    }
  }
  return rawCells;
}

// "15만원" → 15, "—"/"-"/빈값 → 0
export function parseMan(v) {
  const m = String(v ?? '').match(/([\d,]+)\s*만원/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

// 총 혜택(total) 보정 — 나머지 금액 컬럼(amount/total 제외) 합산으로 채우거나 교정
//  (1) 비었거나 "-" 면 자동 합산 (PDF에 합계 미기재 시)
//  (2) 적혀 있어도 총혜택 ≥ 구매금액이면 명백한 오기 → 합산으로 교정
//      예: 익산 "1,000만원 80만원 20만원 1,000만원" (PDF 오기, 문서 내 "→100만원" 정정 주석 있음)
//      혜택은 구매금액을 넘을 수 없으므로 안전한 판정 (정상 행은 항상 총혜택 < 구매금액)
export function fillTotal(row, columns) {
  const totalCol = columns.find((c) => c.key === 'total');
  if (!totalCol) return row;
  const sum = columns
    .filter((c) => c.key !== 'amount' && c.key !== 'total')
    .reduce((acc, c) => acc + parseMan(row[c.key]), 0);
  const hasValue  = /\d/.test(String(row.total));
  const totalMan  = parseMan(row.total);
  const amountMan = parseMan(row.amount);
  const implausible = hasValue && amountMan > 0 && totalMan >= amountMan;
  if ((!hasValue || implausible) && sum > 0) {
    row.total = `${sum.toLocaleString()}만원`;
  }
  return row;
}

export async function extractBenefitTable(pdf) {
  // 붙어 쪼개진 토큰("700"+"만원")을 먼저 복원한 line 으로 작업
  const lines = flattenLines(pdf).map((line) => ({
    ...line,
    items: mergeAdjacentItems(line.items),
  }));

  // 표준 구매 금액 구간 — 이 값으로 시작하는 행만 신뢰
  const STD_BUCKETS = new Set([100, 200, 300, 500, 700, 1000, 1500, 2000, 3000]);

  // 1) 버킷("N00만원") 토큰을 좌표와 함께 수집
  const bucketHits = [];
  for (const line of lines) {
    for (const it of (line.items || [])) {
      const s = (it.str || '').trim();
      const m = s.match(/^([\d,]+)\s*만원~?$/);
      if (!m) continue;
      const num = parseInt(m[1].replace(/,/g, ''), 10);
      if (!STD_BUCKETS.has(num)) continue;
      bucketHits.push({ line, x: it.x, num });
    }
  }
  if (!bucketHits.length) {
    return { ok: false, reason: '구매 금액대 행을 찾지 못함', confidence: 'missing' };
  }

  // 2) 가장 흔한 x = 금액 컬럼 위치 (본문 잡문 "참가비 200만원" 은 x 가 달라 배제됨)
  const amountX = clusterX(bucketHits.map((h) => h.x), 25)
    .sort((a, b) => b.count - a.count)[0].center;

  // 3) 데이터 행 = 버킷 토큰이 금액 컬럼 x 근처(±25)인 줄 (중복 line 제거)
  const dataLines = [];
  const seenLine = new Set();
  for (const h of bucketHits) {
    if (Math.abs(h.x - amountX) > 25) continue;
    if (seenLine.has(h.line)) continue;
    seenLine.add(h.line);
    dataLines.push(h.line);
  }

  // 4) 데이터 행의 "값 토큰"만으로 x 클러스터링 → 컬럼 중심
  //    (좌측 마진 세로 라벨 "혜택/상세" 와 우측 각주 산문 모두 isValueToken 으로 배제)
  const leftBound = amountX - 35;
  const allX = [];
  for (const line of dataLines) {
    for (const it of line.items) {
      if (it.x < leftBound) continue;
      if (!isValueToken(it.str)) continue;
      allX.push(it.x);
    }
  }
  const centers = clusterX(allX, 40).map((c) => c.center).sort((a, b) => a - b);
  const cellCount = centers.length;

  // 5) 각 값 토큰을 가장 가까운 컬럼 중심에 배정 (빈 셀은 빈 배열로 남음)
  const rawCells = dataLines.map((line) => {
    const cells = centers.map(() => []);
    for (const it of line.items) {
      if (it.x < leftBound) continue;
      if (!isValueToken(it.str)) continue;
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = Math.abs(it.x - centers[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      cells[best].push(it.str.trim());
    }
    return cells;
  });

  // 6) 컬럼 라벨 매핑 (4/5/6 외에는 가까운 프리셋으로 보정)
  const columns = COLUMN_PRESETS[cellCount]
    || COLUMN_PRESETS[Math.min(Math.max(cellCount, 4), 6)];

  // 7) 중복 제거 (잠실처럼 같은 표가 두 번 나오면 첫 번째만) — 병합 전파 전에 수행
  //    (전파가 amount 기준 행 개수를 봐야 하므로 먼저 1벌로 정리)
  const seenAmount = new Set();
  const uniqueCells = [];
  for (const cells of rawCells) {
    const amount = normalizeCell(cells[0] || []);
    if (!amount || seenAmount.has(amount)) continue;
    seenAmount.add(amount);
    uniqueCells.push(cells);
  }

  // 8) 세로 병합 셀 전파 (예: 잠실 추가혜택 2만원이 모든 행에 해당)
  propagateMergedColumns(uniqueCells, columns);

  // 9) 행 객체화 + 빈칸/dash 정규화 + 총 혜택 자동 계산
  const uniqueRows = uniqueCells.map((cells) => {
    const row = Object.fromEntries(
      columns.map((col, i) => [col.key, normalizeCell(cells[i] || []) ?? '—'])
    );
    return fillTotal(row, columns);
  });

  const confidence = uniqueRows.length >= 3 ? 'high' : uniqueRows.length >= 1 ? 'medium' : 'low';
  return {
    ok: true,
    table: {
      title: '구매 금액대별 혜택',
      columns,
      rows: uniqueRows,
    },
    rawRowCount: dataLines.length,
    detectedColumnCount: cellCount,
    confidence,
  };
}

// CLI 진입점 — 디버그 편의
import { fileURLToPath } from 'url';
import path from 'path';
import { extractPdf } from '../extract-pdf.js';
const __thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && __thisFile === path.resolve(process.argv[1])) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node extract/parsers/benefit-table.js <pdf경로>');
    process.exit(1);
  }
  const pdf = await extractPdf(path.resolve(arg));
  const r = await extractBenefitTable(pdf);
  if (!r.ok) {
    console.log('❌', r.reason);
    console.log('debug:', r.debug);
    // 추가 디버그 — 줄별 패턴 매칭 확인
    const lines = (await import('../anchor-search.js')).flattenLines(pdf);
    console.log('총 lines:', lines.length);
    let bucketCnt = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].text;
      const m = t.match(/([\d,]{3,}만원~?)/);
      if (m && /200만원|300만원|500만원|700만원|1,?000만원/.test(t)) {
        bucketCnt++;
        if (bucketCnt < 10) console.log(`  line ${i}: "${t.slice(0, 80)}"`);
      }
    }
    process.exit(1);
  }
  console.log(`✅ 혜택표 자동 추출 — ${r.detectedColumnCount}컬럼 × ${r.table.rows.length}행 (raw ${r.rawRowCount} 후보)`);
  console.log(`신뢰도: ${r.confidence}`);
  console.log('');
  // 표 형태 출력
  const widths = r.table.columns.map((c) => Math.max(c.label.replace(/\n/g, ' ').length, 10));
  console.log(r.table.columns.map((c, i) => c.label.replace(/\n/g, ' ').padEnd(widths[i])).join(' | '));
  console.log(widths.map((w) => '─'.repeat(w)).join('─┼─'));
  for (const row of r.table.rows) {
    console.log(r.table.columns.map((c, i) => (row[c.key] ?? '').padEnd(widths[i])).join(' | '));
  }
}
