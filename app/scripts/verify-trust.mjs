// Phase 3 — 신뢰·검수 강화 검증
//  (A) 추출 원문 보기: 편집 팝오버 상단에 "품의서에서 가져온 내용" + 신뢰도 칩.
//  (B) 신뢰도 표시 확대: 좌측 "품의서에서 읽은 값" readout 에 객단가/약명/세대수/입주월/프로모션/결제 노출.
//  (C) 프로모션 확인: 자동 카드가 불확실하면(확인 권장/필요) 검수 리스트 + 미리보기 코랄 형광.
//  (D) 개발 용어 정리: 화면에 high/medium/low/missing·case-x 같은 개발 용어 노출 0 (친절 한국어만).
//
// 사용법: 서버 실행 중  node scripts/verify-trust.mjs

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://localhost:3000/';
const FRIENDLY = ['정확', '확인 권장', '확인 필요', '못 찾음'];
const JARGON = /\b(high|medium|low|missing)\b|case-[a-g]/i;

let pass = 0, fail = 0;
const errors = [];
const check = (n, c, extra = '') => { if (c) { pass++; console.log(`  ✓ ${n}${extra ? '  ·  ' + extra : ''}`); } else { fail++; console.log(`  ✗ ${n}${extra ? '  ·  ' + extra : ''}`); } };

async function upload(page, file, caseFrag) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor({ timeout: 5000 });
  await page.click('#startBlank');
  await page.setInputFiles('#pdfFile', path.join(ROOT, '참고자료', file));
  await page.waitForFunction((frag) => document.querySelector('#caseBadge')?.textContent?.includes(frag), caseFrag, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });

try {
  // ───────── 디에이치 (case-c) — readout + 원문 보기 + 개발용어 정리 ─────────
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`dh: ${e.message}`));
  await upload(p, '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf', 'case-c');

  console.log('\n[A] 신뢰도 readout (품의서에서 읽은 값)');
  const ro = await p.evaluate(() => {
    const wrap = document.querySelector('#extractReadoutWrap');
    const labels = [...document.querySelectorAll('#extractReadout .ro-line-label')].map((e) => e.textContent.trim());
    const chips  = [...document.querySelectorAll('#extractReadout .conf-chip')].map((e) => e.textContent.trim());
    const refs   = [...document.querySelectorAll('#extractReadout .ro-line:not(.is-editable) .ro-line-label')].map((e) => e.textContent.trim());
    const edits  = [...document.querySelectorAll('#extractReadout .ro-line.is-editable .ro-line-label')].map((e) => e.textContent.trim());
    return { hidden: wrap?.hidden, labels, chips, refs, edits, text: document.querySelector('#extractReadout')?.textContent || '' };
  });
  check('readout 표시됨', ro.hidden === false);
  check('객단가/약명/세대수/입주월 참고 노출', ['객단가', '약명', '세대수', '입주월'].every((k) => ro.labels.includes(k)), ro.refs.join('/'));
  check('프로모션·결제 노출', ro.labels.includes('프로모션 카드') && ro.labels.includes('결제 안내'));
  check('아파트명/매장/혜택표는 "고치기"(클릭편집) 항목', ['아파트명', '매장', '혜택표'].every((k) => ro.edits.includes(k)));
  check('신뢰도 칩이 모두 친절 한국어', ro.chips.length > 0 && ro.chips.every((c) => FRIENDLY.includes(c)), ro.chips.join(', '));

  console.log('\n[B] 추출 원문 보기 (편집 팝오버 상단)');
  await p.click('#bannerRoot .apt-name');
  await p.waitForTimeout(250);
  const src = await p.evaluate(() => {
    const box = document.querySelector('#edPopSource');
    return { visible: box && !box.hidden, text: box?.textContent || '' };
  });
  check('헤더 편집 시 원문 박스 표시', src.visible);
  check('원문 박스에 "품의서" 문구', /품의서/.test(src.text));
  check('원문 박스에 친절 신뢰도 칩', FRIENDLY.some((f) => src.text.includes(f)), src.text.replace(/\s+/g, ' ').slice(0, 60));

  console.log('\n[C] 클릭 동작 (readout → 편집 점프)');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { document.querySelector('#extractReadoutWrap').open = true; });   // 접힌 readout 펼치기
  await p.waitForTimeout(120);
  await p.click('#extractReadout .ro-line.is-editable');   // 아파트명 줄
  await p.waitForTimeout(250);
  check('readout 고치기 줄 클릭 → 편집 팝오버 열림', await p.evaluate(() => !document.querySelector('#editPopover').classList.contains('is-hidden')));

  console.log('\n[D] 개발 용어 정리');
  const jargon = await p.evaluate(() => {
    const txt = ['#reviewList', '#extractReadout', '#edPopSource'].map((s) => document.querySelector(s)?.textContent || '').join(' | ');
    const badge = document.querySelector('#caseBadge');
    const badgeShown = badge && badge.offsetParent !== null;   // 화면에 실제로 보이나
    return { txt, badgeShown };
  });
  check('케이스 배지(case-x)는 사용자 화면에 숨김', jargon.badgeShown === false);
  check('검수/readout/원문에 개발 용어(high/medium/case-x) 노출 0', !JARGON.test(jargon.txt), JARGON.test(jargon.txt) ? jargon.txt.match(JARGON)[0] : '깨끗');
  await p.close();

  // ───────── 창원 (case-e, 프로모션 확인 권장) — 검수 리스트 + 형광 ─────────
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(`cw: ${e.message}`));
  await upload(p2, '창원 롯데캐슬 포레스트 입주공략의 건(창원점).pdf', 'case-e');
  console.log('\n[E] 프로모션 카드 확인 권장 (case-e 창원)');
  const promo = await p2.evaluate(() => {
    const items = [...document.querySelectorAll('#reviewList .rv-item-label')].map((e) => e.textContent.trim());
    const flagged = document.querySelectorAll('#bannerRoot .fair-card.is-flag, #bannerRoot .product-card.is-flag').length;
    return { items, flagged };
  });
  check('검수 리스트에 "프로모션 카드 내용" 항목', promo.items.some((t) => t.includes('프로모션')), promo.items.join(' / '));
  check('미리보기 카드에 코랄 형광(is-flag)', promo.flagged >= 1, `형광 카드 ${promo.flagged}개`);
  await p2.close();

} finally {
  await ctx.close();
  await browser.close();
}

console.log('\n──────────────────────────────');
console.log(`결과: ${pass} 통과 / ${fail} 실패 / 페이지 에러 ${errors.length}건`);
if (errors.length) console.log('에러:', errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
