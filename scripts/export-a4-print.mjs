/**
 * 단톡방 QR A4 시안 → 인쇄용 PDF 내보내기
 *
 * 인쇄 사양:
 *   - A4 (210×297mm) + 도련(bleed) 3mm 사방 = 216×303mm
 *   - 재단선(trim mark) 4개 코너
 *   - 배경이 도련 영역까지 확장 (재단 후 흰 테두리 방지)
 *
 * 사용법:
 *   node scripts/export-a4-print.mjs "시제품/단톡방QR_도안우미린트리쉐이드_v1.html"
 *   node scripts/export-a4-print.mjs "시제품/단톡방QR_창원롯데캐슬_v1.html"
 *
 * 출력: 같은 폴더에 _인쇄용.pdf 파일 생성
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── 인쇄 사양 (mm) ──
const BLEED = 3;
const A4_W = 210;
const A4_H = 297;
const TOTAL_W = A4_W + BLEED * 2;  // 216mm
const TOTAL_H = A4_H + BLEED * 2;  // 303mm

// px 환산 (96dpi 기준: 1mm ≈ 3.7795px)
const MM_TO_PX = 3.7795;
const BLEED_PX = Math.round(BLEED * MM_TO_PX);     // ~11px
const A4_W_PX = 794;   // 210mm @96dpi
const A4_H_PX = 1123;  // 297mm @96dpi
const TOTAL_W_PX = A4_W_PX + BLEED_PX * 2;  // ~816px
const TOTAL_H_PX = A4_H_PX + BLEED_PX * 2;  // ~1145px

// ── 입력 파일 확인 ──
const inputRel = process.argv[2];
if (!inputRel) {
  console.error('사용법: node scripts/export-a4-print.mjs <HTML파일경로>');
  console.error('예시:   node scripts/export-a4-print.mjs "시제품/단톡방QR_도안우미린트리쉐이드_v1.html"');
  process.exit(1);
}

const inputAbs = path.resolve(PROJECT_ROOT, inputRel);
const htmlContent = await fs.readFile(inputAbs, 'utf8');

const parsed = path.parse(inputAbs);
const outputAbs = path.join(parsed.dir, `${parsed.name}_인쇄용.pdf`);

// ── 원본 HTML에서 .a4-sheet 블록 추출 ──
function extractA4Sheet(html) {
  const startTag = '<div class="a4-sheet">';
  const startIdx = html.indexOf(startTag);
  if (startIdx === -1) throw new Error('.a4-sheet를 찾을 수 없습니다');
  const bodyEnd = html.lastIndexOf('</body>');
  return html.substring(startIdx, bodyEnd).trim().replace(/\s*<\/div>\s*$/, '') + '</div>';
}

// ── 원본 <style> 블록 추출 ──
function extractStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : '';
}

// ── 인쇄용 HTML 생성: 원본 스타일+콘텐츠를 그대로 쓰고, 도련+재단선만 래핑 ──
function buildPrintHtml(html) {
  const originalStyle = extractStyle(html);
  const a4Sheet = extractA4Sheet(html);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    @page {
      size: ${TOTAL_W}mm ${TOTAL_H}mm;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      width: ${TOTAL_W_PX}px;
      height: ${TOTAL_H_PX}px;
      background: #FFF5EE;
      overflow: hidden;
    }

    body {
      font-family: 'Pretendard', sans-serif;
      -webkit-font-smoothing: antialiased;
      padding: 0;
      display: block;
    }

    /* 전체 페이지 (도련 포함) */
    .print-page {
      position: relative;
      width: ${TOTAL_W_PX}px;
      height: ${TOTAL_H_PX}px;
    }

    /* 도련 배경: 크림색을 가장자리까지 확장 */
    .bleed-bg {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #FFF5EE;
    }

    /* 재단선 */
    .tm { position: absolute; background: #000; }
    .tm-tl-h { top: ${BLEED_PX}px; left: 0; width: ${BLEED_PX - 2}px; height: 0.5px; }
    .tm-tl-v { top: 0; left: ${BLEED_PX}px; width: 0.5px; height: ${BLEED_PX - 2}px; }
    .tm-tr-h { top: ${BLEED_PX}px; right: 0; width: ${BLEED_PX - 2}px; height: 0.5px; }
    .tm-tr-v { top: 0; right: ${BLEED_PX}px; width: 0.5px; height: ${BLEED_PX - 2}px; }
    .tm-bl-h { bottom: ${BLEED_PX}px; left: 0; width: ${BLEED_PX - 2}px; height: 0.5px; }
    .tm-bl-v { bottom: 0; left: ${BLEED_PX}px; width: 0.5px; height: ${BLEED_PX - 2}px; }
    .tm-br-h { bottom: ${BLEED_PX}px; right: 0; width: ${BLEED_PX - 2}px; height: 0.5px; }
    .tm-br-v { bottom: 0; right: ${BLEED_PX}px; width: 0.5px; height: ${BLEED_PX - 2}px; }

    /* 콘텐츠 영역: 도련 안쪽에 원본 크기 그대로 배치 */
    .content-area {
      position: absolute;
      top: ${BLEED_PX}px;
      left: ${BLEED_PX}px;
      width: ${A4_W_PX}px;
      height: ${A4_H_PX}px;
      overflow: hidden;
    }

    /* ===== 원본 스타일 (px 단위 그대로) ===== */
    ${originalStyle}

    /* 인쇄용 오버라이드: 원본 body/html 스타일 무효화 */
    html, body {
      background: #FFF5EE !important;
      padding: 0 !important;
      display: block !important;
      width: ${TOTAL_W_PX}px !important;
      height: ${TOTAL_H_PX}px !important;
    }
    .a4-sheet {
      box-shadow: none !important;
      width: ${A4_W_PX}px !important;
      height: ${A4_H_PX}px !important;
    }
  </style>
</head>
<body>
  <div class="print-page">
    <div class="bleed-bg"></div>

    <!-- 재단선 -->
    <div class="tm tm-tl-h"></div><div class="tm tm-tl-v"></div>
    <div class="tm tm-tr-h"></div><div class="tm tm-tr-v"></div>
    <div class="tm tm-bl-h"></div><div class="tm tm-bl-v"></div>
    <div class="tm tm-br-h"></div><div class="tm tm-br-v"></div>

    <!-- 원본 콘텐츠 (px 단위 그대로) -->
    <div class="content-area">
      ${a4Sheet}
    </div>
  </div>
</body>
</html>`;
}

// ── Playwright PDF 생성 ──
console.log('인쇄용 PDF 생성 중...');
console.log(`  입력: ${inputAbs}`);

const printHtml = buildPrintHtml(htmlContent);

const browser = await chromium.launch();
const page = await browser.newPage();

// 리소스(QR SVG, 로고) 경로 해석을 위해 file:// base URL 설정
const htmlDir = path.dirname(inputAbs).replace(/\\/g, '/');
await page.goto(`file:///${htmlDir}/`, { waitUntil: 'domcontentloaded' });
await page.setContent(printHtml, { waitUntil: 'networkidle' });

await page.evaluateHandle('document.fonts.ready');
await page.waitForTimeout(1000);

const pdfBuffer = await page.pdf({
  width: `${TOTAL_W}mm`,
  height: `${TOTAL_H}mm`,
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});

await browser.close();
await fs.writeFile(outputAbs, pdfBuffer);

const stat = await fs.stat(outputAbs);
console.log('');
console.log('인쇄용 PDF 생성 완료!');
console.log(`  출력: ${outputAbs}`);
console.log(`  크기: ${(stat.size / 1024).toFixed(0)}KB`);
console.log('');
console.log('인쇄 사양:');
console.log(`  재단 크기: ${A4_W}×${A4_H}mm (A4)`);
console.log(`  도련 포함: ${TOTAL_W}×${TOTAL_H}mm (+${BLEED}mm 사방)`);
console.log('  재단선: 4코너 표시');
console.log('  → 이 파일을 인쇄업체에 그대로 전달하면 됩니다');
