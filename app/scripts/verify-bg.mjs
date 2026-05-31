// 배경 사진 선택(없음/침실/쿠시노) + 배경 시 유의사항 흰색 검증
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'output');
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };
const noticeColor = () => p.evaluate(() => getComputedStyle(document.querySelector('#bannerRoot .x-banner .notices')).color);
const hasBg = () => p.evaluate(() => document.querySelector('#bannerRoot .x-banner').classList.contains('has-bg'));
const bgActive = (id) => p.locator(`#bgGroup [data-bg="${id}"].is-active`).count().then((n) => n === 1);
const bgImageOf = () => p.evaluate(() => document.querySelector('#bannerRoot .x-banner img.banner-bg')?.getAttribute('src') || '');

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();

// 1) 새로작성(case-a) — 기본 배경 없음
await p.click('#startBlank');
await p.waitForTimeout(200);
ok('case-a 기본 배경 없음', !(await hasBg()));
ok('case-a "없음" 활성', await bgActive('off'));

// 2) 침실 선택 → has-bg + 흰 유의사항
await p.click('#bgGroup [data-bg="bedroom"]');
await p.waitForTimeout(200);
ok('침실 → has-bg', await hasBg());
ok('침실 → 유의사항 흰색', (await noticeColor()) === 'rgb(255, 255, 255)');
ok('침실 활성', await bgActive('bedroom'));

// 3) 쿠시노 선택 → 배경 이미지 교체
await p.click('#bgGroup [data-bg="cushino"]');
await p.waitForTimeout(200);
ok('쿠시노 활성', await bgActive('cushino'));
ok('쿠시노 이미지로 교체', (await bgImageOf()).includes('%EC%BF%A0%EC%8B%9C%EB%85%B8'));   // '쿠시노'
ok('쿠시노도 유의사항 흰색', (await noticeColor()) === 'rgb(255, 255, 255)');

// 4) 없음 → has-bg 제거 + 유의사항 어두움
await p.click('#bgGroup [data-bg="off"]');
await p.waitForTimeout(200);
ok('없음 → has-bg 제거', !(await hasBg()));
ok('없음 → 유의사항 어두움', (await noticeColor()) !== 'rgb(255, 255, 255)');

// 5) 대구범어(case-c) — 기본 배경 ON(침실) + 흰색 + 100% 캡처
await p.click('#btnHome');
await p.setInputFiles('#pdfFile', path.join(ROOT, '참고자료', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf'));
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 }).catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
ok('case-c 기본 배경 ON', await hasBg());
ok('case-c 유의사항 흰색', (await noticeColor()) === 'rgb(255, 255, 255)');
ok('case-c 침실 활성', await bgActive('bedroom'));
await p.click('.zoom-btn[data-zoom="1"]');
await p.waitForTimeout(200);
await p.locator('#bannerRoot .x-banner').screenshot({ path: path.join(OUT, 'bg_daegu.png') });

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
