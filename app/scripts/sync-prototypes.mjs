// 시제품 폴더의 X배너 HTML을 app/public/prototypes/로 복사하면서
// 상대경로 자산을 절대경로로 일괄 치환 — 어플에서 띄울 수 있게.
//
// 사용법: node scripts/sync-prototypes.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR      = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(APP_DIR, '..');
const SRC_DIR      = path.join(PROJECT_ROOT, '시제품');
const DST_DIR      = path.join(APP_DIR, 'public', 'prototypes');

// X배너 HTML만 대상
const TARGETS = [
  { src: '광주데시앙_X배너_v8.html',           dst: 'v08_광주데시앙.html',           label: 'v8  · 광주 더파크 비스타 데시앙 (케이스 A · 5컬럼 골든 표준)' },
  { src: '한화포레나_X배너_v9.html',           dst: 'v09_한화포레나.html',           label: 'v9  · 한화포레나 대전월평공원 (케이스 B · 특별 프로모션 2x2)' },
  { src: '디에이치방배_X배너_v10.html',        dst: 'v10_디에이치방배.html',        label: 'v10 · 디에이치 방배 (케이스 C · 제품 카드 + 침실 배경)' },
  { src: '잠실래미안_잠실르엘_X배너_v11.html', dst: 'v11_잠실래미안_잠실르엘.html', label: 'v11 · 잠실래미안 + 잠실르엘 (케이스 D · 2아파트 + 6컬럼)' },
  { src: '창원롯데캐슬_X배너_v12.html',        dst: 'v12_창원롯데캐슬.html',        label: 'v12 · 창원 롯데캐슬 (케이스 E · 박람회 2회)' },
  { src: '교대역모아엘가_X배너_v13.html',      dst: 'v13_교대역모아엘가.html',      label: 'v13 · 교대역 모아엘가 (케이스 C 변형 · 제품 카드 2종)' },
  { src: '도안우미린트리쉐이드_X배너_v14.html', dst: 'v14_도안우미린트리쉐이드.html', label: 'v14 · 도안 우미린 트리쉐이드 (케이스 G · 결제 카드 미운용)' },
];

await fs.mkdir(DST_DIR, { recursive: true });

const summary = [];
for (const { src, dst, label } of TARGETS) {
  const srcPath = path.join(SRC_DIR, src);
  const dstPath = path.join(DST_DIR, dst);

  let html;
  try {
    html = await fs.readFile(srcPath, 'utf8');
  } catch (e) {
    summary.push({ src, dst, ok: false, reason: 'src 없음' });
    continue;
  }

  // 자산 경로 절대화: ../assets/ → /assets/
  html = html
    .replace(/(\.\.\/)+assets\//g, '/assets/')
    .replace(/href="assets\//g, 'href="/assets/')
    .replace(/src="assets\//g, 'src="/assets/');

  // 상단 주석으로 label 추가 (디버그 편의)
  html = html.replace(/<head>/, `<head>\n  <!-- ${label} -->\n  <!-- 원본: 시제품/${src} (자동 복사 by sync-prototypes.mjs) -->`);

  await fs.writeFile(dstPath, html, 'utf8');
  const stat = await fs.stat(dstPath);
  summary.push({ src, dst, ok: true, kb: (stat.size / 1024).toFixed(0) + 'KB' });
}

console.log('✅ 시제품 동기화 완료 →', DST_DIR);
console.log('');
for (const r of summary) {
  if (r.ok) console.log(`  ✓ ${r.src.padEnd(50)} → ${r.dst}  (${r.kb})`);
  else      console.log(`  ✗ ${r.src.padEnd(50)} 실패: ${r.reason}`);
}
console.log('');
console.log('🔗 URL: http://localhost:3000/prototypes/<파일명>');
