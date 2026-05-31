// Phase 1 — 카드 직접편집 검증 (제품/후기/박람회 + 사진 피커 + 추가/삭제)
// 사용법: (서버 실행 중) node scripts/verify-cards.mjs
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(ROOT, '참고자료');
const PDF = {
  c: path.join(REF, '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf'),                 // 제품 카드
  d: path.join(REF, '일룸 송파 & 강동아이파크_잠실래미안 입주박람회 참가&잠실르엘 공략의 건.pdf'), // 후기 카드
  e: path.join(REF, '창원 롯데캐슬 포레스트 입주공략의 건(창원점).pdf'),                      // 박람회 카드
};
const BASE = 'http://localhost:3000/';

let pass = 0, fail = 0;
const errors = [];
const check = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
page.on('pageerror', (e) => { errors.push(e.message); console.error('  [browser ERROR]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.error('  [console error]', m.text()); } });

async function uploadAndWait(pdf, caseId) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
  await page.setInputFiles('#pdfFile', pdf);
  await page.waitForFunction((cid) => document.querySelector('#caseBadge')?.textContent?.includes(cid), caseId, { timeout: 15_000 });
}
const openCard = async (sel) => {
  await page.locator(`.x-banner ${sel}`).first().click();
  await page.locator('#editPopover:not(.is-hidden) .ed-panel[data-panel="card"]:not([hidden])').waitFor({ timeout: 3_000 });
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 10_000 });

  // ─── 1. 제품 카드 (디에이치 case-c) ───
  console.log('\n[1] 제품 카드 (case-c)');
  await uploadAndWait(PDF.c, 'case-c');
  const prodN = await page.locator('.x-banner .product-card').count();
  check('제품 카드 렌더됨', prodN >= 1);
  await openCard('.product-card');
  check('카드 편집기 — 제품명 입력', await page.locator('#cardPanelBody input[data-k="name"]').isVisible());
  check('카드 편집기 — 사진 바꾸기 버튼', await page.locator('#cardPanelBody [data-imgpick]').isVisible());
  // 제품명 편집 → 미리보기 반영
  await page.fill('#cardPanelBody input[data-k="name"]', '검증용 제품명');
  await page.waitForTimeout(150);
  check('제품명 미리보기 반영', (await page.locator('.x-banner .product-card .product-card-name').first().textContent()).includes('검증용 제품명'));
  // 사진 피커
  await page.click('#cardPanelBody [data-imgpick]');
  await page.locator('#imgPicker:not(.is-hidden)').waitFor({ timeout: 3_000 });
  check('사진 피커 열림 + 썸네일', (await page.locator('#imgPickerBody .ip-thumb').count()) > 10);
  const firstSrc = await page.locator('#imgPickerBody .ip-thumb').first().getAttribute('data-src');
  await page.locator('#imgPickerBody .ip-thumb').first().click();
  await page.waitForTimeout(150);
  check('사진 피커 닫힘', await page.locator('#imgPicker').evaluate((el) => el.classList.contains('is-hidden')));
  check('이미지 교체 반영', (await page.locator('.x-banner .product-card img').first().getAttribute('src')) === firstSrc);
  // 카드 추가/삭제
  const add0 = await page.locator('.x-banner .product-card').count();
  if (add0 < 3) {
    await page.click('#cardPanelBody [data-card-add]');
    await page.waitForTimeout(150);
    check('카드 추가됨', (await page.locator('.x-banner .product-card').count()) === add0 + 1);
    await page.click('#cardPanelBody [data-card-del]');
    await page.waitForTimeout(150);
    check('카드 삭제됨', (await page.locator('.x-banner .product-card').count()) === add0);
  } else { check('카드 추가/삭제 (최대치 — 건너뜀)', true); }
  await page.keyboard.press('Escape');

  // ─── 2. 후기 카드 (잠실 case-d) ───
  console.log('\n[2] 후기 카드 (case-d)');
  await uploadAndWait(PDF.d, 'case-d');
  check('후기 카드 렌더됨', (await page.locator('.x-banner .review-card').count()) >= 1);
  await openCard('.review-card');
  check('후기 편집기 — 색상 select', await page.locator('#cardPanelBody select[data-k="theme"]').isVisible());
  check('후기 편집기 — 헤드라인 textarea', await page.locator('#cardPanelBody textarea[data-k="headline"]').isVisible());
  await page.fill('#cardPanelBody input[data-k="tag"]', '검증태그');
  await page.waitForTimeout(150);
  check('후기 태그 미리보기 반영', (await page.locator('.x-banner .review-tag').first().textContent()).includes('검증태그'));
  await page.keyboard.press('Escape');
  // case-d 는 maxBenefit·celebration 둘 다 state 에 있고 celebration 만 렌더 → 톤이 celebration 을 바꿔야 함
  const cel0 = await page.locator('.x-banner .celebration').first().innerText();
  await page.click('.tone-btn[data-tone="기간강조"]');
  await page.waitForTimeout(200);
  const cel1 = await page.locator('.x-banner .celebration').first().innerText();
  check('case-d 카피 톤이 축하 문구를 바꿈', cel0 !== cel1);

  // ─── 3. 박람회 카드 (창원 case-e) ───
  console.log('\n[3] 박람회 카드 (case-e)');
  await uploadAndWait(PDF.e, 'case-e');
  check('박람회 카드 렌더됨', (await page.locator('.x-banner .fair-card').count()) >= 2);
  await openCard('.fair-card');
  check('박람회 편집기 — 날짜 textarea', await page.locator('#cardPanelBody textarea[data-k="dates"]').isVisible());
  await page.fill('#cardPanelBody input[data-k="target"]', '검증대상');
  await page.waitForTimeout(150);
  check('박람회 대상 미리보기 반영', (await page.locator('.x-banner .fair-target').first().textContent()).includes('검증대상'));
  await page.keyboard.press('Escape');

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
