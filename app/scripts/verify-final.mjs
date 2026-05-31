// 원클릭 런처(수동)·인쇄 전 안전 강화·튜토리얼·완료 신호·신뢰도 접힘 검증
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
await p.click('#startBlank');
await p.waitForTimeout(250);

// ── 완료 신호 (새로작성 기본) ──
const es = await p.locator('#exportStatus').textContent();
console.log('  · exportStatus:', JSON.stringify(es));
ok('완료신호 렌더(클래스)', (await p.locator('#exportStatus.is-ready, #exportStatus.is-pending').count()) === 1);

// ── 도움말 → 튜토리얼 (자동은 webdriver 차단, 수동 트리거) ──
await p.click('#btnHelp');
await p.waitForTimeout(250);
ok('튜토리얼 표시', await p.locator('.tour-overlay .tour-pop').isVisible());
ok('1 / 4 단계', (await p.locator('.tour-step').textContent()).includes('1 / 4'));
await p.click('.tour-next'); await p.waitForTimeout(120);
ok('2 / 4 단계', (await p.locator('.tour-step').textContent()).includes('2 / 4'));
await p.click('.tour-next'); await p.click('.tour-next'); await p.waitForTimeout(120);
ok('마지막=시작하기', (await p.locator('.tour-next').textContent()).includes('시작하기'));
await p.click('.tour-next'); await p.waitForTimeout(150);
ok('튜토리얼 종료', (await p.locator('.tour-overlay').count()) === 0);
ok('tour-done 저장', (await p.evaluate(() => localStorage.getItem('iloom-xbanner-tour-done'))) === '1');

// ── 신뢰도 readout 접힌 채 (업로드 후) ──
await p.click('#btnHome');
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(350);
ok('신뢰도 readout 있음', (await p.locator('#extractReadoutWrap').count()) === 1);
ok('신뢰도 readout 접힘(open=false)', !(await p.locator('#extractReadoutWrap').evaluate((el) => el.open)));

// ── 인쇄 전 안전: 아파트명 비우면 is-pending + 버튼 주의 + 다운로드 confirm 경고 ──
await p.click('#bannerRoot .apt-name');
await p.waitForTimeout(150);
await p.fill('#f_aptName', '');
await p.waitForTimeout(200);
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
ok('빈 아파트명 → is-pending', (await p.locator('#exportStatus.is-pending').count()) === 1);
ok('다운로드 버튼 주의상태', (await p.locator('#btnPng2.btn-caution').count()) === 1);
await p.click('#btnPng2');
await p.waitForTimeout(250);
const dlg = (await p.locator('.ui-dialog').textContent().catch(() => '')) || '';
console.log('  · dialog:', JSON.stringify(dlg.slice(0, 60)));
ok('다운로드 전 확인 모달에 경고', dlg.includes('인쇄 전에 확인') && dlg.includes('아파트명'));
ok('확인 모달 = 주요버튼(위험 아님)', (await p.locator('.ui-dialog .btn-primary').count()) === 1);
await p.locator('.ui-dialog [data-act="cancel"]').click();
await p.waitForTimeout(150);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
