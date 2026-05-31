/**
 * X배너 시안 → 인쇄용 벡터 PDF 내보내기
 *
 * 벡터 PDF: 텍스트·도형이 벡터로 유지되어 아무리 확대해도 깨지지 않음.
 * 인쇄업체에 "600×1800mm 실물 크기로 출력" 요청하면 됨.
 *
 * 사용법:
 *   node scripts/export-xbanner-pdf.mjs "시제품/도안우미린트리쉐이드_X배너_v14.html"
 *   node scripts/export-xbanner-pdf.mjs "시제품/창원롯데캐슬_X배너_v12.html"
 *
 * 출력: 같은 폴더에 _인쇄용.pdf 파일 생성
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const inputRel = process.argv[2];
if (!inputRel) {
  console.error('사용법: node scripts/export-xbanner-pdf.mjs <HTML파일경로>');
  console.error('예시:   node scripts/export-xbanner-pdf.mjs "시제품/도안우미린트리쉐이드_X배너_v14.html"');
  process.exit(1);
}

const inputAbs = path.resolve(PROJECT_ROOT, inputRel);
const html = await fs.readFile(inputAbs, 'utf8');

const parsed = path.parse(inputAbs);
const outputAbs = path.join(parsed.dir, `${parsed.name}_인쇄용.pdf`);

// ── 원본 <style> 블록 추출 ──
function extractStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1] : '';
}

// ── 원본 .x-banner 블록 추출 ──
function extractBanner(html) {
  const startTag = '<div class="x-banner">';
  const startIdx = html.indexOf(startTag);
  if (startIdx === -1) throw new Error('.x-banner를 찾을 수 없습니다');
  const bodyEnd = html.lastIndexOf('</body>');
  return html.substring(startIdx, bodyEnd).trim().replace(/\s*<\/div>\s*$/, '') + '</div>';
}

function buildPrintHtml(html) {
  const originalStyle = extractStyle(html);
  const banner = extractBanner(html);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <style>
    @page {
      size: 600px 1800px;
      margin: 0;
    }

    ${originalStyle}

    /* 인쇄용 오버라이드 */
    html, body {
      background: #FFF5EE !important;
      padding: 0 !important;
      margin: 0 !important;
      display: block !important;
      width: 600px !important;
      height: 1800px !important;
      overflow: hidden !important;
    }
    .x-banner {
      box-shadow: none !important;
    }
  </style>
</head>
<body>
  ${banner}
</body>
</html>`;
}

console.log('X배너 인쇄용 PDF 생성 중...');
console.log(`  입력: ${inputAbs}`);

const printHtml = buildPrintHtml(html);

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: 600, height: 1800 });

const htmlDir = path.dirname(inputAbs).replace(/\\/g, '/');
await page.goto(`file:///${htmlDir}/`, { waitUntil: 'domcontentloaded' });
await page.setContent(printHtml, { waitUntil: 'networkidle' });
await page.evaluateHandle('document.fonts.ready');
await page.waitForTimeout(1500);

// preferCSSPageSize: true → @page { size: 600px 1800px } 그대로 사용
// 벡터 PDF이므로 인쇄업체에서 600×1800mm로 확대해도 깨지지 않음
const pdfBuffer = await page.pdf({
  preferCSSPageSize: true,
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});

await browser.close();
await fs.writeFile(outputAbs, pdfBuffer);

const stat = await fs.stat(outputAbs);
console.log('');
console.log('X배너 인쇄용 PDF 생성 완료!');
console.log(`  출력: ${outputAbs}`);
console.log(`  크기: ${(stat.size / 1024).toFixed(0)}KB`);
console.log('');
console.log('인쇄 사양:');
console.log('  형식: 벡터 PDF (텍스트·도형 확대해도 선명)');
console.log('  실물 출력 크기: 600mm × 1800mm');
console.log('  도련: 없음 (X배너는 프레임 방식이라 불필요)');
console.log('');
console.log('  → 인쇄업체에 이 PDF + "600×1800mm 출력" 요청하면 됩니다');
console.log('  → 벡터이므로 확대해도 깨지지 않습니다');
