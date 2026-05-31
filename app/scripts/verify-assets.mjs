// 자산 검증 — 제품 사진 매니페스트의 모든 이미지 + 배경 이미지가 실제로 200 으로 서빙되는지
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const BASE = 'http://localhost:3000';

const manifest = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'public', 'samples', 'product-images.json'), 'utf8'));
const prodUrls = manifest.flatMap((p) => p.images);
const bgUrls = [
  '/assets/full bakground/침실 배경.jpg',
  '/assets/full bakground/쿠시노 배경.jpg',
  '/assets/full bakground/레마 배경.jpg',
  '/assets/full bakground/필즈 배경.jpg',
  '/assets/full bakground/헤이즐 배경.jpg',
].map((u) => '/' + u.split('/').map(encodeURIComponent).join('/').replace(/^\//, ''));

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}`); };

await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

async function checkAll(label, urls) {
  const bad = [];
  for (const u of urls) {
    const st = await p.evaluate(async (url) => { try { const r = await fetch(url, { method: 'HEAD' }); return r.status; } catch { return 0; } }, u);
    if (st !== 200) bad.push(`${decodeURIComponent(u)} → ${st}`);
  }
  ok(`${label}: ${urls.length}개 전부 200`, bad.length === 0);
  if (bad.length) bad.slice(0, 12).forEach((x) => console.log('     ✗', x));
  return bad.length;
}

console.log(`제품 이미지 ${prodUrls.length}개 · 배경 ${bgUrls.length}개 점검`);
const b1 = await checkAll('제품 사진', prodUrls);
const b2 = await checkAll('배경 사진', bgUrls);

await b.close();
console.log(`\n결과: ${pass} 통과 / ${fail} 실패 (누락 제품 ${b1} · 배경 ${b2})`);
process.exit(fail === 0 ? 0 : 1);
