// 비교 페이지 렌더링 (가로로 두 배너 나란히)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const htmlRel = args[0];
const htmlAbs = path.resolve(PROJECT_ROOT, htmlRel);
const outPng = htmlAbs.replace(/\.html$/i, '.png');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 1620 },
  deviceScaleFactor: 1.5,
});
const page = await ctx.newPage();
const fileUrl = 'file:///' + htmlAbs.replace(/\\/g, '/');
await page.goto(fileUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: outPng, fullPage: true });
await browser.close();
console.log(`✅ ${outPng}`);
