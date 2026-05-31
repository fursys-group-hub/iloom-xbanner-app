// 빈 공간 분배 검증 — 콘텐츠 적은 배너에서 유의사항↔로고가 가깝고, 로고는 바닥, 슬랙은 모듈 간격에 분배
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf');

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${x ? '  ·  ' + x : ''}`); };

async function measure() {
  return p.locator('#bannerRoot .x-banner').evaluate((bn) => {
    const n = bn.querySelector('.notices');
    const f = bn.querySelector('.footer');
    const pay = bn.querySelector('.payment');
    return {
      bannerH: bn.offsetHeight,
      noticesTop: n ? n.offsetTop : null,
      noticesBottom: n ? n.offsetTop + n.offsetHeight : null,
      footerTop: f ? f.offsetTop : null,
      footerBottom: f ? f.offsetTop + f.offsetHeight : null,
      payTop: pay ? pay.offsetTop : null,
      payBottom: pay ? pay.offsetTop + pay.offsetHeight : null,
      gapGroup: bn.style.getPropertyValue('--gap-group').trim(),
      gapPay: bn.style.getPropertyValue('--gap-pay').trim(),
    };
  });
}
function checkClose(label, m) {
  const gap = (m.footerTop != null && m.noticesBottom != null) ? m.footerTop - m.noticesBottom : 9999;
  ok(`${label}: 배너 1800`, m.bannerH === 1800);
  ok(`${label}: 유의사항↔로고 가깝게`, gap >= 0 && gap < 80, `간격 ${Math.round(gap)}px`);
  ok(`${label}: 로고 바닥 근처`, m.footerBottom != null && (m.bannerH - m.footerBottom) < 110, `바닥여백 ${Math.round(m.bannerH - m.footerBottom)}px`);
}

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();

// case-a (기본·광주데시앙) — 모든 케이스 공통 적용 확인
await p.click('#startBlank');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(350);
const ma = await measure();
console.log('  · case-a 측정:', JSON.stringify(ma));
checkClose('case-a', ma);

await p.click('#btnHome');
await p.setInputFiles('#pdfFile', PDF);
await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 }).catch(() => {});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(450);

const m = await measure();
console.log('  · case-c 측정:', JSON.stringify(m));

ok('배너 높이 1800', m.bannerH === 1800);
const gap = (m.footerTop != null && m.noticesBottom != null) ? m.footerTop - m.noticesBottom : 9999;
ok('유의사항 ↔ 로고 가깝게(간격 작음)', gap >= 0 && gap < 80, `간격 ${Math.round(gap)}px`);
ok('로고가 바닥 근처', m.footerBottom != null && (m.bannerH - m.footerBottom) < 110, `바닥여백 ${Math.round(m.bannerH - m.footerBottom)}px`);
ok('빈 공간 분배(그룹 간격 키움 >60)', m.gapGroup !== '' && parseFloat(m.gapGroup) > 60, `gap-group=${m.gapGroup || '없음'}`);
// 결제↔유의사항이 붙어 보이지 않게 (비례 확장으로 함께 벌어짐)
const payGap = (m.noticesTop != null && m.payBottom != null) ? m.noticesTop - m.payBottom : 9999;
console.log('  · 결제↔유의사항 간격:', Math.round(payGap), 'px / --gap-pay:', m.gapPay);
ok('결제↔유의사항 안 붙음(>28px)', payGap > 28, `간격 ${Math.round(payGap)}px`);
ok('작은 간격도 함께 분배(--gap-pay >22)', m.gapPay !== '' && parseFloat(m.gapPay) > 22, `--gap-pay=${m.gapPay || '없음'}`);

// 넘침 아님(1800 안)
const natural = await p.locator('#bannerRoot .x-banner').evaluate((bn) => {
  const c = bn.cloneNode(true);
  Object.assign(c.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
  document.body.appendChild(c);
  const h = c.scrollHeight; c.remove(); return h;
});
ok('1800px 안에 들어옴', natural <= 1804, `높이 ${natural}px`);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 / 에러 ${errors.length}건`);
if (errors.length) console.log(errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
