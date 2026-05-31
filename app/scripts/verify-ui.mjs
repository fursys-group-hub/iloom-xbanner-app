// UI 일관화 검증 — 배경 스와치 + 내 사진 업로드(배경·제품) + 셀렉트 통일 + §0 타이포/카피 점검
// 사용법: 서버 실행 중  node scripts/verify-ui.mjs

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://localhost:3000/';
const BEDROOM = path.join(ROOT, 'assets', 'full bakground', '침실 배경_web.jpg');   // 큰 사진(업로드 축소 검증용)

let pass = 0, fail = 0;
const errors = [];
const ok = (n, c, extra = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${extra ? '  ·  ' + extra : ''}`); };

const ALLOWED_FONT = new Set(['23px', '18px', '17px', '16px', '15px', '14px', '13px', '12.5px']);
const JARGON = /data:|DPI|case-[a-g]|url\(|render|appearance|\bpx\b/i;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.locator('.x-banner').first().waitFor();
  await p.click('#startBlank');
  await p.waitForTimeout(250);

  // ───────── 1. 배경 스와치 렌더 ─────────
  console.log('\n[1] 배경 사진 스와치');
  const sw = await p.evaluate(() => {
    const tiles = [...document.querySelectorAll('#bgGroup .swatch')];
    const imgs = [...document.querySelectorAll('#bgGroup .swatch--image img')];
    return {
      count: tiles.length,
      hasNone: !!document.querySelector('#bgGroup .swatch--none'),
      hasAdd: !!document.querySelector('#bgGroup .swatch--add'),
      imgLoaded: imgs.length > 0 && imgs.every((im) => im.complete && im.naturalWidth > 0),
      noneActive: !!document.querySelector('#bgGroup .swatch--none.is-active'),
    };
  });
  ok('스와치 4개 이상(없음+침실+쿠시노+내 사진 추가)', sw.count >= 4, `${sw.count}개`);
  ok('없음/내 사진 추가 타일 존재', sw.hasNone && sw.hasAdd);
  ok('썸네일 이미지 실제 로드', sw.imgLoaded);
  ok('case-a 기본 "없음" 활성', sw.noneActive);

  // ───────── 2. 내 사진(배경) 업로드 → 미리보기 ─────────
  console.log('\n[2] 배경 — 내 사진 업로드');
  await p.setInputFiles('#bgUpload', BEDROOM);
  await p.waitForTimeout(500);
  const up = await p.evaluate(async () => {
    const st = window.state;
    const isData = typeof st.bgImage === 'string' && st.bgImage.startsWith('data:image');
    const bn = document.querySelector('#bannerRoot .x-banner');
    const dim = await new Promise((res) => { const im = new Image(); im.onload = () => res(Math.max(im.naturalWidth, im.naturalHeight)); im.onerror = () => res(-1); im.src = st.bgImage; });
    return {
      isData,
      kb: Math.round((st.bgImage?.length || 0) / 1024),
      maxDim: dim,
      hasBg: bn.classList.contains('has-bg'),
      bgImageData: getComputedStyle(bn).backgroundImage.includes('data:image'),
      customActive: !!document.querySelector('#bgGroup [data-bg="custom"].is-active'),
    };
  });
  ok('업로드 → state.bgImage 가 내장 사진', up.isData);
  ok('축소 적용(최대 2400px 이하)', up.maxDim > 0 && up.maxDim <= 2400, `최대 ${up.maxDim}px · ${up.kb}KB`);
  ok('용량 예산 이내(<2MB)', up.kb < 2048, `${up.kb}KB`);
  ok('미리보기 배경 적용(.has-bg + 내장 이미지)', up.hasBg && up.bgImageData);
  ok('"내 사진" 스와치 생성·활성', up.customActive);

  // ───────── 3. 내 사진 배경이 인쇄 내보내기까지 전달 ─────────
  console.log('\n[3] 내보내기(인쇄) 전달');
  const exp = await p.evaluate(async () => {
    const r = await fetch('/api/export/png', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: window.state }) });
    const buf = await r.arrayBuffer();
    return { status: r.status, bytes: buf.byteLength };
  });
  ok('PNG 내보내기 성공(서버 무변경, 재시작 불필요)', exp.status === 200 && exp.bytes > 5000, `HTTP ${exp.status} · ${Math.round(exp.bytes / 1024)}KB`);

  // ───────── 4. 셀렉트 통일(커스텀 chevron) ─────────
  console.log('\n[4] 드롭다운 스타일 통일');
  await p.evaluate(() => { const d = document.querySelector('.order-spec-wrap'); if (d) d.open = true; });
  await p.waitForTimeout(120);
  const selStyle = await p.evaluate(() => {
    const s = document.querySelector('#o_material');
    const cs = getComputedStyle(s);
    return { appearance: cs.appearance || cs.webkitAppearance, bgImg: cs.backgroundImage };
  });
  ok('재질 셀렉트 네이티브 화살표 제거', selStyle.appearance === 'none');
  ok('커스텀 chevron 배경 적용', /svg/i.test(selStyle.bgImg));

  // ───────── 5. §0 타이포 위계 (손댄 컨트롤) ─────────
  console.log('\n[5] 타이포 위계 점검');
  const fonts = await p.evaluate(() => {
    const sels = ['#bgGroup .swatch-cap', '#bgGroup .swatch-label', '#bgGroup .swatch--add', '#toneGroup .tone-btn'];
    const out = [];
    for (const s of sels) for (const el of document.querySelectorAll(s)) out.push(getComputedStyle(el).fontSize);
    return [...new Set(out)];
  });
  const badFont = fonts.filter((f) => !ALLOWED_FONT.has(f) || parseFloat(f) < 12);
  ok('손댄 컨트롤 글자크기가 위계 사다리 안 + 12px 이상', badFont.length === 0, `쓰임: ${fonts.join(', ')}${badFont.length ? ' / 벗어남: ' + badFont.join(',') : ''}`);

  // ───────── 6. §0 카피 친절도 (개발자 용어 0) ─────────
  console.log('\n[6] 카피 친절도(개발자 용어) 점검');
  await p.click('#bgGroup .swatch--none');   // 팝오버/피커 안 열리게 정리
  const copy = await p.evaluate(() => document.querySelector('[data-tour="polish"]')?.innerText || '');
  ok('다듬기 영역 문구에 개발자 용어 노출 0', !JARGON.test(copy), JARGON.test(copy) ? '발견: ' + copy.match(JARGON)[0] : '깨끗');

  // ───────── 7. 제품 카드 — 내 사진 업로드 ─────────
  console.log('\n[7] 제품 카드 — 내 사진 업로드');
  await p.click('#btnHome');
  await p.setInputFiles('#pdfFile', path.join(ROOT, '참고자료', '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf'));
  await p.waitForFunction(() => document.querySelector('#caseBadge')?.textContent?.includes('case-c'), { timeout: 15000 }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.click('#bannerRoot .product-card');   // 카드 편집기 오픈(currentCard 설정)
  await p.waitForTimeout(200);
  await p.click('[data-imgpick]');               // 사진 바꾸기 → 피커 오픈
  await p.waitForTimeout(200);
  const hasMine = await p.evaluate(() => !!document.querySelector('#imgPickerBody [data-prod-upload]'));
  ok('제품 피커에 "내 사진 추가" 타일', hasMine);
  await p.setInputFiles('#prodUpload', BEDROOM);
  await p.waitForTimeout(500);
  const prod = await p.evaluate(() => {
    const cards = window.state.productSection?.cards || [];
    const dataCard = cards.find((c) => typeof c.imageSrc === 'string' && c.imageSrc.startsWith('data:'));
    return { any: !!dataCard, kb: dataCard ? Math.round(dataCard.imageSrc.length / 1024) : 0 };
  });
  ok('업로드 → 제품 카드 imageSrc 내장 사진', prod.any, `${prod.kb}KB`);

  await ctx.close();
  await browser.close();
} catch (e) {
  console.error('\n❌ 예외:', e.message);
  fail++;
  await browser.close();
}

console.log('\n──────────────────────────────');
console.log(`결과: ${pass} 통과 / ${fail} 실패 / 페이지 에러 ${errors.length}건`);
if (errors.length) console.log('에러:', errors);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
