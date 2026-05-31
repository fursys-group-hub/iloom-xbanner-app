// 혜택표 — 열 추가/삭제 검증 (새 열은 총 혜택 앞, 최소 2열)
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
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.click('#startBlank');
await p.waitForTimeout(250);

// 혜택표 편집 팝오버 열기
await p.locator('.x-banner .table-wrapper').first().click();
await p.locator('#editPopover:not(.is-hidden)').waitFor({ timeout: 3000 });

const headCount = () => p.locator('#tableEditor .te-head').count();
const thCount = () => p.locator('.x-banner table.benefit-table thead th').count();
const lastLabel = () => p.locator('.x-banner table.benefit-table thead th').last().textContent();

const n0 = await headCount();
const th0 = await thCount();
console.log('  · 초기 열:', n0, '/ 배너 th:', th0);
ok('초기 열 ≥ 3', n0 >= 3);
ok('편집기 열 = 배너 열', n0 === th0);
ok('열 삭제 버튼 존재', (await p.locator('#tableEditor .te-coldel').count()) === n0);
const totalBefore = (await lastLabel()).trim();

// + 열 추가
await p.click('#btnAddCol');
await p.waitForTimeout(200);
ok('열 +1 (편집기)', (await headCount()) === n0 + 1);
ok('열 +1 (배너)', (await thCount()) === th0 + 1);
ok('총 혜택 열은 여전히 맨 오른쪽', (await lastLabel()).trim() === totalBefore);
// 새 열 라벨 "새 혜택"이 끝에서 두 번째
const labels = await p.locator('.x-banner table.benefit-table thead th').allTextContents();
ok('새 열이 총 혜택 바로 앞', labels[labels.length - 2].includes('새 혜택'));

// 열 삭제 (방금 추가한 새 열 = 인덱스 n0 - ... 총 앞). 새 열의 te-coldel 클릭
await p.locator(`#tableEditor .te-coldel[data-col="${n0 - 1}"]`).click();
await p.waitForTimeout(200);
ok('열 삭제 → 원래 수', (await headCount()) === n0);

// 최소 2열 가드 — 2열 될 때까지 삭제 시도 후 한 번 더
let guard = '';
p.once('dialog', () => {});
const cur = await headCount();
for (let i = 0; i < cur - 2; i++) { await p.locator('#tableEditor .te-coldel[data-col="0"]').click(); await p.waitForTimeout(120); }
ok('2열까지 삭제됨', (await headCount()) === 2);
await p.locator('#tableEditor .te-coldel[data-col="0"]').click();
await p.waitForTimeout(200);
ok('2열에서 삭제 막힘(최소 2 유지)', (await headCount()) === 2);
ok('가드 토스트(err)', (await p.locator('#uiToast.toast--err').count()) === 1);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
