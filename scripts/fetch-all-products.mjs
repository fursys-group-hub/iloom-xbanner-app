// X배너 어플 — 모든 제품 이미지 일괄 자동 수집
//
// 사용법: node scripts/fetch-all-products.mjs [--skip-existing] [--only=<시리즈명>,<...>]
//
// 1번 로그인 후 21개 제품 페이지 순회하면서 이미지 다운로드.
// 제품_라이브러리.json의 page_id가 있는 모든 제품 처리.
//
// 옵션:
//   --skip-existing: 이미 폴더에 images-meta.json이 있으면 스킵
//   --only=업모션,핀: 지정한 시리즈만 처리

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_ROOT = path.join(PROJECT_ROOT, 'assets', 'products');
const LIBRARY_PATH = path.join(PROJECT_ROOT, '어플_설계', '제품_라이브러리.json');

const LOGIN_URL = 'https://iloomproduct.fursys.com/wp-login.php';
const ID = 'seoyeon_lee';
const PW = 'iloomguide2020';
const MIN_SIZE = 200;

// ===== 인자 파싱 =====
const args = process.argv.slice(2);
const SKIP_EXISTING = args.includes('--skip-existing');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY_LIST = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : null;

// ===== 제품 라이브러리에서 수집 대상 추출 =====
const library = JSON.parse(await fs.readFile(LIBRARY_PATH, 'utf-8'));
const targets = [];
for (const category of Object.values(library.카테고리)) {
  for (const product of category.제품) {
    if (!product.page_id) continue;
    if (ONLY_LIST && !ONLY_LIST.includes(product.이미지_폴더)) continue;
    targets.push({
      id: product.id,
      이름: product.이름,
      page_id: product.page_id,
      폴더: product.이미지_폴더,
    });
  }
}

console.log(`\n📋 수집 대상: ${targets.length}개 제품\n`);
targets.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.이름} (p=${t.page_id}) → ${t.폴더}/`));
console.log('');

// ===== 파일명 정리 =====
function sanitizeFilename(name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const clean = base.replace(/[^A-Za-z0-9_.\-]/g, '').replace(/_+$/, '').replace(/^_+/, '') || 'unnamed';
  return clean + ext.toLowerCase();
}

// ===== Playwright 1번 로그인 후 순회 =====
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

console.log('🔐 로그인...');
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
await page.fill('#user_login', ID);
await page.fill('#user_pass', PW);
await page.click('#wp-submit');
await page.waitForLoadState('networkidle');
console.log('   ✓ 로그인 완료\n');

const summary = [];
let totalOk = 0;
let totalErr = 0;
let totalSkipped = 0;

for (let idx = 0; idx < targets.length; idx++) {
  const target = targets[idx];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${idx + 1}/${targets.length}] ${target.이름} (p=${target.page_id})`);
  console.log('='.repeat(60));

  const OUTPUT_DIR = path.join(ASSETS_ROOT, target.폴더);
  const META_PATH = path.join(OUTPUT_DIR, 'images-meta.json');

  if (SKIP_EXISTING) {
    try {
      await fs.access(META_PATH);
      console.log('   ⏭️  이미 수집됨 — 스킵');
      totalSkipped++;
      continue;
    } catch {}
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const TARGET_URL = `https://iloomproduct.fursys.com/?p=${target.page_id}`;

  // 5개 탭 순회
  const allImages = [];
  for (let tabNo = 1; tabNo <= 5; tabNo++) {
    const url = tabNo === 1 ? TARGET_URL : `${TARGET_URL}&page=${tabNo}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log(`   탭${tabNo}: 로딩 실패 (${e.message.slice(0, 40)})`);
      continue;
    }

    const images = await page.evaluate((minSize) => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .filter((img) => img.naturalWidth >= minSize && img.naturalHeight >= minSize)
        .map((img) => ({
          src: img.src,
          alt: img.alt || '',
          w: img.naturalWidth,
          h: img.naturalHeight,
          parent_text: (img.parentElement?.innerText || '').trim().slice(0, 200),
          grand_text: (img.parentElement?.parentElement?.innerText || '').trim().slice(0, 300),
          prev_text: img.previousElementSibling?.textContent?.trim().slice(0, 100) || '',
          next_text: img.nextElementSibling?.textContent?.trim().slice(0, 100) || '',
        }));
    }, MIN_SIZE);

    for (const img of images) {
      img.tab = tabNo;
      allImages.push(img);
    }
    if (images.length > 0) console.log(`   탭${tabNo}: ${images.length}개`);
  }

  // 중복 제거
  const uniq = new Map();
  for (const img of allImages) {
    if (!uniq.has(img.src)) uniq.set(img.src, img);
  }
  const unique = Array.from(uniq.values());
  console.log(`   📊 ${unique.length}개 (중복 제거 후)`);

  // 다운로드
  const meta = [];
  let okCount = 0;
  let errCount = 0;
  let i = 0;
  for (const img of unique) {
    i++;
    const ext = (path.extname(new URL(img.src).pathname) || '.png').toLowerCase();
    const baseName = sanitizeFilename(`${String(i).padStart(2, '0')}_${img.w}x${img.h}_tab${img.tab}${ext}`);
    const filePath = path.join(OUTPUT_DIR, baseName);

    try {
      const response = await page.request.get(img.src);
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      const buf = await response.body();
      await fs.writeFile(filePath, buf);
      meta.push({
        file: baseName,
        local_path: `assets/products/${target.폴더}/${baseName}`,
        size_kb: Math.round(buf.length / 1024),
        ...img,
      });
      okCount++;
    } catch (e) {
      errCount++;
    }
  }

  await fs.writeFile(META_PATH, JSON.stringify({
    series_name: target.폴더,
    product_name: target.이름,
    product_id: target.id,
    page_id: target.page_id,
    source_url: TARGET_URL,
    fetched_at: new Date().toISOString(),
    total_images: okCount,
    failed: errCount,
    images: meta,
  }, null, 2), 'utf-8');

  console.log(`   ✅ ${okCount}건 저장 / ${errCount}건 실패`);
  totalOk += okCount;
  totalErr += errCount;
  summary.push({ 이름: target.이름, 폴더: target.폴더, page_id: target.page_id, 수집: okCount, 실패: errCount });
}

await browser.close();

// ===== 요약 출력 =====
console.log(`\n\n${'='.repeat(60)}`);
console.log('🎯 일괄 수집 완료 요약');
console.log('='.repeat(60));
console.log(`총 제품: ${targets.length}개`);
console.log(`이미지 수집: ${totalOk}장`);
console.log(`실패: ${totalErr}건`);
console.log(`스킵: ${totalSkipped}건\n`);

console.log('📊 제품별 수집 결과:');
console.log('┌──────────────────────────────────┬─────┬──────┐');
console.log('│ 제품명                           │ 수집 │ 실패 │');
console.log('├──────────────────────────────────┼─────┼──────┤');
for (const s of summary) {
  const name = s.이름.padEnd(30, ' ').slice(0, 30);
  const ok = String(s.수집).padStart(3, ' ');
  const err = String(s.실패).padStart(3, ' ');
  console.log(`│ ${name} │ ${ok} │ ${err}  │`);
}
console.log('└──────────────────────────────────┴─────┴──────┘');
