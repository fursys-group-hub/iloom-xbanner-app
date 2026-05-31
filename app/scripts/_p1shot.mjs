import { chromium } from 'playwright';
import path from 'path'; import { fileURLToPath } from 'url';
const __d = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__d, 'output');
const PDF_C = path.join(__d, '..', '..', '참고자료', '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf');
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.setInputFiles('#pdfFile', PDF_C);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 });
await p.waitForTimeout(400);
// 제품 카드 클릭 → 카드 편집기
await p.locator('.x-banner .product-card').first().click();
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(OUT, 'p1_1_cardedit.png') });
// 사진 피커 열기
await p.click('#cardPanelBody [data-imgpick]');
await p.locator('#imgPicker:not(.is-hidden)').waitFor();
await p.waitForTimeout(500);
await p.screenshot({ path: path.join(OUT, 'p1_2_imgpicker.png') });
await b.close();
console.log('p1 shots done');
