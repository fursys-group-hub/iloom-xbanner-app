// 모든 품의서 PDF를 하나씩 넣어 추출·렌더·속도·맞춤을 확인 + 스크린샷
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const REF = path.join(ROOT, '참고자료');
const OUT = path.join(__dirname, 'output', 'pdf-test');
fs.mkdirSync(OUT, { recursive: true });

const PDFS = [
  '교대역 모아엘가 그랑데 입주 공략의 건광천점봉선점.pdf',
  '대구범어 아이파크2차 입주 공략의 건(수성점).pdf',
  '대전 하늘채 스카이앤 2차 입주공략 (서대전점).pdf',
  '도안 우미린 트리쉐이드 입주 공략의 건(대전둔산유성NC점).pdf',
  '수원성중흥S-클래스 입주 공략의 건 (스타필드수원점 수원광교점).pdf',
  '순천 트리마제 입주아파트 공략 (순천점).pdf',
  '양정 자이 더샵 SK뷰 입주공략의 건(연제점).pdf',
  '익산 자이그랜드파크 입주 공략의 건(전군점).pdf',
  '일룸 부산센텀_두산위브더제니스 오션시티 입주 공략의 건(부산센텀점, 연제점, 동부산점 공동 공략).pdf',
  '일룸 송파 & 강동아이파크_잠실래미안 입주박람회 참가&잠실르엘 공략의 건.pdf',
  '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf',
  '창원 롯데캐슬 포레스트 입주공략의 건(창원점).pdf',
  '한화포레나 대전월평공원 입주 공략의 건(서대전점,대전둔산점).pdf',
];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const pageErrors = [];
p.on('pageerror', (e) => pageErrors.push(e.message));

const rows = [];
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

for (let i = 0; i < PDFS.length; i++) {
  const name = PDFS[i];
  const short = name.replace(/\.pdf$/, '').slice(0, 18);
  // 매번 깨끗한 상태에서 시작 (이전 품의서 잔상 방지)
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

  const t0 = Date.now();
  let ok = true, err = '';
  try {
    await p.setInputFiles('#pdfFile', path.join(REF, name));
    await p.waitForSelector('#bannerRoot .x-banner', { timeout: 20000 });
  } catch (e) { ok = false; err = e.message.split('\n')[0]; }
  const renderMs = Date.now() - t0;

  let info = {};
  if (ok) {
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    info = await p.evaluate(() => {
      const bn = document.querySelector('#bannerRoot .x-banner');
      const clone = bn.cloneNode(true);
      Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
      document.body.appendChild(clone);
      const naturalH = clone.scrollHeight; clone.remove();
      const txt = (s) => { const el = bn.querySelector(s); return el ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) : ''; };
      return {
        apt: txt('.apt-name') || txt('.main-title'),
        store: txt('.store-name'),
        cards: bn.querySelectorAll('.product-card').length,
        tableCols: bn.querySelectorAll('.benefit-table thead th, .benefit-table tr:first-child td').length,
        bannerH: bn.offsetHeight,
        naturalH,
        fit: naturalH <= 1806,
        storeFs: getComputedStyle(bn.querySelector('.store-name') || bn).fontSize,
      };
    });
    await p.locator('#bannerRoot .x-banner').screenshot({ path: path.join(OUT, `${String(i + 1).padStart(2, '0')}_${short}.png`) }).catch(() => {});
  }
  rows.push({ i: i + 1, short, ok, err, renderMs, ...info });
  console.log(`${String(i + 1).padStart(2)}. ${short.padEnd(20)} ${ok ? '✓' : '✗ ' + err} | ${renderMs}ms | 매장:${info.store || '-'} | 카드:${info.cards ?? '-'} | 표:${info.tableCols ?? '-'}칸 | 높이:${info.bannerH ?? '-'}(자연${info.naturalH ?? '-'}) | 맞춤:${info.fit ? 'O' : 'X'} | 매장명:${info.storeFs || '-'}`);
}

console.log('\n===== 요약 =====');
console.log('성공 렌더:', rows.filter(r => r.ok).length + '/' + rows.length);
console.log('1800 안에 맞춤:', rows.filter(r => r.ok && r.fit).length + '/' + rows.filter(r => r.ok).length);
console.log('매장명 35px 보호:', rows.filter(r => r.ok && r.storeFs === '35px').length + '/' + rows.filter(r => r.ok).length);
console.log('평균 렌더 시간:', Math.round(rows.filter(r => r.ok).reduce((s, r) => s + r.renderMs, 0) / rows.filter(r => r.ok).length) + 'ms');
console.log('페이지 에러:', pageErrors.length, pageErrors.slice(0, 3).join(' | '));
console.log('스크린샷:', OUT);
await b.close();
