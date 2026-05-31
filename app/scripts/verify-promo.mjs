// 특별 프로모션 — 배너별 카드형/행형 토글 검증
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf');

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();

// case-b (프로모션 있음) 유도
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(350);
ok('프로모션 그리드 존재', (await p.locator('.x-banner .promo-grid').count()) === 1);
ok('기본 = 카드형(2열, --rows 아님)', (await p.locator('.x-banner .promo-grid--rows').count()) === 0);

// 프로모션 영역 클릭 → 편집 팝오버
await p.locator('.x-banner .promo-wrapper').first().click();
await p.locator('#editPopover:not(.is-hidden)').waitFor({ timeout: 3000 });
ok('표시 방식 토글 존재', (await p.locator('#promoEditor [data-promo-layout]').count()) === 2);
ok('기본 토글 = 카드형 활성', await p.locator('#promoEditor [data-promo-layout="card"].is-active').count() === 1);

// 행형으로 전환
await p.locator('#promoEditor [data-promo-layout="row"]').click();
await p.waitForTimeout(200);
ok('행형 토글 활성', await p.locator('#promoEditor [data-promo-layout="row"].is-active').count() === 1);
ok('배너 행형 적용(.promo-grid--rows)', (await p.locator('.x-banner .promo-grid--rows').count()) === 1);
const dir = await p.locator('.x-banner .promo-grid--rows .promo-card').first().evaluate((el) => getComputedStyle(el).flexDirection);
ok('행 카드 = 가로(row)', dir === 'row');
const cols = await p.locator('.x-banner .promo-grid--rows').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
ok('행형 = 1열', cols === 1);
// 행형: 태그 숨김 + 헤드라인 줄바꿈 없음
const tagDisp = await p.locator('.x-banner .promo-grid--rows .promo-tag').first().evaluate((el) => getComputedStyle(el).display);
ok('행형 태그 숨김(display:none)', tagDisp === 'none');
const hl = await p.locator('.x-banner .promo-grid--rows .promo-headline').first().evaluate((el) => ({ ws: getComputedStyle(el).whiteSpace, br: el.querySelectorAll('br').length, fs: parseFloat(getComputedStyle(el).fontSize) }));
console.log('  · headline:', JSON.stringify(hl));
ok('행형 헤드라인 줄바꿈 없음(<br> 0 + nowrap)', hl.br === 0 && hl.ws === 'nowrap');
ok('행형 헤드라인 글씨 큼(≥24px)', hl.fs >= 24);

// 배너 높이 1800 안에 (행형이 넘치지 않는지)
const h = await p.locator('.x-banner').first().evaluate((el) => el.getBoundingClientRect().height);
console.log('  · 배너 높이:', Math.round(h));
ok('행형 배너 1800px 이내', h <= 1802);

// 카드형으로 복귀
await p.locator('#promoEditor [data-promo-layout="card"]').click();
await p.waitForTimeout(200);
ok('카드형 복귀(.promo-grid--rows 제거)', (await p.locator('.x-banner .promo-grid--rows').count()) === 0);

// 배너 코랄 불변 경계
const coral = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--coral').trim());
ok('배너 코랄 --coral #E55A3D 유지', coral.toUpperCase() === '#E55A3D');

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
