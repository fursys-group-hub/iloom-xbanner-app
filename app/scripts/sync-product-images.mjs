// 제품 사진 매니페스트 재생성 — assets/products/<폴더>/ 의 "실제 파일"을 스캔해
// public/samples/product-images.json 을 다시 만든다. (사진 추가/교체 후 이 스크립트만 다시 실행)
//
// 진실의 원천 = 폴더에 실제로 존재하는 이미지 파일. (images-meta.json 도 실제와 어긋날 수 있어 신뢰하지 않음)
// 이름은 images-meta.json 의 product_name/series_name 을 우선 사용, 없으면 폴더명.
//
// 실행:  node scripts/sync-product-images.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR  = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..');
const PRODUCTS = path.join(ROOT_DIR, 'assets', 'products');
const OUT      = path.join(APP_DIR, 'public', 'samples', 'product-images.json');

const IMG_RE = /\.(png|jpe?g|webp|gif)$/i;
const encPath = (rel) => '/' + rel.split('/').map(encodeURIComponent).join('/');

function nameOf(dir, folder) {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'images-meta.json'), 'utf8'));
    return (meta.product_name || meta.series_name || '').trim() || folder.replace(/_/g, ' ');
  } catch {
    return folder.replace(/_/g, ' ');
  }
}

const folders = fs.readdirSync(PRODUCTS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, 'ko'));

const manifest = [];
let totalImgs = 0;
for (const folder of folders) {
  const dir = path.join(PRODUCTS, folder);
  const files = fs.readdirSync(dir)
    .filter((f) => IMG_RE.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!files.length) { console.log(`  (건너뜀: 이미지 없음) ${folder}`); continue; }
  const images = files.map((f) => encPath(`assets/products/${folder}/${f}`));
  manifest.push({ folder, name: nameOf(dir, folder), images });
  totalImgs += files.length;
  console.log(`  ✓ ${folder} → ${files.length}장  (${nameOf(dir, folder)})`);
}

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`\n제품 ${manifest.length}종 / 이미지 ${totalImgs}장 → ${path.relative(ROOT_DIR, OUT)}`);
