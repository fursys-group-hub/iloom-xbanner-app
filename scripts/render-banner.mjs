// 인쇄용 시제품 HTML → PNG 렌더링 (X배너 / A4 단톡방 QR / A4 프로모션 안내 공용)
// 사용법: node scripts/render-banner.mjs <HTML파일경로>
// 예시:
//   node scripts/render-banner.mjs 시제품/광주데시앙_X배너_v1.html
//   node scripts/render-banner.mjs 시제품/단톡방QR_도안우미린트리쉐이드_v1.html
//
// 자동 감지: 페이지 안에서 .x-banner / .a4-sheet 셀렉터를 찾아 본체만 캡처.

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('사용법: node scripts/render-banner.mjs <HTML파일경로>');
  process.exit(1);
}

const htmlRel = args[0];
const htmlAbs = path.resolve(PROJECT_ROOT, htmlRel);
const outPng = htmlAbs.replace(/\.html$/i, '.png');

await fs.access(htmlAbs);
console.log(`📥 입력: ${htmlAbs}`);

const browser = await chromium.launch({ headless: true });
// 시제품 본체 후보 셀렉터 (등록 순서대로 시도)
const CANDIDATES = ['.x-banner', '.a4-sheet'];

// 1차 viewport는 넉넉히 잡고, 본체 크기 측정 후 viewport 재설정
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 2000 },
  deviceScaleFactor: 2,  // 인쇄용 고해상도
});
const page = await ctx.newPage();

// file:// URL로 로드
const fileUrl = 'file:///' + htmlAbs.replace(/\\/g, '/');
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);  // 폰트 로딩 대기

// 본체 셀렉터 자동 감지
let target = null;
let targetSel = null;
for (const sel of CANDIDATES) {
  const loc = page.locator(sel).first();
  if (await loc.count()) {
    target = loc;
    targetSel = sel;
    break;
  }
}
if (!target) {
  console.error(`❌ 본체 셀렉터를 못 찾았습니다. (${CANDIDATES.join(', ')} 중 하나 필요)`);
  await browser.close();
  process.exit(2);
}

// 본체 실제 크기 측정 후 viewport 재조정 (스크롤바·여백 영향 제거)
const box = await target.boundingBox();
if (box) {
  await page.setViewportSize({
    width: Math.ceil(box.width) + 40,
    height: Math.ceil(box.height) + 40,
  });
  await page.waitForTimeout(100);
}

await target.screenshot({ path: outPng, omitBackground: false });

await browser.close();

const stat = await fs.stat(outPng);
const w = box ? Math.ceil(box.width) * 2 : '?';
const h = box ? Math.ceil(box.height) * 2 : '?';
console.log(`✅ 렌더링 완료: ${outPng}`);
console.log(`   셀렉터: ${targetSel}`);
console.log(`   크기: ${(stat.size / 1024).toFixed(0)}KB`);
console.log(`   해상도: ${w}×${h} (2x 스케일 — 인쇄용 고해상도)`);
