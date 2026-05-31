/**
 * banner-app 서버
 * - 정적 파일 서빙 (index.html, css, js)
 * - /api/export/pdf  → Puppeteer로 고품질 PDF 생성
 * - /api/export/png  → Puppeteer로 고화질 PNG 생성
 */

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────────
//  공통: Puppeteer로 배너 캡처
// ─────────────────────────────────────────
async function captureBanner(bannerHtml, format, scale = 3) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 배너 HTML 전체 페이지 구성
    const fullHtml = buildFullHtml(bannerHtml);
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // 실제 배너 크기: 600 × 1800px (뷰포트 기준)
    await page.setViewport({ width: 600, height: 1800, deviceScaleFactor: scale });

    // 폰트 로딩 대기
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 500)); // 렌더링 안정화

    // 콘텐츠가 600×1800을 초과하면 자동 축소
    await page.evaluate(() => {
      const inner = document.querySelector('.banner-inner');
      if (!inner) return;
      const h = inner.scrollHeight;
      const w = inner.scrollWidth;
      const scale = Math.min(
        h > 1800 ? 1800 / h : 1,
        w > 600  ? 600  / w : 1
      );
      if (scale < 1) {
        inner.style.transform = `scale(${scale})`;
        inner.style.transformOrigin = 'top left';
      }
    });

    if (format === 'pdf') {
      // PDF: X배너 실물 비율 유지 (A0 세로에 가까운 비율)
      // 실제 인쇄 크기: 600mm × 1800mm (60cm × 180cm)
      const pdfBuffer = await page.pdf({
        width: '600mm',
        height: '1800mm',
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      return { buffer: pdfBuffer, mimeType: 'application/pdf', ext: 'pdf' };
    } else {
      // PNG: 고해상도
      const element = await page.$('.banner-inner');
      const pngBuffer = await element.screenshot({
        type: 'png',
        omitBackground: false,
      });
      return { buffer: pngBuffer, mimeType: 'image/png', ext: 'png' };
    }
  } finally {
    await browser.close();
  }
}

// Puppeteer에서 렌더링할 전체 HTML 페이지
function buildFullHtml(bannerHtml) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=600">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 600px; height: 1800px; overflow: hidden; }
    ${fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8')}
    /* Puppeteer 렌더용: 미리보기 스케일 제거 */
    .banner-inner { transform: none !important; }
    .banner-container { width: 600px; height: 1800px; }
  </style>
</head>
<body>
  ${bannerHtml}
</body>
</html>`;
}

// ─────────────────────────────────────────
//  API: PDF 내보내기
// ─────────────────────────────────────────
app.post('/api/export/pdf', async (req, res) => {
  try {
    const { bannerHtml } = req.body;
    if (!bannerHtml) return res.status(400).json({ error: 'bannerHtml required' });

    const { buffer, mimeType, ext } = await captureBanner(bannerHtml, 'pdf');
    const filename = `banner_${Date.now()}.${ext}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  API: PNG 내보내기
// ─────────────────────────────────────────
app.post('/api/export/png', async (req, res) => {
  try {
    const { bannerHtml, scale = 3 } = req.body;
    if (!bannerHtml) return res.status(400).json({ error: 'bannerHtml required' });

    const { buffer, mimeType, ext } = await captureBanner(bannerHtml, 'png', scale);
    const filename = `banner_${Date.now()}.${ext}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PNG export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  서버 시작
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 배너 에디터 실행 중: http://localhost:${PORT}`);
  console.log(`   인쇄용 PDF/PNG는 서버를 통해 생성됩니다.`);
});
