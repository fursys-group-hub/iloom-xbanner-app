// 카피 자동 추천 — 어플_설계/카피_뱅크.json 의 규칙을 코드로 옮긴 것
//   ① pickTone   : _자동_추천_규칙.톤_결정 (3톤: 금액강조 / 기간강조 / 축하형)
//   ② autoMainTitle : 용도별_카피.메인_프로모션_타이틀 (박람회 미참여 시 "매장 단독")
// ※ 헤드라인 본문(maxBenefit/celebration)은 케이스별 미세 변형이 있어 to-app-state 가 직접 구성.
//   여기서는 톤 라벨 결정 + 메인 타이틀만 담당(단일 출처). 폼(F)에서 톤 수동 변경 시 이 라벨을 사용.

// 톤 결정 — 카피_뱅크 _자동_추천_규칙.톤_결정
//   · 2아파트 동시 입주        → 축하형 (따뜻한 톤)
//   · 박람회 미참여(LG연계 장기) → 기간강조
//   · 박람회 2회(창원형)        → 금액강조 (금액 셀링)
//   · 제품+박람회(N일)          → 기간강조
//   · 표준 박람회: 3일+ → 기간강조 / 2일↓ → 금액강조
export function pickTone({ caseId = 'case-a', noFair = false, fairDays = 0, multiApt = false } = {}) {
  if (caseId === 'case-d' || multiApt) return '축하형';
  if (noFair) return '기간강조';
  if (caseId === 'case-e') return '금액강조';
  if (caseId === 'case-c') return '기간강조';
  return fairDays >= 3 ? '기간강조' : '금액강조';
}

// 메인 프로모션 타이틀 — 카피_뱅크 용도별_카피.메인_프로모션_타이틀
//   박람회 미참여(매장 단독 상시 프로모션)면 "매장 단독 특별 혜택", 그 외 표준 "입주 특별 프로모션"
export function autoMainTitle({ noFair = false } = {}) {
  return noFair ? '매장 단독 특별 혜택' : '입주 특별 프로모션';
}
