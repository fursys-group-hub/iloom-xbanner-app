import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const bgs = ['침실 배경.jpg','쿠시노 배경.jpg','레마 배경.jpg','필즈 배경.jpg','헤이즐 배경.jpg'];
for (const name of bgs) {
  const url = '/assets/full bakground/' + name;
  const enc = '/' + url.split('/').map(encodeURIComponent).join('/').replace(/^\//,'');
  const dim = await p.evaluate((u) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([0,0]); i.src = u; }), enc);
  const [w,h] = dim;
  const dispH = w ? Math.round(600 * h / w) : 0;          // 폭 600 맞췄을 때 높이
  const topPct = w ? Math.round((1800 - dispH) / 1800 * 100) : 0;  // 배너 상단에서 사진 윗변까지 %
  console.log(`${name}: ${w}x${h}  → 폭600시 높이 ${dispH}px  → 사진 윗변 ${topPct}% 지점`);
}
await b.close();
