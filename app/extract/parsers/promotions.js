// 특별 프로모션 7종 + 후기 이벤트 5종 자동 감지
//
// 전략: 동의어사전.json 의 `특별프로모션_키워드` / `후기이벤트_키워드` 를 그대로 사용.
//        키워드가 PDF 본문 어디에든 등장하면 해당 프로모션 활성화.
//        다중 매칭 카운트로 신뢰도 결정.

import { flattenLines, loadDictionary } from '../anchor-search.js';

// 공백 무시 매칭 — "지정 세트"(사전) ↔ "지정세트"(PDF)처럼 띄어쓰기만 다른 표현을 놓치지 않도록
const norm = (s) => (s || '').replace(/\s+/g, '');

// 제품 이미지 카드(케이스 C)용 제품 정의 — 키워드 → 표시명 + 크롤링 이미지
const PRODUCT_DEFS = [
  { kw: ['키큰 옷장', '키큰옷장'],                       name: '키큰 옷장',           image: '/assets/products/%EC%BB%AC%EB%A0%89%ED%8A%B8/04_481x481_tab1.jpg' },
  { kw: ['리빙 모션베드', '모션베드'],                    name: '리빙 모션베드',        image: '/assets/products/%EB%A6%AC%EB%B9%99_%EB%AA%A8%EC%85%98%EB%B2%A0%EB%93%9C/01_1024x669_tab1.png' },
  { kw: ['모션데스크', '업모션', '모션 테이블', '모션테이블'], name: '모션 테이블 · 모션데스크', image: '/assets/products/%EC%97%85%EB%AA%A8%EC%85%98/01_1024x723_tab1.png' },
];

// 제품 카드 추출 — "<제품> ... 구매 시 N만 포인트 증정" 줄에서 제품/조건/포인트 추출
// 같은 제품이 여러 티어로 나오면(150만/200만) 첫 줄(기본 티어)만 채택
export function extractProductPromos(pdf) {
  const lines = flattenLines(pdf);
  const seen  = new Set();
  const cards = [];
  for (const line of lines) {
    const t = line.text;
    const am = t.match(/(\d+)\s*만\s*포인트/);
    if (!am || !/구매\s*시/.test(t)) continue;
    const def = PRODUCT_DEFS.find((d) => d.kw.some((k) => t.includes(k)));
    if (!def || seen.has(def.name)) continue;
    seen.add(def.name);

    // 조건: 제품 키워드 뒤 ~ 첫 "구매 시" 까지 (예: "2개 포함 150만원 이상 구매 시")
    const kw    = def.kw.find((k) => t.includes(k));
    const after = t.slice(t.indexOf(kw) + kw.length);
    const cm    = after.match(/(.*?구매\s*시)/);
    let condition = (cm ? cm[1] : '구매 시').replace(/^[\s,·]+/, '').trim() || '구매 시';

    const amount = (parseInt(am[1], 10) * 10000).toLocaleString('en-US');  // "10만" → "100,000"
    cards.push({ name: def.name, condition, amount, imageSrc: def.image });
    if (cards.length >= 3) break;
  }
  return cards;
}

