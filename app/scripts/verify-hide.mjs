// Phase 1+ — 영역 통째로 숨기기/다시 보이기 검증 (잠실 case-d 후기 이벤트)
// 사용법: (서버 실행 중) node scripts/verify-hide.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_D = path.join(__dirname, '..', '..', '참고자료', '일룸 송파 & 강동아이파크_잠실래미안 입주박람회 참가&잠실르엘 공략의 건.pdf');
const BASE = 'http://localhost:3000/';
let pass = 0, fail = 0; const errors = [];
const check = (n, c) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}`); } };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
page.on('pageerror', (e) => { errors.push(e.message); console.error('  [ERR]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('  [CERR]', m.text()); } });
const has = (sel) => page.locator(`.x-banner ${sel}`).count().then((n) => n > 0);

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  await page.setInputFiles('#pdfFile', PDF_D);
  await page.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-d'), { timeout: 15_000 });
  await page.waitForTimeout(300);

  console.log('\n[1] 후기 영역 숨기기 (영역 목록)');
  check('후기 영역 처음엔 보임', await has('.review-event-wrapper'));
  check('영역목록에 후기 "숨기기" 버튼', await page.locator('#regionOrder [data-hide="review"]').count() === 1);
  await page.click('#regionOrder [data-hide="review"]');
  await page.waitForTimeout(200);
  check('후기 영역 미리보기에서 사라짐', !(await has('.review-event-wrapper')));
  check('"숨긴 영역"에 후기 + 다시 보이기', await page.locator('#regionOrder [data-show="review"]').count() === 1);
  check('state._hidden 에 review', (await page.evaluate(() => (window.state?._hidden || []).includes('review'))));

  console.log('\n[2] 다시 보이기');
  await page.click('#regionOrder [data-show="review"]');
  await page.waitForTimeout(200);
  check('후기 영역 복원', await has('.review-event-wrapper'));
  check('_hidden 비워짐', (await page.evaluate(() => (window.state?._hidden || []).length)) === 0);

  console.log('\n[3] 카드 편집기에서 "이 영역 전체 안 보이기"');
  await page.locator('.x-banner .review-card').first().click();
  await page.locator('#editPopover:not(.is-hidden)').waitFor({ timeout: 3_000 });
  check('카드 푸터에 영역 숨김 버튼', await page.locator('#cardPanelBody [data-card-hide="review"]').count() === 1);
  await page.click('#cardPanelBody [data-card-hide="review"]');
  await page.waitForTimeout(200);
  check('팝오버 닫힘', await page.locator('#editPopover').evaluate((el) => el.classList.contains('is-hidden')));
  check('후기 영역 다시 사라짐', !(await has('.review-event-wrapper')));

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
