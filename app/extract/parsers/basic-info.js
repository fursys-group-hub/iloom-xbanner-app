// 품의서 기본 정보 추출 — 아파트/매장/기간/입주월/세대수/객단가/약명/작성정보 등

import { flattenLines, findByLabels, loadDictionary, confidenceFor } from '../anchor-search.js';

// "26년 3월 21일(토)~3월 22일(일)" 또는 "YY/MM/DD" 같은 다양한 표기를 ISO 로
function normalizeDateFromKorean(yy, mm, dd) {
  const year  = yy.length === 2 ? `20${yy}` : yy;
  const month = String(mm).padStart(2, '0');
  const day   = String(dd).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "26년 3월 21일(토)~3월 22일(일)/ 2일간" → { start, end }
function parsePeriodRange(text) {
  if (!text) return null;
  // 패턴 0: "2026/07/31(금)~08/02(일)" — 풀 시작(4자리 연도) + 월/일 끝(같은 해). 요일 괄호 허용
  let m0 = text.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\s*(?:\([^)]*\))?\s*[~\-–—]\s*(?:(\d{4})[\/\-\.])?(\d{1,2})[\/\-\.](\d{1,2})/);
  if (m0) {
    return {
      start: normalizeDateFromKorean(m0[1], m0[2], m0[3]),
      end:   normalizeDateFromKorean(m0[4] || m0[1], m0[5], m0[6]),
    };
  }
  // 패턴 1: "26년 3월 21일 ~ 3월 22일" / "25년 10월 18일~19일"
  // 종료 월은 반드시 "월"이 붙을 때만 인정 — 안 그러면 "19일"이 1월 9일로 잘못 쪼개짐
  let m = text.match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일[^~\-–—]*[~\-–—]\s*(?:(\d{2,4})\s*년\s*)?(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일/);
  if (m) {
    const startY = m[1], startM = m[2], startD = m[3];
    const endY   = m[4] || startY;
    const endM   = m[5] || startM;
    const endD   = m[6];
    return {
      start: normalizeDateFromKorean(startY, startM, startD),
      end:   normalizeDateFromKorean(endY, endM, endD),
    };
  }
  // 패턴 2: "YY/MM/DD - YY/MM/DD"
  m = text.match(/(\d{2,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\s*[~\-–—]\s*(\d{2,4})?[\/\-\.]?(\d{1,2})?[\/\-\.]?(\d{1,2})/);
  if (m) {
    const startY = m[1], startM = m[2], startD = m[3];
    const endY   = m[4] || startY;
    const endM   = m[5] || startM;
    const endD   = m[6];
    return {
      start: normalizeDateFromKorean(startY, startM, startD),
      end:   normalizeDateFromKorean(endY, endM, endD),
    };
  }
  return null;
}

// "10월 11일(토) ~ 10월 12일(일)" (연도 없음) → { start, end } — 연도는 inferYear 로 보충
// 종료 월 생략 시 시작 월 상속 ("11일~12일")
function parseMonthDayRange(text, year) {
  const m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:\([^)]*\))?\s*[~\-–—]\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일/);
  if (!m) return null;
  const sM = m[1], sD = m[2], eM = m[3] || m[1], eD = m[4];
  return {
    start: normalizeDateFromKorean(year, sM, sD),
    end:   normalizeDateFromKorean(year, eM, eD),
  };
}

