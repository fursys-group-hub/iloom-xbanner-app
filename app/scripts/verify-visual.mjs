// 시각화 강화 검증 — 아이콘/체크, 모달 상태 아이콘, spec-list 통일, 로딩·완료 상태
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf');

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
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

// ── 완료 신호에 그린 체크 아이콘 ──
ok('완료 신호 아이콘(svg)', (await p.locator('#exportStatus svg.icon').count()) === 1);
const esIcoColor = await p.locator('#exportStatus svg.icon').evaluate((el) => getComputedStyle(el).color).catch(() => '');
ok('완료 신호 아이콘 = 그린', esIcoColor === 'rgb(62, 124, 75)');

// ── 다운로드 버튼·복사 버튼에 아이콘 ──
ok('PNG 버튼 아이콘', (await p.locator('#btnPng2 svg.icon').count()) === 1);
ok('PDF 버튼 아이콘', (await p.locator('#btnPdf2 svg.icon').count()) === 1);
ok('발주서 복사 아이콘', (await p.locator('#btnOrderCopy svg.icon').count()) === 1);
ok('닫기(편집 팝오버) 아이콘', (await p.locator('#btnEditClose svg.icon').count()) === 1);

// ── spec-list 통일: 요약·발주 행이 모두 .spec-row ──
const doneSpec = await p.locator('#doneSummary .spec-row.done-row').count();
ok('요약 행 = .spec-row', doneSpec >= 4);
await p.evaluate(() => document.querySelector('.order-spec-wrap')?.setAttribute('open', ''));
await p.waitForTimeout(120);
const orderSpec = await p.locator('#orderAuto .spec-row.order-row').count();
ok('발주 행 = .spec-row', orderSpec >= 4);
const dPad = await p.locator('#doneSummary .spec-row').first().evaluate((el) => getComputedStyle(el).padding);
const oPad = await p.locator('#orderAuto .spec-row').first().evaluate((el) => getComputedStyle(el).padding);
console.log('  · padding done/order:', dPad, '/', oPad);
ok('요약·발주 행 패딩 동일', dPad === oPad && dPad !== '');
const dFs = await p.locator('#doneSummary .spec-row').first().evaluate((el) => getComputedStyle(el).fontSize);
const oFs = await p.locator('#orderAuto .spec-row').first().evaluate((el) => getComputedStyle(el).fontSize);
ok('요약·발주 행 글자 동일', dFs === oFs && dFs === '15px');

// ── 토스트(복사) 아이콘 ──
await p.click('#btnOrderCopy');
await p.waitForTimeout(300);
ok('복사 토스트 아이콘(svg)', (await p.locator('#uiToast .toast-ico svg.icon').count()) === 1);

// ── 위험 확인 모달 상태 아이콘(빨강) ──
await p.click('#bannerRoot .apt-name');
await p.waitForTimeout(150);
await p.fill('#f_aptName', '아이콘테스트');
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
await p.click('#btnRestart');
await p.waitForTimeout(250);
ok('위험 모달 상태 아이콘(svg)', (await p.locator('.ui-dialog .ui-dialog-icon svg.icon').count()) === 1);
const dlgIcoBg = await p.locator('.ui-dialog-icon').evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
console.log('  · dialog icon bg:', dlgIcoBg);
ok('위험 모달 아이콘 = 빨강 틴트', /229, 72, 77/.test(dlgIcoBg));
await p.locator('.ui-dialog [data-act="cancel"]').click();
await p.waitForTimeout(150);

// ── 신뢰도 칩이 아이콘 + 색(정확=그린) ──
await p.click('#btnHome');
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(350);
await p.evaluate(() => document.querySelector('#extractReadoutWrap')?.setAttribute('open', ''));
await p.waitForTimeout(150);
ok('신뢰도 칩 아이콘(svg)', (await p.locator('#extractReadout .conf-chip svg.icon').count()) >= 1);
const okChip = p.locator('#extractReadout .conf-chip.conf-ok').first();
if (await okChip.count()) {
  const c = await okChip.evaluate((el) => getComputedStyle(el).color);
  ok('정확 칩 = 그린', c === 'rgb(62, 124, 75)');
} else { ok('정확 칩 = 그린 (없음 skip)', true); }
// 확인 버튼 체크 아이콘
const rvOk = p.locator('#reviewList .rv-item-ok').first();
ok('확인 버튼 체크 아이콘', (await rvOk.locator('svg.icon').count()) === 1);

// ── 배너 불변 경계 ──
const coral = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--coral').trim());
ok('배너 코랄 --coral #E55A3D 유지', coral.toUpperCase() === '#E55A3D');

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
