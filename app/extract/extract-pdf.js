// PDF 텍스트 + 좌표 덤프 (pdfjs-dist legacy build for Node ESM)
//
// 반환 형태:
// {
//   numPages: 5,
//   pages: [
//     {
//       pageNumber: 1,
//       viewport: { width, height },
//       items: [
//         { str: '아파트명', x, y, width, height, fontHeight, dir },
//         ...
//       ],
//       lines: [           // y 좌표 클러스터링한 줄 단위 (편의용)
//         { y, items: [...], text: '...' }
//       ]
//     }
//   ]
// }

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const PDFJS_PATH = 'pdfjs-dist/legacy/build/pdf.mjs';

let pdfjsLib;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(PDFJS_PATH);
  return pdfjsLib;
}

// PDF 의 좌표 시스템: 원점 좌하단. y 가 클수록 위쪽.
// item.transform = [a, b, c, d, e, f] (CSS matrix). e, f 는 x, y 위치. d 는 폰트 높이.
function transformItem(item, viewport) {
  const [a, b, c, d, e, f] = item.transform;
  const x = e;
  const yFromBottom = f;
  const y = viewport.height - yFromBottom;   // y 좌표를 페이지 상단 기준으로 뒤집음
  return {
    str: item.str,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(item.width || 0),
    height: Math.round(item.height || Math.abs(d) || 0),
    fontHeight: Math.abs(d) || Math.abs(a) || 0,
    dir: item.dir,
  };
}

// y 좌표가 같은 line 으로 묶기 (5px 미만 차이는 같은 줄로 간주)
function clusterIntoLines(items, tolerance = 5) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tolerance) {
      last.items.push(it);
      last.y = (last.y + it.y) / 2;
    } else {
      lines.push({ y: it.y, items: [it] });
    }
  }
  // 줄 안에서 x 순으로 정렬 + 텍스트 합치기
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map((i) => i.str).join('').replace(/\s+/g, ' ').trim();
  }
  return lines;
}

export async function extractPdf(pdfPathOrData) {
  const lib = await loadPdfjs();
  const pdfjs = lib.default ?? lib;

  let data;
  if (typeof pdfPathOrData === 'string') {
    const buf = await fs.readFile(pdfPathOrData);
    data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else if (Buffer.isBuffer(pdfPathOrData)) {
    // Buffer 는 Uint8Array 서브클래스지만 pdfjs 가 정확한 Uint8Array 만 받음
    data = new Uint8Array(pdfPathOrData.buffer, pdfPathOrData.byteOffset, pdfPathOrData.byteLength);
  } else if (pdfPathOrData instanceof Uint8Array) {
    data = pdfPathOrData;
  } else {
    throw new Error('extractPdf: 입력은 파일경로 / Uint8Array / Buffer 만 지원');
  }

  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,         // node 에서 폰트 로딩 차단 (텍스트만 필요)
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent({ includeMarkedContent: false });
    const items = tc.items
      .filter((i) => i.str !== undefined)
      .map((i) => transformItem(i, vp));
    const lines = clusterIntoLines(items);
    pages.push({
      pageNumber: p,
      viewport: { width: vp.width, height: vp.height },
      items,
      lines,
    });
  }

  // 파괴자 호출 — Node 에서 메모리 누수 방지
  await pdfDoc.cleanup();
  await pdfDoc.destroy();

  return { numPages, pages };
}

// CLI 진입점 — 디버그 편의
// 사용법: node extract/extract-pdf.js <pdf경로>
const __thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && __thisFile === path.resolve(process.argv[1])) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('사용법: node extract/extract-pdf.js <pdf경로>');
    process.exit(1);
  }
  const abs = path.resolve(arg);
  const result = await extractPdf(abs);
  console.log(`📄 ${abs}`);
  console.log(`   페이지 ${result.numPages}장`);
  for (const page of result.pages) {
    console.log(`\n--- 페이지 ${page.pageNumber} (${Math.round(page.viewport.width)}×${Math.round(page.viewport.height)}) — ${page.lines.length} 줄, ${page.items.length} 토큰`);
    for (const line of page.lines.slice(0, 60)) {
      console.log(`  y=${String(line.y).padStart(4)}  ${line.text}`);
    }
    if (page.lines.length > 60) console.log(`  ... +${page.lines.length - 60} 줄 더`);
  }
}
