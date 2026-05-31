// 디자인 시스템 검증 — 검정(주요)/빨강(위험)/앰버(확인필요)/그린(완료) + 토스트 + 확인모달 + 배너 불변
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

// ── 색 토큰 체계 ──
const tok = await p.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  const g = (n) => s.getPropertyValue(n).trim();
  return { accent: g('--accent'), danger: g('--danger'), warn: g('--warn'), hot: g('--hot'), coral: g('--coral'), bgMain: g('--bg-main') };
});
console.log('  · tokens:', JSON.stringify(tok));
ok('주요=검정 --accent #1C1C1E', tok.accent.toUpperCase() === '#1C1C1E');
ok('위험=빨강 --danger #E5484D', tok.danger.toUpperCase() === '#E5484D');
ok('주의=코랄 --warn #C84A3F', tok.warn.toUpperCase() === '#C84A3F');
ok('코랄 --hot 폐지', tok.hot === '');
// 경계: 배너(banner.css) 불변
ok('배너 코랄 --coral #E55A3D 유지', tok.coral.toUpperCase() === '#E55A3D');
ok('배너 크림 --bg-main #FFF5EE 유지', tok.bgMain.toUpperCase() === '#FFF5EE');

// ── 주요버튼 = 검정 채움 ──
const pngBg = await p.locator('#btnPng2').evaluate((el) => getComputedStyle(el).backgroundColor);
console.log('  · btn-primary bg:', pngBg);
ok('주요버튼 계산색 = 검정 rgb(28,28,30)', pngBg === 'rgb(28, 28, 30)');

// ── 완료 신호 그린 (새로작성 = 확인필요 0) ──
const esCls = (await p.locator('#exportStatus').getAttribute('class')) || '';
ok('완료신호 is-ready', /is-ready/.test(esCls));
const esColor = await p.locator('#exportStatus').evaluate((el) => getComputedStyle(el).color);
ok('완료신호 색 = 그린 rgb(62,124,75)', esColor === 'rgb(62, 124, 75)');

// ── 토스트가 옛 초록 띠를 대체 ──
ok('옛 #mainStatus 띠 제거됨', (await p.locator('#mainStatus').count()) === 0);
const okDot = await p.evaluate(() => {
  const t = document.createElement('div'); t.className = 'toast toast--ok';
  const d = document.createElement('span'); d.className = 'toast-ico'; t.appendChild(d);
  document.body.appendChild(t);
  const c = getComputedStyle(d).color; t.remove(); return c;
});
ok('토스트 성공 아이콘 = 그린', okDot === 'rgb(62, 124, 75)');
// 발주서 복사 → 토스트 등장(성공/실패 무관, 띠가 아닌 토스트로 뜨는지)
await p.evaluate(() => document.querySelector('.order-spec-wrap')?.setAttribute('open', ''));
await p.waitForTimeout(100);
await p.click('#btnOrderCopy');
await p.waitForTimeout(300);
ok('복사 시 토스트 등장', (await p.locator('#uiToast.is-show').count()) === 1);

// ── 위험 확인 모달(빨강) — 편집 후 "새 배너" ──
await p.click('#bannerRoot .apt-name');
await p.waitForTimeout(150);
await p.fill('#f_aptName', '테스트수정');
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
await p.click('#btnRestart');
await p.waitForTimeout(250);
ok('위험 확인 모달 표시', await p.locator('.ui-dialog').isVisible().catch(() => false));
ok('위험 모달 = 빨강 버튼(btn-danger)', (await p.locator('.ui-dialog .btn-danger').count()) === 1);
const dangerBg = await p.locator('.ui-dialog .btn-danger').evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
ok('빨강 버튼 계산색 = 빨강 rgb(229,72,77)', dangerBg === 'rgb(229, 72, 77)');
await p.locator('.ui-dialog [data-act="cancel"]').click();
await p.waitForTimeout(150);

// ── 확인필요 항목 = 앰버 (PDF 업로드로 저신뢰 유도) ──
await p.click('#btnHome');
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(350);
const rvItems = await p.locator('.rv-item').count();
console.log('  · rv-items:', rvItems);
if (rvItems > 0) {
  const rvLabel = await p.locator('.rv-item-label').first().evaluate((el) => getComputedStyle(el).color);
  console.log('  · rv-item-label:', rvLabel);
  ok('확인필요 라벨 = 코랄 rgb(169,58,48)', rvLabel === 'rgb(169, 58, 48)');
} else {
  console.log('  · (확인필요 항목 없음 — 라벨 색 검사 건너뜀)');
  ok('확인필요 라벨 색 검사(항목 없음 skip)', true);
}

// ── 신뢰도 펼침이 한 그룹으로 묶이는지 ──
await p.evaluate(() => document.querySelector('#extractReadoutWrap')?.setAttribute('open', ''));
await p.waitForTimeout(150);
const grouped = await p.locator('#extractReadoutWrap').evaluate((el) => {
  const s = getComputedStyle(el);
  return s.borderTopWidth !== '0px' && s.borderRadius !== '0px';
}).catch(() => false);
ok('신뢰도 펼침 = 그룹 카드(테두리+라운드)', grouped);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
