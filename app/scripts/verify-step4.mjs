// Step 4 검증 — 동적 렌더 결과를 캡처해서 시제품 v8 PNG와 비교
// 사용법: node scripts/verify-step4.mjs

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR      = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const OUT_DIR      = path.join(APP_DIR, 'scripts', 'output');
const OUT_PNG      = path.join(OUT_DIR, 'step4_preview-dynamic.png');
const REF_PNG      = path.join(PROJECT_ROOT, '시제품', '광주데시앙_X배너_v8.png');

await fs.mkdir(OUT_DIR, { recursive: true });

const URL = 'http://localhost:3000/preview-dynamic.html';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 2000 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// 콘솔 메시지 캡처 (디버그용)
page.on('console',   (msg) => console.log('  [browser]', msg.text()));
page.on('pageerror', (err) => console.error('  [browser ERROR]', err.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 10_000 });
} catch (e) {
  console.error('❌ 어플 서버 응답 없음. localhost:3000 띄워주세요.');
  console.error('   원본 에러:', e.message);
  await browser.close();
  process.exit(1);
}

// app.js 가 비동기로 sample 받아 렌더하므로 .x-banner 가 DOM 에 추가될 때까지 기다림
try {
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
} catch (e) {
  console.error('❌ .x-banner 가 렌더되지 않았습니다. 브라우저 콘솔 로그 위 참고.');
  await browser.close();
  process.exit(2);
}

await page.waitForTimeout(500);  // 폰트 로딩 안정화

const target = page.locator('.x-banner').first();
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
console.log('✅ Step 4 캡처 완료');
console.log(`   동적 렌더 PNG: ${OUT_PNG}`);
console.log(`                  ${(stat.size / 1024).toFixed(0)}KB  ${Math.ceil(box.width) * 2}×${Math.ceil(box.height) * 2} (2x)`);
console.log('');
console.log('🆚 비교 기준');
console.log(`   시제품 PNG    : ${REF_PNG}`);
if (refStat) console.log(`                  ${(refStat.size / 1024).toFixed(0)}KB`);
console.log('');
console.log('👉 브라우저: http://localhost:3000/preview-dynamic.html');
