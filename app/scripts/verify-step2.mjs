// Step 2 검증 — 어플 정적 프리뷰 (banner.css 외부 추출본) → PNG 캡처
// 시제품/광주데시앙_X배너_v8.png 와 픽셀 비교용
//
// 사용법: (npm run start로 서버 띄운 상태에서)
//   node scripts/verify-step2.mjs

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR      = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const OUT_DIR      = path.join(APP_DIR, 'scripts', 'output');
const OUT_PNG      = path.join(OUT_DIR, 'step2_preview-static.png');
const REF_PNG      = path.join(PROJECT_ROOT, '시제품', '광주데시앙_X배너_v8.png');

await fs.mkdir(OUT_DIR, { recursive: true });

const URL = 'http://localhost:3000/preview-static.html';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 720, height: 2000 },
  deviceScaleFactor: 2,  // 시제품 PNG와 같은 2x 고해상도
});
const page = await ctx.newPage();

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 10_000 });
} catch (e) {
  console.error('❌ 어플 서버 응답 없음. localhost:3000 띄워주세요. (cd app && npm start)');
  console.error('   원본 에러:', e.message);
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(500);  // 폰트 로딩 안정화

const target = page.locator('.x-banner').first();
if (!await target.count()) {
  console.error('❌ .x-banner 셀렉터를 못 찾았습니다.');
  await browser.close();
  process.exit(2);
}

const box = await target.boundingBox();
if (box) {
  await page.setViewportSize({
    width:  Math.ceil(box.width)  + 40,
    height: Math.ceil(box.height) + 40,
  });
  await page.waitForTimeout(100);
}

await target.screenshot({ path: OUT_PNG, omitBackground: false });
await browser.close();

const stat = await fs.stat(OUT_PNG);
const refStat = await fs.stat(REF_PNG).catch(() => null);

console.log('');
console.log('✅ Step 2 캡처 완료');
console.log(`   어플 PNG : ${OUT_PNG}`);
console.log(`             ${(stat.size / 1024).toFixed(0)}KB  ${Math.ceil(box.width) * 2}×${Math.ceil(box.height) * 2} (2x)`);
console.log('');
console.log('🆚 비교 기준');
console.log(`   시제품 PNG: ${REF_PNG}`);
if (refStat) {
  console.log(`             ${(refStat.size / 1024).toFixed(0)}KB`);
} else {
  console.log('             (없음)');
}
console.log('');
console.log('👉 두 PNG를 옆에 띄워 비교하세요 — 안티앨리어싱 외 차이 0 이면 합격.');
