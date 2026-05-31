/**
 * A4 시안 → 고해상도 JPG 내보내기 (인쇄용 ~300dpi)
 *
 * 출력: 2382×3369px (A4 300dpi)
 * 셀렉터는 .a4-page 우선, 없으면 .a4-sheet 폴백
 *
 * 사용법:
 *   node scripts/export-a4-jpg.mjs "시제품/롯데바이오로직스_임직원_A4_v1.html"
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const inputRel = process.argv[2];
if (!inputRel) {
  console.error('사용법: node scripts/export-a4-jpg.mjs <HTML파일경로>');
  process.exit(1);
}

const inputAbs = path.resolve(PROJECT_ROOT, inputRel);
const html = await fs.readFile(inputAbs, 'utf8');

const parsed = path.parse(inputAbs);
const outputAbs = path.join(parsed.dir, `${parsed.name}_인쇄용.jpg`);

const SCALE = 3;
const W = 794;
const H = 1123;

console.log('고해상도 JPG 생성 중...');
console.log(`  입력: ${inputAbs}`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});
const page = await context.newPage();

const htmlDir = path.dirname(inputAbs).replace(/\\/g, '/');
await page.goto(`file:///${htmlDir}/`, { waitUntil: 'domcontentloaded' });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluateHandle('document.fonts.ready');
await page.waitForTimeout(1000);

let el = page.locator('.a4-page').first();
if ((await el.count()) === 0) {
  el = page.locator('.a4-sheet').first();
}

await el.screenshot({
  path: outputAbs,
  type: 'jpeg',
  quality: 95,
});

await browser.close();

const stat = await fs.stat(outputAbs);
console.log('');
console.log('고해상도 JPG 생성 완료!');
console.log(`  출력: ${outputAbs}`);
console.log(`  크기: ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
console.log(`  해상도: ${W * SCALE}×${H * SCALE}px (≈300dpi A4)`);
