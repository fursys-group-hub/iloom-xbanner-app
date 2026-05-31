// Phase 1 — 영역 순서 드래그 + 카피 톤 검증
// 사용법: (서버 실행 중) node scripts/verify-region.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000/';
let pass = 0, fail = 0;
const errors = [];
const check = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
page.on('pageerror', (e) => { errors.push(e.message); console.error('  [ERR]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('  [CERR]', m.text()); } });

// .x-banner 안에서 두 셀렉터의 등장 순서 비교 (a 가 b 보다 위면 true)
const isAbove = (a, b) => page.evaluate(([sa, sb]) => {
  const bn = document.querySelector('.x-banner');
  const ea = bn.querySelector(sa), eb = bn.querySelector(sb);
  if (!ea || !eb) return false;
  return (ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}, [a, b]);

const dndRows = (from, to) => page.evaluate(({ f, t }) => {
  const ro = document.querySelector('#regionOrder');
  const ef = ro.querySelector(`.ro-row[data-region="${f}"]`);
  const et = ro.querySelector(`.ro-row[data-region="${t}"]`);
  const dt = new DataTransfer();
  const fire = (el, type) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  fire(ef, 'dragstart'); fire(et, 'dragover'); fire(et, 'drop'); fire(ef, 'dragend');
}, { f: from, t: to });

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  await page.click('#startBlank');
  await page.waitForTimeout(200);

  // ─── 1. 영역 순서 리스트 ───
  console.log('\n[1] 영역 순서 리스트');
  check('영역 행 4개 (maxBenefit/table/payment/notices)', (await page.locator('#regionOrder .ro-row').count()) === 4);
  check('기본: 최대혜택이 유의사항보다 위', await isAbove('.max-benefit', '.notices'));

  // ─── 2. 드래그로 유의사항을 맨 위로 ───
  console.log('\n[2] 드래그 재배치');
  await dndRows('notices', 'maxBenefit');
  await page.waitForTimeout(200);
  check('유의사항이 최대혜택보다 위로 이동', await isAbove('.notices', '.max-benefit'));
  check('state._order 반영', (await page.evaluate(() => window.state?._order?.[0])) === 'notices');
  check('리스트도 유의사항이 첫 행', (await page.locator('#regionOrder .ro-row').first().getAttribute('data-region')) === 'notices');

  // ─── 3. 카피 톤 ───
  console.log('\n[3] 카피 톤 적용');
  const before = (await page.locator('.x-banner .max-benefit-after').first().textContent()).trim();
  await page.click('.tone-btn[data-tone="축하형"]');
  await page.waitForTimeout(200);
  const after = (await page.locator('.x-banner .max-benefit-after').first().textContent()).trim();
  check('톤 변경 시 문구 바뀜', before !== after);
  // 배경 버튼도 .tone-btn 클래스를 공유하므로 톤(data-tone)으로 한정
  check('활성 톤 = 축하형', (await page.locator('.tone-btn[data-tone].is-active').textContent()).includes('축하형'));

  // ─── 4. 내보내기 PDF (서버가 새 렌더로 _order 반영) ───
  console.log('\n[4] 내보내기 PDF');
  const dl = page.waitForEvent('download', { timeout: 25_000 }).catch(() => null);
  await page.click('#btnPdf');
  const d = await dl;
  check('PDF 다운로드 발생', !!d);

} catch (e) {
  console.error('\n❌ 예외:', e.message);
  fail++;
} finally {
  await browser.close();
}

console.log('\n──────────────────────────────');
console.log(`결과: ${pass} 통과 / ${fail} 실패 / 콘솔·페이지 에러 ${errors.length}건`);
if (errors.length) console.log('에러:', errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
