// 결제 포인트 감지 — 결제 안내 영역 표시/숨김 결정
// 규칙(사용자 확정): 네이버/L.POINT/SSG 등 포인트 "브랜드"가 한 번이라도 언급되면 기본 3카드 표시,
//   브랜드가 전혀 없으면(교대역·수원성중흥처럼 "포인트 일괄 지급"만) 결제 영역 숨김.
// ※ 카드 종류는 기본 3종 고정(N pay / L.POINT / SSGPAY) — 종류 세분화 안 함.

import { flattenLines } from '../anchor-search.js';

// 포인트 "브랜드" — 일반 "포인트 지급"(브랜드 없음)은 제외해야 하므로 브랜드명만 매칭
const BRAND_RX = /네이버\s*포인트|네이버\s*페이|네이버페이|\bN\s*pay\b|L\.?\s*POINT|엘\s*포인트|롯데\s*(?:포인트|멤버스)|\bSSG\b|페이\s*머니|쓱\s*페이/i;

export async function extractPayment(pdf) {
  const lines = flattenLines(pdf);
  const hit = lines.find((l) => BRAND_RX.test(l.text));
  return {
    ok:         !!hit,
    confidence: hit ? 'high' : 'missing',
    raw:        hit ? hit.text.replace(/\s+/g, ' ').slice(0, 120) : null,
  };
}
