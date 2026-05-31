/**
 * 단톡방 QR A4 시안 → 고해상도 PNG 내보내기 (인쇄용 300dpi)
 *
 * 출력: 2382×3366px (A4 300dpi 비율) — 인쇄업체에 이 PNG만 전달하면 됨
 *
 * 사용법:
 *   node scripts/export-a4-png.mjs "시제품/단톡방QR_도안우미린트리쉐이드_v1.html"
 *   node scripts/export-a4-png.mjs "시제품/단톡방QR_창원롯데캐슬_v1.html"
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const inputRel = process.argv[2];
if (!inputRel) {
  console.error('사용법: node scripts/export-a4-png.mjs <HTML파일경로>');
  process.exit(1);
}

const inputAbs = path.resolve(PROJECT_ROOT, inputRel);
const html = await fs.readFile(inputAbs, 'utf8');

const parsed = path.parse(inputAbs);
const outputAbs = path.join(parsed.dir, `${parsed.name}_인쇄용.png`);

// A4 @96dpi = 794×1123px, scale 3x = 2382×3369px (≈300dpi)
const SCALE = 3;
const W = 794;
const H = 1123;

console.log('고해상도 PNG 생성 중...');
console.log(`  입력: ${inputAbs}`);

const browser = await chromium.launch();
const page = await browser.newPage();

await page.setViewportSize({ width: W, height: H });

const htmlDir = path.dirname(inputAbs).replace(/\\/g, '/');
await page.goto(`file:///${htmlDir}/`, { waitUntil: 'domcontentloaded' });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluateHandle('document.fonts.ready');
await page.waitForTimeout(1000);

let el = page.locator('.a4-sheet').first();
if ((await el.count()) === 0) {
  el = page.locator('.a4-page').first();
}
await el.screenshot({
  path: outputAbs,
  scale: 'css',
  // Playwright의 deviceScaleFactor로 고해상도 캡처
});

await browser.close();

// deviceScaleFactor로 재시도 (더 높은 해상도)
const browser2 = await chromium.launch();
const context = await browser2.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});
const page2 = await context.newPage();

await page2.goto(`file:///${htmlDir}/`, { waitUntil: 'domcontentloaded' });
await page2.setContent(html, { waitUntil: 'networkidle' });
await page2.evaluateHandle('document.fonts.ready');
await page2.waitForTimeout(1000);

let el2 = page2.locator('.a4-sheet').first();
if ((await el2.count()) === 0) {
  el2 = page2.locator('.a4-page').first();
}
await el2.screenshot({ path: outputAbs });

await browser2.close();

const stat = await fs.stat(outputAbs);
console.log('');
console.log('고해상도 PNG 생성 완료!');
console.log(`  출력: ${outputAbs}`);
console.log(`  크기: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
console.log(`  해상도: ${W * SCALE}×${H * SCALE}px (≈300dpi A4)`);
console.log('');
console.log('  → 인쇄업체에 이 PNG를 전달하면 됩니다');
console.log('  → 업체에서 도련/재단선은 자체 처리합니다');
