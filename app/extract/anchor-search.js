// 닻 라벨 + 동의어사전 검색 유틸
//
// 추출 전략:
//  1. 동의어사전.json 로드
//  2. 모든 페이지의 lines 를 한 배열로 평탄화
//  3. 라벨 키(예: "아파트명") 받아 동의어 목록을 가져옴
//  4. 동의어 중 하나가 line.text 의 prefix 또는 등장 위치 기준으로 매칭되는 첫 line 반환
//  5. 매칭 시 라벨 prefix 를 자른 "값 텍스트" 도 함께 반환

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR      = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const DICT_PATH    = path.join(PROJECT_ROOT, '어플_설계', '동의어사전.json');

let _dict;
export async function loadDictionary() {
  if (_dict) return _dict;
  const raw = await fs.readFile(DICT_PATH, 'utf8');
  _dict = JSON.parse(raw);
  return _dict;
}

// 모든 페이지의 lines 를 한 배열로
export function flattenLines(pdf) {
  const out = [];
  for (const page of pdf.pages) {
    for (const line of page.lines) {
      out.push({ ...line, pageNumber: page.pageNumber });
    }
  }
  return out;
}

// 라벨 prefix 매칭 ("아파트명 한화포레나..." 처럼 줄 시작이 라벨)
// + 라벨 prefix 길이만큼 떼서 "값 텍스트" 반환
// 매칭 우선순위: 라벨 배열 순서대로 (가장 정확한 라벨이 앞에 와야 함)
export function findByLabels(lines, labels, opts = {}) {
  const { allowInline = true, minRest = 0 } = opts;
  for (const label of labels) {
    for (const line of lines) {
      const text = line.text || '';

      // 1) 줄 시작 prefix 매칭
      if (text.startsWith(label)) {
        const rest = text.slice(label.length).trim();
        if (rest.length >= minRest) {
          return { line, label, value: rest, mode: 'prefix' };
        }
      }

      // 2) inline (가운데 등장) 매칭 — "문서번호 ... 작성일 YYYY-MM-DD" 같은 케이스
      if (allowInline) {
        const idx = text.indexOf(label);
        if (idx > 0) {
          // 라벨 앞에 다른 라벨이 있어도 OK — 라벨 뒤 텍스트만 반환
          const rest = text.slice(idx + label.length).trim();
          if (rest.length >= minRest) {
            return { line, label, value: rest, mode: 'inline' };
          }
        }
      }
    }
  }
  return null;
}

// 동의어사전의 키(예: '아파트명') 로 검색 — 동의어 목록 자동 조회
export async function searchField(lines, fieldKey, opts = {}) {
  const dict = await loadDictionary();
  const labels = dict.필드별_라벨?.[fieldKey] || [];
  if (!labels.length) {
    return { ok: false, reason: `사전에 라벨 없음: ${fieldKey}` };
  }
  const found = findByLabels(lines, labels, opts);
  if (!found) return { ok: false, reason: `라벨 매칭 실패: ${fieldKey}` };
  return { ok: true, ...found, fieldKey };
}

// 신뢰도 판정 — 매칭 모드와 부수 정보로 high/medium/low 결정
// value 는 문자열/숫자/객체/배열 어떤 형태든 OK ("결과 있음" 만 판단)
export function confidenceFor(found, value) {
  if (!found) return 'missing';
  const hasValue = (() => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value))      return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  })();
  if (!hasValue) return 'low';
  if (found.mode === 'prefix') return 'high';
  if (found.mode === 'inline') return 'medium';
  return 'low';
}