// 특별 프로모션 전용 파서 — "특별 프로모션 / 지정1·지정2" 섹션의 실제 문구를 카드로 추출
// 예) "총 구매금액 300만원 이상 시 10만원 추가 혜택" → { headline:'300만원↑', sub:'10만원 추가 혜택' }
//     "1) 안방 세트 : 옷장 3통 이상"                  → { headline:'안방 세트', sub:'옷장 3통 이상' }
// 키워드 프리셋(generic)과 달리 PDF의 실제 조건/금액을 그대로 담아 카피 정확도를 확보.
export function extractSpecialPromoDetail(pdf) {
  const lines = flattenLines(pdf);
  const amountCards = [];
  const setCards    = [];
  const seen = new Set();

  for (const line of lines) {
    const t = line.text;

    // ① 금액 조건: "총 구매금액 300만원 이상 시 10만원 추가" (조건1/조건2/지정1/지정2 등)
    const am = t.match(/구매금액\s*([\d,]+)\s*만원\s*이상\s*시\s*([\d,]+)\s*만원\s*추가/);
    if (am) {
      const key = `amt:${am[1]}-${am[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        amountCards.push({
          tag: '지정세트 구매',
          headline: `${am[1]}만원↑`,
          sub: `${am[2]}만원 추가 혜택`,
          icon: 'box',
        });
      }
    }

    // ② 세트 구성: "1) 안방 세트 : 옷장 3통 이상"
    const sm = t.match(/(안방|주방|거실|자녀방|학생방)\s*세트\s*[:：]\s*(.+)$/);
    if (sm) {
      const name = `${sm[1]} 세트`;
      const key = `set:${name}`;
      if (!seen.has(key)) {
        seen.add(key);
        setCards.push({
          tag: name,
          headline: name,
          sub: sm[2].replace(/\s+/g, ' ').trim().slice(0, 40),
          icon: 'box',
        });
      }
    }
  }

  // 금액 티어(핵심 혜택)를 카드로 우선 사용 — 의미가 일관됨.
  // 금액 조건이 없을 때만 세트 구성 카드로 폴백. 둘 다 없으면 빈 결과.
  const cards = (amountCards.length ? amountCards : setCards).slice(0, 4);
  // 세트 구성은 참고용으로 함께 반환(편집 화면/부제 활용)
  const sets = setCards.map((c) => ({ name: c.tag, detail: c.sub }));
  return { ok: cards.length > 0, cards, sets };
}

export async function extractPromotions(pdf) {
  const lines = flattenLines(pdf);
  const dict  = await loadDictionary();
  const fullText = lines.map((l) => l.text).join('\n');

  const normText = norm(fullText);   // 공백 제거본 — 띄어쓰기 차이 무시용

  // 특별 프로모션
  const promoDict   = dict.특별프로모션_키워드 || {};
  const specialPromos = [];
  for (const [name, keywords] of Object.entries(promoDict)) {
    const hits = keywords.filter((kw) => normText.includes(norm(kw)));
    if (hits.length) {
      specialPromos.push({
        name,
        hits,
        confidence: hits.length >= 2 ? 'high' : 'medium',
      });
    }
  }

  // 후기 이벤트 — LSA 우수후기는 내부용이라 X배너 카피로 노출 금지 (사전 주석 참고)
  const reviewDict = dict.후기이벤트_키워드 || {};
  const reviews    = [];
  for (const [name, keywords] of Object.entries(reviewDict)) {
    if (name.startsWith('_')) continue;             // 메타 키 제외
    if (name === 'LSA우수후기_내부전용') continue;   // 외부 노출 금지
    const list = Array.isArray(keywords) ? keywords : [];
    const hits = list.filter((kw) => normText.includes(norm(kw)));
    if (hits.length) {
      reviews.push({
        name,
        hits,
        confidence: hits.length >= 2 ? 'high' : 'medium',
      });
    }
  }

  // 단톡방 운영 여부 (별도 시그널)
  const dantokKeys = dict.필드별_라벨?.단톡방 || ['단톡방'];
  const hasDantokbang = dantokKeys.some((k) => normText.includes(norm(k)));

  return {
    specialPromos,
    reviews,
    productPromos: extractProductPromos(pdf),
    specialPromoDetail: extractSpecialPromoDetail(pdf),
    hasDantokbang,
    confidence:
      specialPromos.length >= 2 ? 'high'
      : specialPromos.length >= 1 ? 'medium'
      : 'low',
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
    console.error('사용법: node extract/parsers/promotions.js <pdf경로>');
    process.exit(1);
  }
  const pdf = await extractPdf(path.resolve(arg));
  const r = await extractPromotions(pdf);
  console.log('\n=== 특별 프로모션 (' + r.specialPromos.length + '종) ===');
  for (const p of r.specialPromos) {
    console.log(`  · ${p.name.padEnd(16)} ${p.confidence.padEnd(7)} hits: ${p.hits.slice(0, 3).join(', ')}`);
  }
  console.log('\n=== 후기 이벤트 (' + r.reviews.length + '종) ===');
  for (const p of r.reviews) {
    console.log(`  · ${p.name.padEnd(16)} ${p.confidence.padEnd(7)} hits: ${p.hits.slice(0, 3).join(', ')}`);
  }
  console.log('\n단톡방 운영:', r.hasDantokbang ? '✓' : '✗');
}
