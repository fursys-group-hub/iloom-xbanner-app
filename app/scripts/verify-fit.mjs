// max-benefit 배너별 자동맞춤 검증 — 대구범어(여백 많음)는 키워지고, 디에이치(빽빽)는 줄되 안 넘침
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'output');
const PDFS = [
  ['대구범어(여백)', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf', 'fit_daegu.png'],
  ['디에이치(빽빽)', '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf', 'fit_dh.png'],
];
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
const errors = [];
for (const [label, file, shot] of PDFS) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.locator('.x-banner').first().waitFor();
  await p.click('#startBlank');
  await p.setInputFiles('#pdfFile', path.join(ROOT, '참고자료', file));
  await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    const banner = document.querySelector('#bannerRoot .x-banner');
    const mb = banner.querySelector('.max-benefit-main');
    const scale = getComputedStyle(banner).getPropertyValue('--mb-scale').trim();
    const fs = getComputedStyle(mb).fontSize;
    const clone = banner.cloneNode(true);
    Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
    document.body.appendChild(clone);
    const naturalH = clone.scrollHeight;
    clone.remove();
    return { scale, fs, naturalH };
  });
  const overflow = info.naturalH - 1800;
  console.log(`[${label}] --mb-scale=${info.scale} · main=${info.fs} · 콘텐츠높이=${info.naturalH}px · ${overflow > 4 ? '⚠ 넘침 ' + overflow + 'px' : '✓ 안넘침'}`);
  await p.locator('#bannerRoot .x-banner').screenshot({ path: path.join(OUT, shot) });
  await p.close();
}
await b.close();
console.log(errors.length ? '에러:' + JSON.stringify(errors) : '에러 0');
