import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(() => new Promise((res) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    res({
      size: [img.naturalWidth, img.naturalHeight],
      corner_TL: px(1, 1),
      corner_TR: px(img.naturalWidth - 2, 1),
      center: px(img.naturalWidth >> 1, img.naturalHeight >> 1),
    });
  };
  img.onerror = () => res({ error: true });
  img.src = '/assets/products/iloom-logo.png';
}));
console.log(JSON.stringify(r));
await b.close();