// 박람회 2회(창원형) — "1차 26년 01월 17일~18일 … 2단지 타깃" + "2026년 2월(2단지) 입주 예정"
// 반환: [{ tag, dates, target, sub, _start, _end }] (≥2 일 때만 의미)
function parseFairs(lines, inferYear) {
  const pad = (n) => String(n).padStart(2, '0');

  // 입주 예정 월 맵: 단지번호 → "YYYY년 M월" ("2026년 2월(2단지)과 5월(1단지) 입주 예정")
  const moveInByDanji = {};
  for (const l of lines) {
    if (!/입주\s*예정/.test(l.text)) continue;
    const yMatch = l.text.match(/(\d{4})\s*년/);
    const baseYear = yMatch ? yMatch[1] : inferYear;
    for (const m of l.text.matchAll(/(\d{1,2})\s*월\s*\(\s*(\d+)\s*단지\s*\)/g)) {
      moveInByDanji[m[2]] = `${baseYear}년 ${parseInt(m[1], 10)}월`;
    }
  }

  // "N차 … 날짜~날짜 … M단지 타깃" — 차수별 1회. 종료 월 생략 시 시작 월 상속.
  const RX = /(\d)\s*차\s+(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(?:\([^)]*\))?\s*[~\-–—]\s*(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일\s*(?:\([^)]*\))?[^타]*?(\d+)\s*단지\s*타깃/g;
  const fairs = [];
  const seen = new Set();
  for (const l of lines) {
    if (!/타깃/.test(l.text)) continue;
    for (const m of l.text.matchAll(RX)) {
      const cha = m[1];
      if (seen.has(cha)) continue;
      seen.add(cha);
      const year = m[2].length === 2 ? `20${m[2]}` : m[2];
      const sM = +m[3], sD = +m[4], eM = m[5] ? +m[5] : +m[3], eD = +m[6], danji = m[7];
      fairs.push({
        tag:    `${cha}차 박람회`,
        dates:  `${year}.${pad(sM)}.${pad(sD)}.\n~ ${pad(eM)}.${pad(eD)}.`,
        target: `${danji}단지 입주민`,
        sub:    moveInByDanji[danji] ? `${moveInByDanji[danji]} 입주 예정` : '',
        _start: `${year}-${pad(sM)}-${pad(sD)}`,
        _end:   `${year}-${pad(eM)}-${pad(eD)}`,
      });
    }
  }
  fairs.sort((a, b) => a.tag.localeCompare(b.tag));
  return fairs;
}

// "1,349세대" → 1349
function parseHouseholds(text) {
  const m = text.match(/([\d,]+)\s*세대/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''), 10);
}

// "2026년 5월" 또는 "26년 5월" → "2026년 5월"
function parseOccupationMonth(text) {
  const m = text.match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월/);
  if (!m) return null;
  const y = m[1].length === 2 ? `20${m[1]}` : m[1];
  return `${y}년 ${parseInt(m[2], 10)}월`;
}

// "320만원" → 3200000 / "3,000,000" → 3000000
function parseAmount(text) {
  const manMatch = text.match(/([\d,]+)\s*만원/);
  if (manMatch) {
    return parseInt(manMatch[1].replace(/,/g, ''), 10) * 10000;
  }
  const numMatch = text.match(/([\d,]{4,})/);
  if (numMatch) {
    return parseInt(numMatch[1].replace(/,/g, ''), 10);
  }
  return null;
}

// "일룸 서대전점 / 대전둔산점" → ["서대전점", "대전둔산점"]
// "분당서현(P), 분당(B)" → [{name: '분당서현', code: 'P'}, ...]
function parseStores(text) {
  // 매장명 패턴: "일룸 어쩌고점" 또는 "어쩌고점" — 'X점' 끝
  const tokens = text
    .replace(/일룸\s+/g, '')
    .split(/[\/,·]|및/)
    .map((s) => s.trim())
    .filter(Boolean);

  const stores = [];
  for (const t of tokens) {
    // 매장명 + (P)/(B)/(투자B) 코드
    const m = t.match(/^([가-힣A-Za-z0-9 ]+점)\s*(?:\(([PB]|투자B)\))?/);
    if (m) {
      const name = m[1].trim();
      let code   = m[2] || null;
      if (code === '투자B') code = 'B';
      stores.push({ name, code });
    }
  }
  return stores;
}

