// 유의사항 자동 추출
//
// 전략: PDF 본문에서 "공통사항" / "유의사항" / "주의사항" 섹션을 찾고
//        그 아래 "- " prefix 줄들을 유의사항으로 추출.
//        X배너에 들어갈 표준화 작업 (선행 dash 제거, 너무 긴 줄 trim)

import { flattenLines } from '../anchor-search.js';

const SECTION_HEADER = /(\d\)\s*)?(공통사항|유의사항|주의사항|기타사항|안내사항)/;
const NEXT_SECTION   = /^(\d\)\s*|\d\.\s+|\(\d\)\s+|※\s)/;
const BULLET_PREFIX  = /^[\-—–]\s*/;

// 추출된 유의사항에서 X배너에 부적합한 줄 제거 (내부 운영용 문구)
const SKIP_PATTERNS = [
  /정산/i,
  /본사\s*[:：]?\s*대리점\s*=/,
  /ERP\s*등록/i,
  /채산이익률/,
  /부담\s*$/,
  /5:5\s*분담/,
  /^\s*\*공략비용/,
];

function clean(text) {
  return text.replace(BULLET_PREFIX, '').replace(/\s+/g, ' ').trim();
}

function shouldSkip(text) {
  return SKIP_PATTERNS.some((re) => re.test(text));
}

export async function extractNotices(pdf) {
  const lines = flattenLines(pdf);

  // "공통사항" 섹션 시작 찾기 (없으면 빈 배열)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_HEADER.test(lines[i].text)) {
      startIdx = i + 1;
      break;
    }
  }
  if (startIdx === -1) {
    return { ok: false, notices: [], confidence: 'missing', reason: '공통사항 섹션 없음' };
  }

  // 다음 섹션 헤더 또는 본문 끝까지
  const candidates = [];
  for (let i = startIdx; i < lines.length; i++) {
    const t = lines[i].text;
    if (i > startIdx && NEXT_SECTION.test(t)) break;
    if (BULLET_PREFIX.test(t)) {
      const cleaned = clean(t);
      if (cleaned.length >= 4 && !shouldSkip(cleaned)) {
        candidates.push(cleaned);
      }
    }
  }

  // 중복 제거 + 너무 긴 줄 자르기 (X배너 한 줄 최대 50자 권장)
  const seen = new Set();
  const notices = [];
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    notices.push(c.length > 80 ? c.slice(0, 78) + '…' : c);
  }

  return {
    ok: notices.length > 0,
    notices,
    confidence: notices.length >= 3 ? 'high' : notices.length >= 1 ? 'medium' : 'low',
  };
}

// CLI 진입점
import { fileURLToPath } from 'url';
import path from 'path';
import { extractPdf } from '../extract-pdf.js';
const __thisFile = fileURLToPath(import.meta.url);
if (__thisFile === path.resolve(process.argv[1] || '')) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node extract/parsers/notices.js <pdf경로>');
    process.exit(1);
  }
  const pdf = await extractPdf(path.resolve(arg));
  const r = await extractNotices(pdf);
  console.log(`\n=== 유의사항 (${r.notices.length}줄, ${r.confidence}) ===`);
  r.notices.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  if (!r.ok) console.log('  실패:', r.reason);
}
