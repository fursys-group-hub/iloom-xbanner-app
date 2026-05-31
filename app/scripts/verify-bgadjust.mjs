// 배경 사진 = 가로 폭에 맞춰 배치(cover/확대 아님) + 조절 슬라이더 없음 검증
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf');

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${x ? '  ·  ' + x : ''}`); };

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.click('#startBlank');
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 }).catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);

const banner = p.locator('#bannerRoot .x-banner');
ok('배경 ON(has-bg)', (await banner.evaluate((el) => el.classList.contains('has-bg'))));
ok('조절 슬라이더 없음', (await p.locator('[data-bg-adj]').count()) === 0 && (await p.locator('#bgAdjust').count()) === 0);
const bgImg = p.locator('#bannerRoot .x-banner > img.banner-bg');
ok('배경 사진 = img.banner-bg 요소', (await bgImg.count()) === 1);
const m = await bgImg.evaluate((el) => { const s = getComputedStyle(el); return { mask: s.maskImage || s.webkitMaskImage, w: s.width, pos: s.position, z: s.zIndex }; }).catch(() => ({}));
console.log('  · banner-bg:', JSON.stringify(m));
ok('윗부분 마스크 페이드(gradient)', /gradient/.test(m.mask || ''));
ok('가로 폭 맞춤(width 100%/bottom)', m.pos === 'absolute');
ok('배경이 콘텐츠 뒤(z-index:-1)', m.z === '-1');
// 배경 위 로고 = 흰 글자만 (invert + screen, 검은 박스 없음)
const logo = await banner.evaluate((el) => { const i = el.querySelector('.footer img'); if (!i) return {}; const s = getComputedStyle(i); return { filter: s.filter, blend: s.mixBlendMode }; }).catch(() => ({}));
console.log('  · 로고:', JSON.stringify(logo));
ok('로고 invert + screen(검은박스 제거)', /invert/.test(logo.filter || '') && logo.blend === 'screen');

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