// "…'일룸 프리미엄샵 논현'…에서만 단독 홍보" 줄에서 따옴표 안 '일룸 XXX' 매장명 추출
// (공략매장 라벨이 없거나 매장명이 'X점' 형식이 아닐 때 — 디에이치/잠실)
// 반환: [{ name: '프리미엄샵 논현', code: null }] — to-app-state 가 앞에 "일룸 " 붙임
function parseStoresFromQuotes(lines) {
  const QUOTED = /['‘’"“”]\s*일룸\s+([^'‘’"“”]+?)\s*['‘’"“”]/g;
  const stores = [];
  for (const line of lines) {
    if (!/단독\s*홍보|홍보\s*진행|에서만/.test(line.text)) continue;
    for (const m of line.text.matchAll(QUOTED)) {
      const name = m[1].trim().replace(/[,·]\s*$/, '');
      if (name && !stores.some((s) => s.name === name)) stores.push({ name, code: null });
    }
    if (stores.length) break;   // 첫 매칭 줄만
  }
  return stores;
}

// 번호 매긴 매장 목록 "① 스타필드수원점 / 투자형B" "② 수원광교점 / 직영" 에서 매장명+코드
// (공략매장 라벨·따옴표 단독홍보 둘 다 실패할 때 — 박람회 미참여 매장 단독형)
function parseStoresNumbered(lines) {
  const RX = /[①②③④⑤⑥⑦⑧⑨]\s*([가-힣A-Za-z0-9 ]+?점)\s*\/\s*(투자형?[PB]|투자[PB]|직영|위탁|[PB])/;
  const stores = [];
  for (const line of lines) {
    const m = line.text.match(RX);
    if (!m) continue;
    const name = m[1].trim().replace(/\s+/g, '');
    let code = null;
    if (/B/.test(m[2])) code = 'B';
    else if (/P/.test(m[2])) code = 'P';
    if (name && !stores.some((s) => s.name === name)) stores.push({ name, code });
  }
  return stores;
}

// 제목줄 괄호 안 매장명 추출 — "제목 … 입주공략 (서대전점)" / "(스타필드수원점 수원광교점)" / "(서대전점,대전둔산점)"
// 거의 모든 품의서 제목에 "(OO점)" 이 들어가 가장 보편적인 최종 폴백 (라벨/따옴표/번호 다 실패할 때).
function parseStoresFromTitle(lines) {
  const stores = [];
  const isStore = (s) =>
    /^[가-힣A-Za-z0-9]{2,10}점$/.test(s) &&
    !/백화점|면세점|할인점|편의점/.test(s) &&
    !/^(대리점|지점|본점|영업점)$/.test(s);
  for (const line of lines) {
    if (!/공략|입주/.test(line.text)) continue;                 // 제목·요지 성격의 줄만
    for (const pm of line.text.matchAll(/[\(（]([^)）]*점[^)）]*)[\)）]/g)) {
      for (const tok of pm[1].split(/[\s,，·/및]+/)) {
        const name = tok.trim().replace(/^일룸\s*/, '');
        if (isStore(name) && !stores.some((s) => s.name === name)) stores.push({ name, code: null });
      }
    }
    if (stores.length) break;   // 첫 매칭 줄만
  }
  return stores;
}

// "일룸-품의26-03-00082" 패턴
function parseDocNumber(text) {
  const m = text.match(/일룸[\-\s]?품의\d{2,4}[\-\s]?\d{1,2}[\-\s]?\d{3,6}/);
  return m ? m[0].replace(/\s/g, '') : null;
}

