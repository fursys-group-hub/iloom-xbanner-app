import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'output');
// 1) 대구범어 PDF → state
const buf = fs.readFileSync(path.join(ROOT, '참고자료', '대구범어 아이파크2차 입주 공략의 건(수성점).pdf'));
const fd = new FormData();
fd.append('pdf', new Blob([buf], { type: 'application/pdf' }), 'd.pdf');
const state = await (await fetch('http://localhost:3000/api/extract', { method: 'POST', body: fd })).json();
// 2) preview-dynamic 에 주입 → 풀 배너 캡처 (내보내기와 동일 경로)
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 700, height: 1900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.addInitScript((s) => { window.__state__ = s; }, state);
await p.goto('http://localhost:3000/preview-dynamic.html', { waitUntil: 'networkidle' });
await p.locator('.x-banner').first().waitFor();
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.locator('.x-banner').first().screenshot({ path: path.join(OUT, 'bg_daegu_full.png') });
await b.close();
console.log('saved · has-bg=' + (state._caseId === 'case-c'));
