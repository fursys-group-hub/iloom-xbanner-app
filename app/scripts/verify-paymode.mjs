// 결제 표시 방식 전환 검증 — 풀 카드 / 작은 카드 / 로고만 토글이 미리보기에 즉시 반영되는지
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.click('#startBlank');           // case-a (기본 결제 = 풀 카드)
await p.click('.wiz-l[data-go="payment"]');
await p.locator('#payModes .pay-mode').first().waitFor();

ok('모드 버튼 3개', (await p.locator('#payModes .pay-mode').count()) === 3);

// 기본(case-a) = 풀 카드 (point-card + 설명 card-desc 존재)
ok('기본=풀카드 (point-card)', (await p.locator('.payment .point-card').count()) === 3);
ok('풀카드 설명 있음', (await p.locator('.payment .card-desc').count()) >= 1);

// 로고만
await p.click('.pay-mode[data-mode="compact"]');
await p.waitForTimeout(150);
ok('로고만 → payment-brands-compact', (await p.locator('.payment .payment-brands-compact').count()) === 1);
ok('로고만 → point-card 없음', (await p.locator('.payment .point-card').count()) === 0);

// 작은 카드
await p.click('.pay-mode[data-mode="card_2"]');
await p.waitForTimeout(150);
ok('작은카드 → point-card.compact', (await p.locator('.payment .point-card.compact').count()) === 3);
ok('작은카드 → 설명 없음', (await p.locator('.payment .card-desc').count()) === 0);

// 풀 카드 복귀
await p.click('.pay-mode[data-mode="card_1"]');
await p.waitForTimeout(150);
ok('풀카드 복귀 → 설명 다시', (await p.locator('.payment .card-desc').count()) >= 1);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
