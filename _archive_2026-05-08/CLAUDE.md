# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

일룸 X배너(600×1800px) 웹 에디터. 텍스트·표를 실시간 편집하고 PNG/PDF로 내보낸다.

---

## 실행

```bash
npm install        # 최초 1회 (puppeteer 포함)
node server.js     # http://localhost:3000
node --watch server.js  # 개발 중 자동 재시작
```

서버 없이 `index.html`을 직접 브라우저(`file://`)로 열어도 에디터 동작 — PNG 내보내기만 html2canvas 폴백으로 가능 (품질 낮음).

---

## 에디터 UI 구조 (index.html)

```
.app
├── aside.editor-panel     ← 왼쪽: 입력 패널
└── main.preview-area      ← 오른쪽: 실시간 미리보기
    └── .preview-scroll
        └── .preview-wrapper
            └── #bannerContainer   ← JS가 배너 HTML 주입
```

### 에디터 패널 섹션 → 필드 ID 매핑

| 섹션 | 입력 필드 ID | 설명 |
|------|-------------|------|
| 헤더 정보 | `#aptName`, `#mainTitle`, `#period` | 아파트명, 프로모션 제목, 기간 |
| 매장 정보 | `#locationName1`, `#locationName2` | 매장명 2개 (CSS 테두리 프레임 박스) |
| 혜택 소개 | `#descBefore`, `#descHighlight`, `#descAfter` | 위 문구 / 강조(굵게) / 아래 문구 — 3필드 |
| 구매금액대별 혜택 | `#tableHead`, `#tableRows` | 동적 표. `+ 열` / `+ 행` 버튼 |
| 결제 수단 안내 | `#paySubtitle`, `#payMicroText` | textarea 2개 |
| 유의사항 | `#notice` | textarea |
| 내보내기 | `#exportPng`, `#exportPdf` | PNG / PDF 다운로드 버튼 |

---

## 파일별 역할

| 파일 | 역할 |
|------|------|
| `index.html` | 에디터 UI 뼈대. 외부 CDN(Pretendard, DM Mono, html2canvas) + JS 로드 순서: templates.js → app.js |
| `app.js` | 상태 관리, 이벤트 바인딩, 미리보기 실시간 업데이트, 줌 컨트롤 |
| `templates.js` | `renderBanner(templateId, state)` — 배너 HTML 생성. `escHtml()` 유틸 포함 |
| `server.js` | Express 서버. `/api/export/pdf`, `/api/export/png`. `buildFullHtml()`이 style.css 인라인 삽입 |
| `style.css` | 에디터 UI (다크 테마, `.editor-*`, `.field-*`, `.tbl-*`) + 배너 내부 (`.il-` prefix) |
| `banner.html` | 원본 디자인 레퍼런스 (편집 불필요) |

---

## 미리보기 스케일 로직 (app.js)

```js
// getAutoScale(): 미리보기 너비 기반 자동 스케일
const availW = previewArea.offsetWidth - 64;  // 32px 패딩 × 2
return Math.max(availW / 600, 0.3);

// updateBanner(): fitScale × viewScale 합산
// fitScale: 콘텐츠가 600×1800 초과할 때 축소
// viewScale: previewZoom(사용자 수동) 또는 getAutoScale()
inner.style.transform = `scale(${fitScale * viewScale})`;
container.style.width  = `${600  * viewScale}px`;
container.style.height = `${1800 * viewScale}px`;
```

**주의**: `transform: scale()`은 시각적 확대만 — 레이아웃에 영향 없음. `.banner-inner`와 `.banner-template-iloom`은 같은 div에 붙은 두 클래스 (별개 엘리먼트 아님).

---

## 내보내기 플로우

- **PDF**: POST `/api/export/pdf` → Puppeteer `waitUntil: 'networkidle0'` → `600mm × 1800mm` (인쇄소 납품용)
- **PNG**: POST `/api/export/png` → Puppeteer `scale: 3` → 1800×5400px
- **PNG 폴백**: 서버 없을 때 클라이언트 `html2canvas` (품질 낮음, PDF 불가)

---

## CSS 구조 주의사항

- `.tbl-head`, `.tbl-row`의 `grid-template-columns`: CSS 없음 — JS `inline style`로 `repeat(N, 1fr) 28px` 동적 설정
- `.il-table th:last-child` / `td:last-child`: 총혜택 열 강조 (레드 헤더, 굵은 빨간 텍스트) — 열 수 무관하게 항상 마지막 열에 적용
- 에디터 UI 클래스(`.editor-*`, `.field-*`, `.preview-*`, `.zoom-*`, `.loading-*`)와 배너 클래스(`.il-*`)가 **같은 style.css** 파일에 공존