// "2026-03-05" 또는 "2026.03.05" 또는 "2026/03/05" → ISO
function parseISODate(text) {
  const m = text.match(/(\d{4})[\-\.\/](\d{1,2})[\-\.\/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

export async function extractBasicInfo(pdf) {
  const lines = flattenLines(pdf);
  const dict  = await loadDictionary();
  const L     = dict.필드별_라벨 || {};

  const fields = {};   // 최종 결과
  const meta   = {};   // 신뢰도/원본

  // ── 아파트명 ──
  {
    const found = findByLabels(lines, L.아파트명 || ['아파트명']);
    let aptName = null;
    if (found) {
      // value 에는 라벨 뒤 컬럼들이 다 붙어있을 수 있음 → 매장/공동공략 단어 직전까지
      const v = found.value
        .replace(/^[:：\s]+/, '')                                  // 앞 콜론/공백 (대전하늘채 ": 대전…")
        .replace(/(공동공략|단독공략).*$/, '')                     // 공략 메모 이후
        .replace(/\s*[\(（][\s\S]*$/, '')                          // 괄호(주소/약명) 이후 (대전하늘채 "(대전광역시…)")
        // 주소 시작(도/광역시/시+구·군·동) 이후 전부 제거 — 순천/양정/익산/부산센텀
        .replace(/\s+(?:[가-힣]{2,}(?:광역시|특별시|특별자치시|특별자치도)|(?:전라|경상|충청|강원|경기|제주)(?:남도|북도|도)|[가-힣]{2,}시\s+[가-힣]{1,5}[구군동])[\s\S]*$/, '')
        .replace(/\s+[가-힣]*\d*구역\s*재개발[\s\S]*$/, '')        // "계림4구역 재개발아파트" — 교대역
        .replace(/\s*(재개발|재건축)\s*아파트?[\s\S]*$/, '')       // 재개발/재건축 메모
        .replace(/\s*\d+\s*단지(\s*[,·]\s*\d+\s*단지)*\s*$/, '')   // "…포레스트 1단지, 2단지" → "…포레스트"
        .replace(/(서대전점|동부산점|연제점|창원점|분당서현|분당|광주광천점|광주봉선점|광천점|봉선점|수성점|광교점|논현|방배|잠실|월평|월평공원|.+점)\s.*$/, '')
        .trim();
      aptName = v || found.value;
    }
    fields.aptName = aptName;
    meta.aptName   = { value: aptName, raw: found?.value, label: found?.label, confidence: confidenceFor(found, aptName) };
  }

  // ── 입주 월 ──
  {
    const found = findByLabels(lines, L.입주월 || ['입주 월']);
    let occ = null;
    if (found) occ = parseOccupationMonth(found.value);
    fields.occupationMonth = occ;
    meta.occupationMonth   = { value: occ, raw: found?.value, label: found?.label, confidence: confidenceFor(found, occ) };
  }

  // ── 세대수 ──
  {
    // 라벨 "입주 세대 수 및 시점" 같은 합쳐진 라벨도 있어 fallback 으로 inline 검색
    const found = findByLabels(lines, [...(L.세대수 || []), '입주 세대 수', '아파트세대수']);
    let v = found ? parseHouseholds(found.value) : null;
    let src = found;
    // 폴백: 라벨이 빈 줄("세대수")을 잡으면 null → 본문에서 첫 "N세대"(400 이상=단지 규모) 스캔
    // (㎡별 세대수 분해표보다 보통 총 세대수가 먼저 등장)
    if (!v) {
      for (const l of lines) {
        const m = l.text.match(/([\d,]{3,})\s*세대/);
        if (m && parseInt(m[1].replace(/,/g, ''), 10) >= 400) {
          v = parseInt(m[1].replace(/,/g, ''), 10);
          src = { value: l.text, label: '세대수(본문스캔)', mode: 'inline' };
          break;
        }
      }
    }
    fields.households = v;
    meta.households   = { value: v, raw: src?.value, label: src?.label, confidence: confidenceFor(src, v) };
  }

  // ── 객단가 ──
  {
    const found = findByLabels(lines, L.객단가 || ['객단가']);
    let v = found ? parseAmount(found.value) : null;
    let src = found;
    // 폴백: 라벨이 "목표 객단가" 헤더(값 없음)를 잡으면 null → "객단가 320만원"처럼 객단가 뒤 금액 스캔
    if (!v) {
      for (const l of lines) {
        const m = l.text.match(/객단가\s*[:：]?\s*([\d,]+\s*만원|[\d,]{6,})/);
        if (m) { v = parseAmount(m[1]); if (v) { src = { value: l.text, label: '객단가(본문스캔)', mode: 'inline' }; break; } }
      }
    }
    // 폴백2: "구분 수주건수 객단가 목표매출" 표 — 객단가가 컬럼 헤더라 값은 다음 데이터행에 있음
    // (부산센텀 "부산센텀점 40 2,750,000 110,000,000"). 데이터행의 백만원대(100만~999만) 숫자 = 객단가.
    if (!v) {
      const hdrIdx = lines.findIndex((l) => /객단가/.test(l.text) && /(목표\s*매출|수주\s*건수|예상\s*매출)/.test(l.text));
      if (hdrIdx >= 0) {
        for (let i = hdrIdx + 1; i < Math.min(hdrIdx + 6, lines.length); i++) {
          const nums = [...lines[i].text.matchAll(/([\d,]{7,})/g)]
            .map((m) => parseInt(m[1].replace(/,/g, ''), 10))
            .filter((n) => n >= 1_000_000 && n <= 9_990_000);   // 100만~999만 = 통상 객단가 범위
          if (nums.length) { v = nums[0]; src = { value: lines[i].text, label: '객단가(표)', mode: 'inline' }; break; }
        }
      }
    }
    fields.pricePerCustomer = v;
    meta.pricePerCustomer   = { value: v, raw: src?.value, label: src?.label, confidence: confidenceFor(src, v) };
  }

  // ── 매장 ──
  {
    const found = findByLabels(lines, L.공략매장 || ['공략 매장']);
    let v = found ? parseStores(found.value) : [];
    let src = found;
    // 폴백: 공략매장 라벨이 비면 "…'일룸 프리미엄샵 논현'…에서만 단독 홍보" 줄에서 따옴표 안 매장명
    // (디에이치/잠실처럼 "점" 안 붙는 형식. parseStores 의 'X점' 패턴으로는 못 잡음)
    if (!v.length) {
      v = parseStoresFromQuotes(lines);
      if (v.length) src = { value: v.map((s) => s.name).join(', '), label: '단독홍보매장', mode: 'inline' };
    }
    // 폴백2: "① 스타필드수원점 / 투자형B" 번호 매긴 매장 목록 (수원성중흥 등)
    if (!v.length) {
      v = parseStoresNumbered(lines);
      if (v.length) src = { value: v.map((s) => s.name + (s.code ? `(${s.code})` : '')).join(', '), label: '매장목록(번호)', mode: 'inline' };
    }
    // 폴백3(최종): 제목 괄호 안 매장명 "…입주공략 (서대전점)" (대전하늘채 등 — 위 3가지 표기 다 아닐 때)
    if (!v.length) {
      v = parseStoresFromTitle(lines);
      if (v.length) src = { value: v.map((s) => s.name).join(', '), label: '제목괄호매장', mode: 'inline' };
    }
    fields.stores = v;
    meta.stores   = { value: v, raw: src?.value, label: src?.label, confidence: confidenceFor(src, v) };
  }

  // ── 박람회 기간 ──
  {
    // 박람회 미참여(매장 단독 프로모션) 감지 — 수원성중흥 등
    const noFair = lines.some((l) => /박람회\s*미참여|미참여\s*전략|박람회\s*불참/.test(l.text));
    fields.noFair = noFair;

    // 연도 추정 — 월/일만 있는 박람회 날짜(부산센텀 "10월 11일")용. 작성일/문서번호에서.
    const allText = lines.map((l) => l.text).join(' ');
    const ym = allText.match(/작성일\s*(\d{4})/) || allText.match(/일룸[-\s]?품의(\d{2})/);
    const inferYear = ym ? (ym[1].length === 2 ? `20${ym[1]}` : ym[1]) : String(new Date().getFullYear());

    let v = null, src = null;
    // 1) "기간" 라벨 (한화/대구범어/교대역)
    const found = findByLabels(lines, L.박람회기간 || ['기간']);
    if (found) { v = parsePeriodRange(found.value); if (v) src = found; }
    // 2) 슬래시 풀데이트 줄 "2026/07/31~08/02" (디에이치)
    if (!v) {
      const full = lines.find((l) => /(\d{4})[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\s*(?:\([^)]*\))?\s*[~\-–—]\s*(?:\d{4}[\/\-\.])?\d{1,2}[\/\-\.]\d{1,2}/.test(l.text));
      if (full) { v = parsePeriodRange(full.text); if (v) src = { value: full.text, label: '박람회기간(풀데이트)', mode: 'inline' }; }
    }
    // 3) 박람회/1차 마커 날짜 줄 (창원 "1차 26년 01월…" 한국어 / 부산센텀 "10월 11일" 연도없음)
    //    납기/상시/운영/사전점검/수주등록 줄은 제외
    if (!v && !noFair) {
      const cand = lines.find((l) =>
        /(박람회|1\s*차|현장\s*계약)/.test(l.text)
        && !/납기|상시|운영\s*기간|사전\s*점검|수주\s*등록/.test(l.text)
        && /\d{1,2}\s*[월\/]\s*\d{1,2}/.test(l.text) && /[~\-–—]/.test(l.text));
      if (cand) {
        v = parsePeriodRange(cand.text) || parseMonthDayRange(cand.text, inferYear);
        if (v) src = { value: cand.text, label: '박람회기간(스캔)', mode: 'inline' };
      }
    }
    // 4) 박람회 미참여면 "운영 기간"으로 (매장 단독)
    if (!v && noFair) {
      const op = lines.find((l) => /운영\s*기간/.test(l.text) && /\d/.test(l.text));
      if (op) { v = parsePeriodRange(op.text); if (v) src = { value: op.text, label: '운영기간(박람회미참여)', mode: 'inline' }; }
    }

    fields.period = v;
    meta.period   = { value: v, raw: src?.value, label: src?.label, confidence: confidenceFor(src, v) };

    // 박람회 2회(창원형) — "1차 …날짜… 2단지 타깃" + "2차 …날짜… 1단지 타깃"
    // ≥2 면 fairs 채우고 헤더 기간을 전체 스팬(1차 시작 ~ 마지막 차 끝)으로 교체
    const fairs = parseFairs(lines, inferYear);
    if (fairs.length >= 2) {
      fields.fairs = fairs;
      fields.period = { start: fairs[0]._start, end: fairs[fairs.length - 1]._end };
      meta.period = { value: fields.period, raw: '박람회 2회 종합', label: '박람회기간(2회)', confidence: 'high' };
    }
  }

  // ── 박람회 장소 ──
  {
    const found = findByLabels(lines, L.박람회장소 || ['장소']);
    let v = null;
    if (found) {
      // "장소 대전컨벤션센터(DCC) 주관사 : CTSA" 같은 합쳐진 줄에서 주관사 직전까지
      v = found.value.replace(/\s*주관사.*$/, '').trim();
    }
    fields.venue = v;
    meta.venue   = { value: v, raw: found?.value, label: found?.label, confidence: confidenceFor(found, v) };
  }

  // ── 주관사 ──
  {
    const found = findByLabels(lines, L.주관사 || ['주관사']);
    let v = null;
    if (found) {
      v = found.value.replace(/^[:：\s]+/, '').replace(/\s.*$/, '').trim();
    }
    fields.organizer = v;
    meta.organizer   = { value: v, raw: found?.value, label: found?.label, confidence: confidenceFor(found, v) };
  }

  // ── 약명 ──
  {
    const found = findByLabels(lines, L.약명 || ['약명']);
    let v = null;
    let shortNameSrc = null;
    if (found) {
      // 시작 부호(":", "(", 공백 등) 제거 → 괄호 안 텍스트만 추출
      v = found.value
        .replace(/^[:：\s]+/, '')
        .replace(/^[\(（]/, '')
        .replace(/[\)）].*$/, '')
        .trim() || null;
    }
    // 폴백: "약명" 라벨이 없을 때 → 수주건명 예시 괄호에서 약명 추출
    // "예시) 홍길동(입주)(현장)(두산오션)(옷장)" / "수주건명 기재 : 고객명(입주)(현장)(두산오션)"
    // → 괄호 토큰 중 정형 키워드(입주/현장/옷장/계약/후기/고객명…) 아닌 것 = 약명 (부산센텀 두산오션)
    if (!v) {
      const KEYWORD = /^(입주|현장|옷장|계약|후기|고객명|홍길동|상시|박람회|매장|온라인)$/;
      for (const l of lines) {
        if (!/수주\s*건명|수주건명|예시\s*[)）]/.test(l.text)) continue;
        const toks = [...l.text.matchAll(/[\(（]([^)）]{2,8})[\)）]/g)].map((m) => m[1].trim());
        const cand = toks.find((t) => !KEYWORD.test(t) && /^[가-힣A-Za-z0-9]+$/.test(t));
        if (cand) { v = cand; shortNameSrc = { value: l.text, label: '약명(수주건명예시)' }; break; }
      }
    }
    fields.shortName = v;
    meta.shortName   = { value: v, raw: found?.value || shortNameSrc?.value, label: found?.label || shortNameSrc?.label, confidence: confidenceFor(found || shortNameSrc, v) };
  }

  // ── 작성 정보 (한 줄에 "문서번호 ... 작성일 ..." 형태) ──
  {
    const docFound = findByLabels(lines, ['문서번호']);
    fields.documentNumber = docFound ? parseDocNumber(docFound.line.text) : null;
    meta.documentNumber   = { value: fields.documentNumber, raw: docFound?.line?.text, label: '문서번호', confidence: confidenceFor(docFound, fields.documentNumber) };

    // 작성일 — 줄 어디든 ISO 또는 점 표기 매칭
    const dateLine = lines.find((l) => /작성일/.test(l.text));
    if (dateLine) {
      const v = parseISODate(dateLine.text.split('작성일')[1] || '');
      fields.writeDate = v;
      meta.writeDate   = { value: v, raw: dateLine.text, label: '작성일', confidence: v ? 'high' : 'low' };
    }

    // 작성자
    const authorLine = lines.find((l) => /작성자/.test(l.text));
    if (authorLine) {
      const v = (authorLine.text.split('작성자')[1] || '').trim().split(/\s+/)[0] || null;
      fields.author = v;
      meta.author   = { value: v, raw: authorLine.text, label: '작성자', confidence: v ? 'high' : 'low' };
    }

    // 작성부서
    const deptLine = lines.find((l) => /작성부서/.test(l.text));
    if (deptLine) {
      const dept = (deptLine.text.split('작성부서')[1] || '').split('작성자')[0] || '';
      // 마지막 ">" 뒤 부서명만
      const v = (dept.split('>').pop() || '').trim() || null;
      fields.department = v;
      meta.department   = { value: v, raw: deptLine.text, label: '작성부서', confidence: v ? 'medium' : 'low' };
    }
  }

  // ── 다중 아파트(잠실형) 보정 — 풀 아파트명 + 아파트별 박람회 기간(periodDetail) ──
  {
    // 약명 괄호 그룹 (예: "(잠실래미안) / (잠실르엘)" → ["잠실래미안","잠실르엘"]) — periodDetail 라벨용
    const shortNames = [...String(meta.shortName?.raw || '').matchAll(/[(（]([^)）]+)[)）]/g)].map((x) => x[1].trim());

    // 풀 아파트명: "아래와 같이 잠실래미안 아이파크 & 잠실르엘 입주아파트를 공략"
    const introLine = lines.find((l) => /입주\s*아파트를?\s*공략/.test(l.text));
    let aptFull = [];
    if (introLine) {
      const mm = introLine.text.match(/(?:아래와\s*같이\s*)?(.+?)\s*입주\s*아파트를?\s*공략/);
      if (mm) aptFull = mm[1].split(/\s*[&·]\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
    }

    // 다중 아파트 판정은 인트로 줄의 "A & B 입주아파트를 공략" 만 신뢰
    // (약명 괄호 개수는 "(수원성중흥)/ 추가혜택 : (수원2)" 처럼 다른 필드를 잡아 오판 위험)
    const isMulti = aptFull.length >= 2;
    if (isMulti) {
      const nameSource = aptFull;
      fields.aptName = nameSource.join(' · ');
      meta.aptName   = { value: fields.aptName, raw: introLine?.text || meta.shortName?.raw, label: '입주아파트(다중)', confidence: aptFull.length >= 2 ? 'high' : 'medium' };

      // 아파트별 박람회 기간: "입주 박람회 현장 계약 혜택 : 11/22(토)~11/23(일)" N개 (중복 제거)
      const seen = new Set();
      const ranges = [];
      for (const l of lines) {
        if (!/박람회\s*현장\s*계약\s*혜택/.test(l.text)) continue;
        const mm = l.text.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:\([^)]*\))?\s*[~\-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2})/);
        if (!mm) continue;
        const key = `${mm[1]}/${mm[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ranges.push({ sM: +mm[1], sD: +mm[2], eM: +mm[3], eD: +mm[4] });
      }

      if (ranges.length >= 2) {
        const year = (fields.period?.start || meta.writeDate?.value || '').slice(0, 4) || String(new Date().getFullYear());
        const labels = shortNames.length >= ranges.length ? shortNames : nameSource;
        fields.periodDetail = ranges.map((r, i) => ({
          label: labels[i] || `아파트${i + 1}`,
          range: r.sM === r.eM ? `${r.sM}.${r.sD}~${r.eD}` : `${r.sM}.${r.sD}~${r.eM}.${r.eD}`,
        }));
        // 전체 기간 = 첫 박람회 시작 ~ 마지막 박람회 끝
        const pad = (n) => String(n).padStart(2, '0');
        const first = ranges[0], last = ranges[ranges.length - 1];
        fields.period = { start: `${year}-${pad(first.sM)}-${pad(first.sD)}`, end: `${year}-${pad(last.eM)}-${pad(last.eD)}` };
        meta.period   = { value: fields.period, raw: '아파트별 박람회 기간 종합', label: '박람회기간(다중)', confidence: 'high' };
      }
    }
  }

  return { fields, meta };
}

// CLI 진입점 — 디버그 편의
// 사용법: node extract/parsers/basic-info.js <pdf경로>
import { fileURLToPath } from 'url';
import path from 'path';
import { extractPdf } from '../extract-pdf.js';

const __thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && __thisFile === path.resolve(process.argv[1])) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node extract/parsers/basic-info.js <pdf경로>');
    process.exit(1);
  }
  const pdf = await extractPdf(path.resolve(arg));
  const { fields, meta } = await extractBasicInfo(pdf);
  console.log(`📄 ${arg}`);
  console.log('');
  console.log('=== 추출 결과 ===');
  console.log(JSON.stringify(fields, null, 2));
  console.log('');
  console.log('=== 신뢰도 ===');
  for (const [k, m] of Object.entries(meta)) {
    const sign = { high: '✅', medium: '⚠️', low: '🔴', missing: '⛔' }[m.confidence] || '?';
    const valStr = JSON.stringify(m.value);
    console.log(`${sign} ${k.padEnd(20)} ${m.confidence.padEnd(8)} ${valStr}`);
    if (m.raw && m.raw !== valStr) console.log(`     raw: ${m.raw.slice(0, 80)}`);
  }
}
