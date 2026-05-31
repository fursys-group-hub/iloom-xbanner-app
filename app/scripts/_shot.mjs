import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf');
const OUT = path.join(__dirname, 'output');
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.click('#startBlank');
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(OUT, 'ux_light_basic.png') });
// 교대역 업로드 → 프로모션 단계 (사용자 원본 스크린샷과 같은 뷰)
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(()=>{});
await p.click('.wiz-l[data-go="promo"]');
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'ux_light_promo.png') });
// 완료 단계 (요약 + 경고)
await p.click('.wiz-l[data-go="done"]');
await p.waitForTimeout(300);
await p.screenshot({ path: path.join(OUT, 'ux_light_done.png') });
await b.close();
console.log('shots saved');
