import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'output');
const PDF_B = path.join(ROOT, '참고자료', '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf');
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.x-banner').first().waitFor();
// 1) 새로작성 기본 편집 화면
await page.click('#startBlank');
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'p0_1_default.png') });
// 2) 영역 클릭 → 팝오버
await page.locator('.x-banner .table-wrapper').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'p0_2_popover.png') });
await page.keyboard.press('Escape');
// 3) case-b 업로드 → 검수리스트 + 형광
await page.setInputFiles('#pdfFile', PDF_B);
await page.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'p0_3_caseb_review.png') });
await browser.close();
console.log('shots done');
