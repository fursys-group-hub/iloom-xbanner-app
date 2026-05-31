// Phase 2 — 막다른 길 해결 검증
//  (A) 콘텐츠 넘침 자동 압축: 빽빽한 배너(디에이치)가 1800px 안에 들어오고,
//      절대 압축 금지 영역(매장명 35px·타이틀)은 그대로. 여백 많은 배너(대구범어)는 안 건드림.
//  (B) 스캔본/추출 실패 친절 안내: 글자 없는 PDF·깨진 PDF·PDF 아님 → 사용자 말 안내(422).
//
// 사용법: 서버(node --watch server.js) 띄운 뒤  node scripts/verify-overflow.mjs

import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'output');
const BASE = 'http://localhost:3000';

const results = [];
const errors = [];
const ok   = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };

// ───────── (A) 브라우저: 넘침 자동 압축 ─────────
async function measureCase(page, label, file, expectCaseFrag, { compressed, grown }) {
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.locator('.x-banner').first().waitFor();
  await page.click('#startBlank');
  await page.setInputFiles('#pdfFile', path.join(ROOT, '참고자료', file));
  await page.waitForFunction(
    (frag) => document.querySelector('#caseBadge')?.textContent?.includes(frag),
    expectCaseFrag, { timeout: 15000 },
  ).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const banner = document.querySelector('#bannerRoot .x-banner');
    const cs = getComputedStyle(banner);
    const store = banner.querySelector('.store-name');
    const title = banner.querySelector('.main-title');
    const clone = banner.cloneNode(true);
    Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
    document.body.appendChild(clone);
    const naturalH = clone.scrollHeight;
    clone.remove();
    return {
      naturalH,
      gapGroup:  banner.style.getPropertyValue('--gap-group').trim(),   // 인라인 압축값(없으면 빈 문자열)
      storeFs:   store ? getComputedStyle(store).fontSize : null,
      titleFs:   title ? getComputedStyle(title).fontSize : null,
    };
  });

  ok(`${label} — 1800px 안에 들어옴`, info.naturalH <= 1804, `높이 ${info.naturalH}px`);
  if (compressed) {
    ok(`${label} — 압축 발동(--gap-group 인라인 설정됨)`, info.gapGroup !== '', `gap-group=${info.gapGroup || '없음'}`);
    ok(`${label} — 매장명 35px 보호(압축 안 됨)`, info.storeFs === '35px', `store=${info.storeFs}`);
  } else if (grown) {
    ok(`${label} — 빈 공간 채움(--gap-group 키워 분배)`, info.gapGroup !== '' && parseFloat(info.gapGroup) >= 60, `gap-group=${info.gapGroup || '없음'}`);
    ok(`${label} — 매장명 35px 보호`, info.storeFs === '35px', `store=${info.storeFs}`);
  } else {
    ok(`${label} — 여백 충분 → 압축 안 함(--gap-group 인라인 없음)`, info.gapGroup === '', `gap-group=${info.gapGroup || '없음(표준)'}`);
  }
  return info;
}

// ───────── (B) API: 친절 안내 ─────────
function blankPdfBuffer() {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj',
    'trailer<</Size 4/Root 1 0 R>>', '%%EOF', '',
  ].join('\n');
  return Buffer.from(pdf, 'latin1');
}
async function postPdf(buf, name) {
  const fd = new FormData();
  fd.append('pdf', new Blob([buf], { type: 'application/pdf' }), name);
  const res = await fetch(`${BASE}/api/extract`, { method: 'POST', body: fd });
  let body = {}; try { body = await res.json(); } catch { /* not json */ }
  return { status: res.status, body };
}

async function apiTests() {
  const blank = await postPdf(blankPdfBuffer(), 'scan.pdf');
  ok('스캔본(글자 없는 PDF) → 422', blank.status === 422, `status ${blank.status}`);
  ok('스캔본 → NO_TEXT 안내(한국어, 기술용어 없음)',
     blank.body.code === 'NO_TEXT' && /글자/.test(blank.body.error || '') && !/error|exception|null/i.test(blank.body.error || ''),
     blank.body.error);

  const bad = await postPdf(Buffer.from('this is not a pdf'), 'broken.pdf');
  ok('깨진/PDF아님 → 422', bad.status === 422, `status ${bad.status}`);
  ok('깨진/PDF아님 → INVALID_PDF 안내', bad.body.code === 'INVALID_PDF' && /PDF/.test(bad.body.error || ''), bad.body.error);
}

// ───────── 실행 ─────────
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
try {
  const p1 = await ctx.newPage();
  const dh = await measureCase(p1, '디에이치(빽빽)', '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf', 'case-c', { compressed: true });
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await p1.locator('#bannerRoot .x-banner').screenshot({ path: path.join(OUT, 'overflow_dh.png') });
  const dhState = await p1.evaluate(() => window.state);   // 내보내기 경로 확인용 state
  await p1.close();

  // 내보내기(인쇄) 경로 — 서버 캡처가 쓰는 preview-dynamic.html 에서도 동일하게 압축돼 안 잘리는지
  const pe = await ctx.newPage();
  pe.on('pageerror', (e) => errors.push(`export: ${e.message}`));
  await pe.addInitScript((s) => { window.__state__ = s; }, dhState);
  await pe.goto(`${BASE}/preview-dynamic.html`, { waitUntil: 'networkidle' });
  await pe.locator('.x-banner').first().waitFor({ timeout: 5000 });
  await pe.evaluate(() => document.fonts.ready);
  await pe.waitForTimeout(500);
  const exportH = await pe.evaluate(() => {
    const banner = document.querySelector('#bannerRoot .x-banner');
    const clone = banner.cloneNode(true);
    Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
    document.body.appendChild(clone);
    const h = clone.scrollHeight; clone.remove();
    return h;
  });
  ok('디에이치 — 내보내기(인쇄) 렌더도 1800px 안에 들어옴', exportH <= 1804, `높이 ${exportH}px`);
  await pe.locator('#bannerRoot .x-banner').screenshot({ path: path.join(OUT, 'overflow_dh_export.png') });
  await pe.close();

  const p2 = await ctx.newPage();
  await measureCase(p2, '대구범어(여백)', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf', 'case-c', { grown: true });
  await p2.close();

  await apiTests();
} finally {
  await ctx.close();
  await b.close();
}

const pass = results.filter((r) => r[0] === 'PASS').length;
for (const [st, name, extra] of results) console.log(`  ${st === 'PASS' ? '✓' : '✗'} ${name}${extra ? '  ·  ' + extra : ''}`);
console.log(`\n${pass}/${results.length} 통과` + (errors.length ? `\n페이지 에러: ${JSON.stringify(errors)}` : '\n페이지 에러 0'));
process.exit(pass === results.length && errors.length === 0 ? 0 : 1);
