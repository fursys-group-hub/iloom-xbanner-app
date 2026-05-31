// X배너 어플 — 일룸 제품 가이드(iloomproduct.fursys.com) 이미지 자동 수집
//
// 사용법: node fetch-product-images.mjs <page_id> <시리즈명> [--all-images]
// 예시: node fetch-product-images.mjs 20494 컬렉트
//
// 저장 경로: c:\Users\suzzz\Desktop\iloom_workspace\3. 일룸 인쇄용X배너 어플\assets\products\{시리즈명}\
//
// 출력:
//   - 이미지 파일 (PNG/JPG)
//   - images-meta.json (alt, w/h, parent text 등 메타데이터)
//
// 실행 환경: 입문교육 프로젝트의 playwright 활용 필요
//   cd "C:\Users\suzzz\Desktop\iloom_workspace\1. 일룸 영업직군 교육\1) 입문교육"
//   node "..\..\3. 일룸 인쇄용X배너 어플\scripts\fetch-product-images.mjs" 20494 컬렉트

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== 설정 =====
const LOGIN_URL = 'https://iloomproduct.fursys.com/wp-login.php';
const ID = 'seoyeon_lee';
const PW = 'iloomguide2020';

// X배너 어플 프로젝트의 assets 폴더 (이 스크립트가 어디서 실행되든 항상 동일 경로)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_ROOT = path.join(PROJECT_ROOT, 'assets', 'products');

// ===== 인자 파싱 =====
const args = process.argv.slice(2);
const ALL_IMAGES = args.includes('--all-images');  // 작은 이미지도 포함 (기본: 200x200 이상만)
const MIN_SIZE = ALL_IMAGES ? 0 : 200;
const positional = args.filter((a) => !a.startsWith('--'));

if (positional.length < 2) {
  console.error('❌ 사용법: node fetch-product-images.mjs <page_id> <시리즈명> [--all-images]');
  console.error('   예시: node fetch-product-images.mjs 20494 컬렉트');
  process.exit(1);
}

const pageId = positional[0];
const seriesName = positional[1];
const TARGET_URL = `https://iloomproduct.fursys.com/?p=${pageId}`;

const OUTPUT_DIR = path.join(ASSETS_ROOT, seriesName);
const META_PATH = path.join(OUTPUT_DIR, 'images-meta.json');
await fs.mkdir(OUTPUT_DIR, { recursive: true });

console.log(`\n📦 ${seriesName} (page_id=${pageId})`);
console.log(`   → ${OUTPUT_DIR}\n`);

// ===== 파일명 정리 =====
function sanitizeFilename(name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const clean = base.replace(/[^A-Za-z0-9_.\-]/g, '').replace(/_+$/, '').replace(/^_+/, '') || 'unnamed';
  return clean + ext.toLowerCase();
}

// ===== Playwright 시작 =====
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

console.log('1) 로그인...');
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
await page.fill('#user_login', ID);
await page.fill('#user_pass', PW);
await page.click('#wp-submit');
await page.waitForLoadState('networkidle');
console.log('   ✓ 로그인 완료');

// ===== 탭 5개 순회하여 모든 이미지 수집 =====
const allImages = [];
for (let tabNo = 1; tabNo <= 5; tabNo++) {
  console.log(`\n2-${tabNo}) 탭 ${tabNo} 로딩...`);
  const url = tabNo === 1 ? TARGET_URL : `${TARGET_URL}&page=${tabNo}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const images = await page.evaluate((minSize) => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => img.naturalWidth >= minSize && img.naturalHeight >= minSize)
      .map((img) => {
        const parentText = (img.parentElement?.innerText || '').trim().slice(0, 200);
        const grandText = (img.parentElement?.parentElement?.innerText || '').trim().slice(0, 300);
        const prev = img.previousElementSibling?.textContent?.trim().slice(0, 100) || '';
        const next = img.nextElementSibling?.textContent?.trim().slice(0, 100) || '';
        return {
          src: img.src,
          alt: img.alt || '',
          w: img.naturalWidth,
          h: img.naturalHeight,
          parent_text: parentText,
          grand_text: grandText,
          prev_text: prev,
          next_text: next,
        };
      });
  }, MIN_SIZE);

  for (const img of images) {
    img.tab = tabNo;
    allImages.push(img);
  }
  console.log(`   이미지 ${images.length}개 발견 (${MIN_SIZE}px 이상)`);
}

// ===== 중복 제거 (같은 src) =====
const uniq = new Map();
for (const img of allImages) {
  if (!uniq.has(img.src)) uniq.set(img.src, img);
}
const unique = Array.from(uniq.values());
console.log(`\n📊 중복 제거 후: ${unique.length}개`);

// ===== 다운로드 (로컬 저장) =====
console.log('\n3) 다운로드 → 로컬 저장...');
const meta = [];
let i = 0;
let okCount = 0;
let errCount = 0;

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
      local_path: `assets/products/${seriesName}/${baseName}`,
      size_kb: Math.round(buf.length / 1024),
      ...img,
    });
    okCount++;
    console.log(`   ✓ ${baseName} (${(buf.length / 1024).toFixed(0)}KB)`);
  } catch (e) {
    errCount++;
    console.log(`   ❌ ${img.src.slice(0, 80)}... 실패: ${e.message.slice(0, 60)}`);
  }
}

// ===== 메타 저장 =====
await fs.writeFile(META_PATH, JSON.stringify({
  series_name: seriesName,
  page_id: Number(pageId),
  source_url: TARGET_URL,
  fetched_at: new Date().toISOString(),
  total_images: okCount,
  failed: errCount,
  images: meta,
}, null, 2), 'utf-8');

await browser.close();

console.log(`\n✅ 완료: ${okCount}건 저장 / ${errCount}건 실패`);
console.log(`   📁 폴더: ${OUTPUT_DIR}`);
console.log(`   📄 메타: ${META_PATH}`);
