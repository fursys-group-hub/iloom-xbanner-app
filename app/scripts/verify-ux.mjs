// 미리보기 직접편집 UI 실브라우저 검증 — 콘솔 에러 0 + 새 흐름 동작 확인
// 사용법: (서버 실행 중) node scripts/verify-ux.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
// 교대역 = case-b(특별 프로모션) + aptName 확인필요 → 검수리스트 + 프로모 편집을 한 번에 검증
const PDF_CASE_B = path.join(PROJECT_ROOT, '참고자료', '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf');
const BASE = 'http://localhost:3000/';

let pass = 0, fail = 0;
const errors = [];
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => { errors.push(err.message); console.error('  [browser ERROR]', err.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('  [console error]', m.text()); } });

const openPanelOf = async (sel) => {
  await page.locator(`.x-banner ${sel}`).first().click();
  await page.locator('#editPopover:not(.is-hidden)').waitFor({ timeout: 3_000 });
};

try {
  // ─── 1. 첫 진입 (드래프트 비우고) ───
  console.log('\n[1] 첫 진입 / 시작화면');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10_000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  check('시작화면 보임', await page.locator('#startScreen').isVisible());
  check('이어서편집 버튼 숨김(드래프트 없음)', await page.locator('#startResume').isHidden());
  check('위저드 흔적 없음(.wiz-l/.step-nav 제거)', (await page.locator('.wiz-l').count()) === 0);

  // ─── 2. 새로 작성 → 검수 패널 ───
  console.log('\n[2] 새로 작성 → 검수 패널');
  await page.click('#startBlank');
  check('시작화면 닫힘', await page.locator('#startScreen').isHidden());
  check('검수 패널 존재', await page.locator('#reviewList').count() === 1);
  check('자동추출 없음 → 안내문', (await page.locator('#reviewList .rv-empty').count()) === 1);
  check('확인필요 0', (await page.locator('#reviewCount').textContent()) === '0');

  // ─── 3. 미리보기 직접편집 (영역 클릭 → 팝오버) ───
  console.log('\n[3] 미리보기 클릭 → 편집 팝오버');
  await openPanelOf('.apt-name');
  check('헤더 패널 열림 + 아파트명 입력', await page.locator('.ed-panel[data-panel="header"]:not([hidden]) #f_aptName').isVisible());
  await page.keyboard.press('Escape');
  check('Esc 로 팝오버 닫힘', await page.locator('#editPopover').evaluate((el) => el.classList.contains('is-hidden')));

  await openPanelOf('.table-wrapper');
  check('혜택표 패널 + 셀 그리드', (await page.locator('.ed-panel[data-panel="benefitTable"]:not([hidden]) .te-cell').count()) > 0);
  await page.keyboard.press('Escape');

  await openPanelOf('.payment');
  check('결제 패널 + 포인트 체크박스 3', (await page.locator('.ed-panel[data-panel="payment"]:not([hidden]) input[data-pt]').count()) === 3);
  await page.keyboard.press('Escape');

  await openPanelOf('.max-benefit');
  check('최대혜택 패널 + 금액 입력', await page.locator('.ed-panel[data-panel="maxBenefit"]:not([hidden]) #f_maxAmount').isVisible());
  await page.keyboard.press('Escape');

  await openPanelOf('.notices');
  check('유의사항 패널 + textarea', await page.locator('.ed-panel[data-panel="notices"]:not([hidden]) #f_notices').isVisible());
  await page.keyboard.press('Escape');

  // ─── 4. 줌 / 전체화면 ───
  console.log('\n[4] 줌 / 전체화면');
  await page.click('.zoom-btn[data-zoom="1"]');
  const t100 = await page.locator('#bannerRoot').evaluate((el) => el.style.transform);
  check('100% → scale(1)', t100.includes('scale(1)'));
  await page.click('.zoom-btn[data-zoom="0.8"]');
  await page.click('#btnFull');
  check('전체화면 오버레이 표시', await page.locator('#zoomOverlay').isVisible());
  check('오버레이에 배너 렌더', (await page.locator('#zoomOverlayBanner .x-banner').count()) === 1);
  await page.keyboard.press('Escape');
  check('Esc 로 오버레이 닫힘', await page.locator('#zoomOverlay').isHidden());

  // ─── 5. 내보내기 점검 요약 (정상) ───
  console.log('\n[5] 내보내기 점검 요약');
  check('요약 채워짐', (await page.locator('#doneSummary .done-row').count()) >= 4);
  check('정상값 → 경고 없음', (await page.locator('#doneSummary .done-warn').count()) === 0);

  // ─── 6. 빈 아파트명 → 경고 ───
  console.log('\n[6] 빈 아파트명 → 경고');
  await openPanelOf('.apt-name');
  await page.fill('#f_aptName', '');
  await page.waitForTimeout(160);
  check('빈값 행 빨강 표시', (await page.locator('#doneSummary .done-row.is-bad').count()) >= 1);
  check('경고 박스 표시', (await page.locator('#doneSummary .done-warn').count()) === 1);
  await page.fill('#f_aptName', '테스트 아파트');
  await page.waitForTimeout(160);
  await page.keyboard.press('Escape');

  // ─── 7. 자동저장 → 새로고침 → 이어서편집 ───
  console.log('\n[7] 자동저장 / 이어서 편집');
  const hasDraft = await page.evaluate(() => !!localStorage.getItem('iloom-xbanner-draft'));
  check('localStorage 드래프트 저장됨', hasDraft);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  check('새로고침 후 이어서편집 버튼 보임', await page.locator('#startResume').isVisible());

  // ─── 8. PDF 업로드 (case-b 교대역) → 검수리스트 ───
  console.log('\n[8] PDF 업로드 → case-b + 검수리스트');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  await page.setInputFiles('#pdfFile', PDF_CASE_B);
  await page.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-b'), { timeout: 15_000 }).catch(() => {});
  check('case-b 분류', (await page.locator('#caseBadge').textContent()).includes('case-b'));
  check('시작화면 닫힘', await page.locator('#startScreen').isHidden());
  const rvCount = await page.locator('#reviewList .rv-item').count();
  check('검수리스트 항목 1개 이상', rvCount >= 1);
  check('미리보기 형광(.is-flag) 1개 이상', (await page.locator('.x-banner [data-edit].is-flag').count()) >= 1);

  // ─── 9. 검수 "확인" → 항목 감소 ───
  console.log('\n[9] 검수 항목 확인 처리');
  if (rvCount >= 1) {
    await page.locator('#reviewList .rv-item-ok').first().click();
    await page.waitForTimeout(120);
    check('확인 후 항목 감소', (await page.locator('#reviewList .rv-item').count()) === rvCount - 1);
  } else { check('확인 후 항목 감소 (건너뜀)', true); }

  // ─── 10. 특별 프로모션 카드 편집 (영역 클릭) ───
  console.log('\n[10] 프로모션 카드 편집 + 강조');
  await openPanelOf('.promo-wrapper');
  const ta = page.locator('textarea[data-k="headline"][data-idx="0"]').first();
  await ta.waitFor({ timeout: 3_000 });
  const before = await ta.inputValue();
  await ta.evaluate((el) => el.setSelectionRange(0, 2));
  await page.locator('.btn-emph[data-emph="0"]').first().click();
  const after = await ta.inputValue();
  check('선택 글자 {…}로 감싸짐', after.startsWith('{') && after.length === before.length + 2);
  await page.keyboard.press('Escape');

  // ─── 11. PNG 다운로드 상태 표시 ───
  console.log('\n[11] PNG 다운로드 상태 표시');
  const dl = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
  await page.click('#btnPng2');
  const download = await dl;
  await page.waitForTimeout(500);
  check('다운로드 발생', !!download);
  check('완료 안내 토스트 표시', await page.locator('#uiToast.toast--ok').isVisible().catch(() => false));

} catch (e) {
  console.error('\n❌ 검증 중 예외:', e.message);
  fail++;
} finally {
  await browser.close();
}

console.log('\n──────────────────────────────');
console.log(`결과: ${pass} 통과 / ${fail} 실패 / 콘솔·페이지 에러 ${errors.length}건`);
if (errors.length) console.log('에러:', errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
