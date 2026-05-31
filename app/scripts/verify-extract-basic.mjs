// 9건 정답 데이터셋 vs 추출 결과 — 기본 정보 일치율 검증
// 사용법: node scripts/verify-extract-basic.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdf } from '../extract/extract-pdf.js';
import { extractBasicInfo } from '../extract/parsers/basic-info.js';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR      = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const REF_PATH     = path.join(PROJECT_ROOT, '어플_설계', '테스트_정답_데이터.json');
const PDF_DIR      = path.join(PROJECT_ROOT, '참고자료');

const refData = JSON.parse(await fs.readFile(REF_PATH, 'utf8'));

// 테스트 대상: PDF 가 있고 정답이 있는 케이스만
const pdfFiles = await fs.readdir(PDF_DIR);
const pdfMap   = new Map(pdfFiles.filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => [f, f]));

function findPdfFor(answerCase) {
  const want = answerCase.파일명 || '';
  if (want && pdfMap.has(want)) return want;

  const apt   = answerCase.기본정보?.아파트명 || '';
  const aptKey = apt.replace(/\s+/g, '');

  // 품의서 PDF 우선 (제목에 "공략의 건" / "공략의건" 포함). A4 시안/리플렛 제외
  const candidates = [...pdfMap.keys()].filter((name) => /공략의\s*건/.test(name));
  for (const name of candidates) {
    if (apt && name.includes(apt.split(' ')[0])) return name;
    const nameKey = name.replace(/\s+/g, '');
    if (aptKey && nameKey.includes(aptKey.slice(0, 5))) return name;
  }

  // 백업 — 전체 PDF 중 부분 매칭
  for (const [name] of pdfMap) {
    if (apt && name.includes(apt.split(' ')[0])) return name;
  }
  return null;
}

function compareValues(expected, actual) {
  if (expected == null || expected === '') return 'n/a';
  if (actual   == null) return 'miss';
  if (typeof expected === 'string') return String(actual).includes(expected) || expected.includes(String(actual)) ? '✓' : '✗';
  if (typeof expected === 'number') return Number(actual) === Number(expected) ? '✓' : '✗';
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return '✗';
    // 매장 배열 — name 만 비교
    const expNames = expected.map((s) => s.이름 || s.name || s).sort();
    const actNames = actual.map((s) => s.name || s.이름 || s).sort();
    return JSON.stringify(expNames) === JSON.stringify(actNames) ? '✓' : '~';
  }
  if (typeof expected === 'object') {
    // period
    if (expected.기간_시작 && expected.기간_종료) {
      return actual.start === expected.기간_시작 && actual.end === expected.기간_종료 ? '✓' : '✗';
    }
    return '~';
  }
  return '?';
}

const FIELDS = [
  { key: 'aptName',         get: (a) => a.기본정보?.아파트명 },
  { key: 'occupationMonth', get: (a) => a.기본정보?.입주월 },
  { key: 'households',      get: (a) => a.기본정보?.세대수 },
  { key: 'pricePerCustomer',get: (a) => a.기본정보?.객단가 },
  { key: 'stores',          get: (a) => a.매장 },
  { key: 'period',          get: (a) => a.박람회?.기간_시작 ? { 기간_시작: a.박람회.기간_시작, 기간_종료: a.박람회.기간_종료 } : null },
  { key: 'venue',           get: (a) => a.박람회?.장소 },
  { key: 'organizer',       get: (a) => a.박람회?.주관사 },
  { key: 'shortName',       get: (a) => a.기본정보?.약명 },
  { key: 'documentNumber',  get: (a) => a.작성정보?.문서번호 },
  { key: 'writeDate',       get: (a) => a.작성정보?.작성일 },
  { key: 'author',          get: (a) => a.작성정보?.작성자 },
  { key: 'department',      get: (a) => a.작성정보?.작성부서 },
];

const cases = refData.케이스 || refData.cases || [];
const summary = [];

for (const ans of cases) {
  const pdfName = findPdfFor(ans);
  if (!pdfName) {
    summary.push({ id: ans.id || ans.기본정보?.아파트명, status: 'PDF 없음' });
    continue;
  }
  try {
    const pdf = await extractPdf(path.join(PDF_DIR, pdfName));
    const { fields } = await extractBasicInfo(pdf);

    const row = { id: ans.id, pdfName, total: 0, hit: 0, miss: 0, na: 0, byField: {} };
    for (const f of FIELDS) {
      const exp = f.get(ans);
      const act = fields[f.key];
      const r   = compareValues(exp, act);
      row.byField[f.key] = r;
      if (r === 'n/a')      row.na++;
      else if (r === '✓')   { row.hit++; row.total++; }
      else                  { row.miss++; row.total++; }
    }
    row.accuracy = row.total ? ((row.hit / row.total) * 100).toFixed(0) + '%' : '-';
    summary.push(row);
  } catch (e) {
    summary.push({ id: ans.id, pdfName, status: '에러: ' + e.message });
  }
}

console.log('\n📊 9건 정답 데이터 vs 자동 추출 — 기본 정보 일치율\n');
console.log('id                                            정확도  hit/total  (간략 결과)');
console.log('─'.repeat(95));
for (const s of summary) {
  if (s.status) {
    console.log(`${(s.id || '?').padEnd(45)}  ${s.status}`);
    continue;
  }
  const compact = Object.entries(s.byField).map(([k, v]) => v === '✓' ? '·' : v === '✗' ? `❌${k}` : v === '~' ? `?${k}` : v === 'miss' ? `⛔${k}` : '').filter(Boolean).join(' ');
  console.log(`${(s.id || '?').padEnd(45)}  ${s.accuracy.padStart(5)}   ${(s.hit + '/' + s.total).padStart(6)}    ${compact}`);
}
console.log('');
const totals = summary.filter((s) => s.total).reduce((acc, s) => ({ hit: acc.hit + s.hit, total: acc.total + s.total }), { hit: 0, total: 0 });
console.log(`총합: ${totals.hit} / ${totals.total} = ${(totals.hit / totals.total * 100).toFixed(1)}%\n`);
