// 제품 카드 1개 삭제 시 자동 분배(fitBanner)가 다시 도는지 검증
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PDF = path.join(ROOT, '참고자료', '일룸 프리미엄샵 논현 디에이치 방배 입주 공략의건.pdf');

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();

async function measure() {
  return p.evaluate(() => {
    const banner = document.querySelector('#bannerRoot .x-banner');
    const clone = banner.cloneNode(true);
    Object.assign(clone.style, { position: 'absolute', left: '-9999px', top: '0', height: 'auto', overflow: 'visible', transform: 'none' });
    document.body.appendChild(clone);
    const naturalH = clone.scrollHeight;
    clone.remove();
    return {
      productCards: banner.querySelectorAll('.product-card').length,
      bannerH: banner.offsetHeight,
      naturalH,
      gapGroup: banner.style.getPropertyValue('--gap-group').trim() || '(인라인 없음=표준 60)',
      storeFs: getComputedStyle(banner.querySelector('.store-name')).fontSize,
    };
  });
}

await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.setInputFiles('#pdfFile', PDF);
await p.waitForSelector('#bannerRoot .x-banner .product-card', { timeout: 15000 });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);

const before = await measure();
console.log('\n[삭제 전] 제품카드', before.productCards + '개');
console.log('   배너높이', before.bannerH + 'px  ·  콘텐츠 자연높이', before.naturalH + 'px');
console.log('   그룹간격(--gap-group):', before.gapGroup, ' ·  매장명:', before.storeFs);

// 제품 카드 1개 삭제 (실제 UI 흐름: 카드 클릭 → "이 카드 삭제")
await p.click('#bannerRoot .x-banner [data-edit="card"][data-kind="product"]');
await p.waitForSelector('[data-card-del]', { timeout: 5000 });
await p.click('[data-card-del]');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);

const after = await measure();
console.log('\n[삭제 후] 제품카드', after.productCards + '개');
console.log('   배너높이', after.bannerH + 'px  ·  콘텐츠 자연높이', after.naturalH + 'px');
console.log('   그룹간격(--gap-group):', after.gapGroup, ' ·  매장명:', after.storeFs);

console.log('\n===== 판정 =====');
console.log(before.productCards > after.productCards ? '✓ 카드 1개 실제로 삭제됨 (' + before.productCards + '→' + after.productCards + ')' : '✗ 삭제 안 됨');
console.log(after.bannerH === 1800 ? '✓ 삭제 후에도 배너 높이 1800px 유지(분배 재실행됨)' : '✗ 높이 ' + after.bannerH);
console.log(before.gapGroup !== after.gapGroup ? '✓ 그룹 간격이 재분배됨 (' + before.gapGroup + ' → ' + after.gapGroup + ')' : '· 간격 동일(' + after.gapGroup + ') — 변화 없을 수도');
console.log(after.storeFs === '35px' ? '✓ 매장명 35px 계속 보호됨' : '✗ 매장명 ' + after.storeFs);

await b.close();
