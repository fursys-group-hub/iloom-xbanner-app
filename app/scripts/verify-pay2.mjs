// 결제 포인트 1~2개 중앙정렬 + 제목 편집 검증
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };

const measure = () => p.evaluate(() => {
  const wrap = document.querySelector('#bannerRoot .x-banner .payment-brands');
  if (!wrap) return null;
  const cards = [...wrap.querySelectorAll('.point-card')];
  const w = wrap.getBoundingClientRect();
  const f = cards[0].getBoundingClientRect();
  const l = cards[cards.length - 1].getBoundingClientRect();
  return { n: cards.length, leftGap: f.left - w.left, rightGap: w.right - l.right, jc: getComputedStyle(wrap).justifyContent };
});

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.click('#startBlank');                       // case-a, 풀 카드 3개
await p.click('.wiz-l[data-go="payment"]');
await p.locator('#payModes .pay-mode').first().waitFor();

ok('justify-content center', (await measure())?.jc === 'center');

// 2개 — ssgpay 해제
await p.uncheck('input[data-pt="ssgpay"]');
await p.waitForTimeout(150);
let m = await measure();
ok('포인트 2개', m.n === 2);
ok('2개 가운데 정렬(좌우 여백 동일)', Math.abs(m.leftGap - m.rightGap) < 2);

// 1개 — lpoint 도 해제
await p.uncheck('input[data-pt="lpoint"]');
await p.waitForTimeout(150);
m = await measure();
ok('포인트 1개', m.n === 1);
ok('1개 가운데 정렬(좌우 여백 동일)', Math.abs(m.leftGap - m.rightGap) < 2);

// 제목 편집
await p.fill('#f_payTitle', '테스트 결제 제목');
await p.waitForTimeout(150);
const title = await p.evaluate(() => document.querySelector('#bannerRoot .x-banner .payment-title')?.textContent.trim());
ok('제목 편집 → 미리보기 반영', title === '테스트 결제 제목');

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
