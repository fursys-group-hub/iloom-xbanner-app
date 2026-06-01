/**
 * 일룸 X배너 어플 서버
 * - 정적 파일 서빙 (public/, 상위 assets/)
 * - /api/extract     : 품의서 PDF → 자동 추출 state JSON
 * - /api/render      : state JSON → 배너 HTML (디버그용)
 * - /api/export/png  : state JSON → 고해상도 PNG (Puppeteer)
 * - /api/export/pdf  : state JSON → 600mm×1800mm 인쇄용 PDF
 */

import express from 'express';
import multer from 'multer';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileP = promisify(execFile);
import { extractPdf } from './extract/extract-pdf.js';
import { extractBasicInfo } from './extract/parsers/basic-info.js';
import { extractBenefitTable } from './extract/parsers/benefit-table.js';
import { extractPromotions } from './extract/parsers/promotions.js';
import { extractNotices } from './extract/parsers/notices.js';
import { extractPayment } from './extract/parsers/payment.js';
import * as store from './lib/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const APP_DIR    = __dirname;                              // .../3. 일룸 .../app
const ROOT_DIR   = path.resolve(APP_DIR, '..');            // .../3. 일룸 ...
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');          // 상위 폴더 assets 공유

const app    = express();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });   // 20MB 한도
app.use(express.json({ limit: '10mb' }));

// 정적 파일 서빙
app.use(express.static(PUBLIC_DIR));
app.use('/assets', express.static(ASSETS_DIR));
// /assets 루트에 없는 파일은 하위 'point logo' 폴더에서 찾기 (시제품 HTML 호환)
app.use('/assets', express.static(path.join(ASSETS_DIR, 'point logo')));
// 렌더 모듈 — 브라우저에서 ESM import 할 수 있게 정적 서빙
app.use('/render', express.static(path.join(APP_DIR, 'render')));
// Pretendard 로컬 폰트 (CDN 의존 제거 — PDF 폰트 임베드 + 캡처 안정)
app.use('/fonts/pretendard', express.static(path.join(APP_DIR, 'node_modules', 'pretendard', 'dist', 'web', 'static')));

// 시제품 폴더(검증용 픽셀 비교 시 참고) — 읽기 전용
// 한글 mount path는 일부 환경에서 URL 매칭 이슈가 있어 영문 alias 사용
app.use('/prototypes', express.static(path.join(ROOT_DIR, '시제품')));
app.use('/시제품',    express.static(path.join(ROOT_DIR, '시제품')));

// 헬스체크
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '0.1.0', appDir: APP_DIR });
});

// ─────────────────────────────────────────
//  /api/extract — 품의서 PDF 업로드 → 어플 state 형태로 추출
// ─────────────────────────────────────────
import { pdfDataToAppState } from './extract/to-app-state.js';

// PDF 안에 있는 "의미 있는 글자" 총량 — 스캔본(사진) PDF 는 글자 토큰이 거의 없다.
function countText(pdf) {
  let n = 0;
  for (const pg of pdf.pages || []) {
    for (const it of pg.items || []) n += (it.str || '').trim().length;
  }
  return n;
}

// 추출 단계 기술 에러 → 영업담당이 알아들을 수 있는 안내로 변환.
// { status, code, error } 반환 (code 는 프론트가 분기용으로 쓸 수 있음).
function friendlyExtractError(err) {
  const name = err?.name || '';
  const msg  = String(err?.message || '');
  if (name === 'PasswordException' || /password/i.test(msg)) {
    return { status: 422, code: 'PASSWORD', error: '비밀번호가 걸린 PDF예요. 비밀번호를 푼 다음 다시 올려주세요.' };
  }
  if (name === 'InvalidPDFException' || /invalid pdf|structure|may not be a pdf|xref/i.test(msg)) {
    return { status: 422, code: 'INVALID_PDF', error: 'PDF 파일을 열 수 없어요. 파일이 손상됐거나 PDF가 아닌 파일일 수 있어요. 품의서 PDF를 다시 확인해 주세요.' };
  }
  return { status: 500, code: 'EXTRACT_FAILED', error: '품의서를 분석하는 중 문제가 생겼어요. 같은 PDF로 다시 시도하거나, 미리보기에서 직접 입력해 만들 수 있어요.' };
}

app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ code: 'NO_FILE', error: 'PDF 파일을 올려주세요.' });
  try {
    const pdf = await extractPdf(req.file.buffer);

    // 스캔본(사진으로 만든) PDF 막다른 길 방지 — 글자가 거의 없으면 조용히 빈 값 대신 친절 안내
    if (countText(pdf) < 20) {
      return res.status(422).json({
        code: 'NO_TEXT',
        error: '글자가 인식되지 않는 PDF예요. 사진(스캔)으로 만든 품의서는 자동으로 읽을 수 없어요. '
             + '글자를 복사할 수 있는(텍스트) PDF로 다시 올리거나, 미리보기에서 직접 입력해 만들 수 있어요.',
      });
    }

    const basic      = await extractBasicInfo(pdf);
    const benefit    = await extractBenefitTable(pdf);
    const promotions = await extractPromotions(pdf);
    const notices    = await extractNotices(pdf);
    const payment    = await extractPayment(pdf);
    const state      = pdfDataToAppState({ basic, benefit, promotions, notices, payment });
    state._extraction.source = req.file.originalname;
    res.json(state);
  } catch (err) {
    console.error('[extract] 실패:', err);
    const f = friendlyExtractError(err);
    res.status(f.status).json({ code: f.code, error: f.error });
  }
});

// ─────────────────────────────────────────
//  /api/export/png  /api/export/pdf — state → 인쇄용 캡처
//  Playwright 헤드리스로 /preview-dynamic.html 에 state 주입한 뒤 캡처
// ─────────────────────────────────────────
// 인쇄용 PDF 출력 전략 — scripts/export-xbanner-pdf.mjs 와 동일 (검증된 방법)
// 사용자 v14 시제품 인쇄용 PDF 도 이 스크립트가 만든 것 (Skia/PDF · Chromium).
//
// 핵심: 인쇄용 PDF = 트림 600×1800px + 도련(bleed) + 재단선(crop marks)
// → 인쇄소가 3.78× 확대 출력 시 600×1800mm. 도련은 재단 오차 시 흰 선 방지.
// + Ghostscript 가 있으면 RGB → CMYK 변환 (인쇄업체 요구). 없으면 RGB 그대로 + 경고.

// 인쇄 도련/재단 여유(px, 600px=158.75mm 기준): 3px ≈ 3mm(at 최종 600mm) 도련 + 재단선 여유
const BLEED = 9;   // 트림 사방 9px 여백(도련 3px + 재단선 6px 분)

// ── Ghostscript 탐지 (1회 캐시) ──
// 1) PATH 의 명령(gswin64c/gs) → 2) 표준 설치 경로(C:\Program Files\gs\gsX\bin\gswin64c.exe)
//    PATH 전파 안 돼도 설치만 돼 있으면 찾도록 경로 직접 탐색
let _gsPath;   // undefined=미확인, null=없음, string=경로/명령
async function findGhostscript() {
  if (_gsPath !== undefined) return _gsPath;
  for (const cmd of ['gswin64c', 'gswin32c', 'gs']) {
    try { await execFileP(cmd, ['--version']); _gsPath = cmd; return cmd; } catch { /* 다음 후보 */ }
  }
  for (const base of ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs']) {
    try {
      for (const dir of fs.readdirSync(base)) {
        const exe = path.join(base, dir, 'bin', 'gswin64c.exe');
        if (fs.existsSync(exe)) { _gsPath = exe; return exe; }
        const exe32 = path.join(base, dir, 'bin', 'gswin32c.exe');
        if (fs.existsSync(exe32)) { _gsPath = exe32; return exe32; }
      }
    } catch { /* base 없음 */ }
  }
  _gsPath = null;
  return null;
}

// RGB PDF 버퍼 → CMYK 변환 (gs 없으면 원본 + cmyk:false)
async function toCmyk(pdfBuffer) {
  const gs = await findGhostscript();
  if (!gs) return { buffer: pdfBuffer, cmyk: false };
  const tmp  = os.tmpdir();
  const tag  = `xb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inP  = path.join(tmp, `${tag}_in.pdf`);
  const outP = path.join(tmp, `${tag}_out.pdf`);
  await fs.promises.writeFile(inP, pdfBuffer);
  try {
    await execFileP(gs, [
      '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dAutoRotatePages=/None',
      '-sDEVICE=pdfwrite',
      '-dProcessColorModel=/DeviceCMYK',
      '-sColorConversionStrategy=CMYK',
      `-sOutputFile=${outP}`, inP,
    ]);
    const out = await fs.promises.readFile(outP);
    return { buffer: out, cmyk: true };
  } catch (err) {
    console.error('[CMYK] 변환 실패 — RGB 로 폴백:', err.message);
    return { buffer: pdfBuffer, cmyk: false };
  } finally {
    fs.promises.unlink(inP).catch(() => {});
    fs.promises.unlink(outP).catch(() => {});
  }
}

async function captureBannerWith(state, format) {
  const isPdf  = format === 'pdf';
  // verify-step4 와 동일하게 매번 새 브라우저 launch (재사용 시 CDN 폰트 로드 실패 회피)
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: isPdf
      ? { width: 600, height: 1800 }
      : { width: 1280, height: 2000 },
    deviceScaleFactor: isPdf ? 1 : 2,
  });
  const page = await ctx.newPage();
  try {
    await page.addInitScript((injected) => { window.__state__ = injected; }, state);
    await page.goto(`http://localhost:${PORT}/preview-dynamic.html`, { waitUntil: 'networkidle', timeout: 10_000 });
    await page.locator('.x-banner').first().waitFor({ timeout: 5_000 });
    // 폰트 로딩 완료 대기 (PNG·PDF 공통 — 한글 폰트 깨짐 방지)
    // ※ () => document.fonts.ready 는 FontFaceSet 직렬화 실패로 실제 대기 안 함 → async/await 필수
    await page.evaluate(async () => { await document.fonts.ready; });

    if (isPdf) {
      // 미디어 = 트림(600×1800) + 사방 BLEED. 배너를 BLEED 만큼 안쪽에 두고,
      // 바깥 여백은 배너 배경색(크림)으로 채워 도련(bleed) 처리. 트림 모서리에 재단선.
      const mediaW = 600 + BLEED * 2;
      const mediaH = 1800 + BLEED * 2;
      await page.addStyleTag({
        content: `
          @page { size: ${mediaW}px ${mediaH}px; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FFF5EE !important;   /* 도련 영역 = 배너 배경색 */
            width: ${mediaW}px !important;
            height: ${mediaH}px !important;
            overflow: hidden !important;
            display: block !important;
          }
          .x-banner {
            box-shadow: none !important;
            position: absolute !important;
            top: ${BLEED}px !important;
            left: ${BLEED}px !important;
          }
          .crop-mark { position: absolute; background: #000; z-index: 99999; }
        `,
      });
      // 재단선(crop marks) — 트림 네 모서리에 L자 (도련 바깥쪽으로 뻗음)
      await page.evaluate(({ B }) => {
        const g = 3, L = 5, t = 0.8;        // 트림과의 간격, 길이, 두께
        const x0 = B, y0 = B, x1 = B + 600, y1 = B + 1800;   // 트림 모서리 좌표
        const m = [];
        const add = (x, y, w, h) => m.push(`<div class="crop-mark" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;"></div>`);
        // 각 모서리: 세로선(세로 트림변 연장) + 가로선(가로 트림변 연장)
        add(x0, y0 - g - L, t, L);   add(x0 - g - L, y0, L, t);   // TL
        add(x1 - t, y0 - g - L, t, L); add(x1 + g, y0, L, t);     // TR
        add(x0, y1 + g, t, L);       add(x0 - g - L, y1 - t, L, t); // BL
        add(x1 - t, y1 + g, t, L);   add(x1 + g, y1 - t, L, t);   // BR
        document.body.insertAdjacentHTML('beforeend', m.join(''));
      }, { B: BLEED });
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(async () => { await document.fonts.ready; });
    }
    await page.waitForTimeout(isPdf ? 1500 : 800);

    if (isPdf) {
      const mediaW = 600 + BLEED * 2;
      const mediaH = 1800 + BLEED * 2;
      const rgb = await page.pdf({
        width:           `${mediaW}px`,
        height:          `${mediaH}px`,
        printBackground: true,
        margin:          { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const { buffer, cmyk } = await toCmyk(rgb);   // gs 있으면 CMYK, 없으면 RGB
      return { buffer, mimeType: 'application/pdf', ext: 'pdf', cmyk };
    }

    const target = page.locator('.x-banner').first();
    const buffer = await target.screenshot({ type: 'png', omitBackground: false });
    return { buffer, mimeType: 'image/png', ext: 'png' };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

app.post('/api/export/png', async (req, res) => {
  try {
    const state = req.body?.state;
    if (!state) return res.status(400).json({ error: 'state required' });
    const { buffer, mimeType, ext } = await captureBannerWith(state, 'png');
    const filename = `xbanner_${(state.aptName || 'banner').replace(/\s+/g, '')}_${Date.now()}.${ext}`;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  } catch (err) {
    console.error('[export PNG] 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    const state = req.body?.state;
    if (!state) return res.status(400).json({ error: 'state required' });
    const { buffer, mimeType, ext, cmyk } = await captureBannerWith(state, 'pdf');
    const filename = `xbanner_${(state.aptName || 'banner').replace(/\s+/g, '')}_${Date.now()}.${ext}`;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('X-Color-Mode', cmyk ? 'cmyk' : 'rgb');   // 클라이언트 경고용
    res.setHeader('Access-Control-Expose-Headers', 'X-Color-Mode');
    res.send(buffer);
  } catch (err) {
    console.error('[export PDF] 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
//  로그인 / 작업물 저장·불러오기 / 공유 (Supabase)
// ─────────────────────────────────────────
// 토큰에서 사용자 추출 (Authorization: Bearer <token>)
function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  return store.verifyToken(token);   // { uid, name } 또는 null
}
function requireAuth(req, res) {
  if (!store.storeReady) { res.status(503).json({ error: '저장 기능이 아직 설정되지 않았어요.' }); return null; }
  const u = authUser(req);
  if (!u) { res.status(401).json({ error: '로그인이 필요해요.' }); return null; }
  return u;
}

// 로그인 또는 신규 가입 (이름 처음이면 비밀번호 설정)
app.post('/api/auth/login', async (req, res) => {
  if (!store.storeReady) return res.status(503).json({ error: '저장 기능이 아직 설정되지 않았어요.' });
  try {
    const { name, password } = req.body || {};
    const r = await store.loginOrSignup(name, password);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ name: r.user.name, token: r.token, isNew: r.isNew });
  } catch (err) {
    console.error('[auth] 실패:', err);
    res.status(500).json({ error: '로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
});
// 현재 로그인 확인
app.get('/api/auth/me', (req, res) => {
  const u = authUser(req);
  if (!u) return res.status(401).json({ error: 'no session' });
  res.json({ name: u.name });
});

// 내 배너 목록
app.get('/api/banners', async (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  try { res.json(await store.listBanners(u.uid)); }
  catch (err) { console.error('[banners list]', err); res.status(500).json({ error: '목록을 불러오지 못했어요.' }); }
});
// 배너 하나 열기
app.get('/api/banners/:id', async (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  try {
    const b = await store.getBanner(u.uid, req.params.id);
    if (!b) return res.status(404).json({ error: '없는 배너예요.' });
    res.json(b);
  } catch (err) { console.error('[banner get]', err); res.status(500).json({ error: '불러오지 못했어요.' }); }
});
// 저장(신규/갱신)
app.post('/api/banners', async (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  try {
    const { id, title, data, thumb } = req.body || {};
    if (!data) return res.status(400).json({ error: '저장할 내용이 없어요.' });
    const saved = await store.saveBanner(u.uid, { id, title: title || '제목 없음', data, thumb });
    res.json(saved);
  } catch (err) { console.error('[banner save]', err); res.status(500).json({ error: '저장하지 못했어요.' }); }
});
// 삭제
app.delete('/api/banners/:id', async (req, res) => {
  const u = requireAuth(req, res); if (!u) return;
  try { await store.deleteBanner(u.uid, req.params.id); res.json({ ok: true }); }
  catch (err) { console.error('[banner del]', err); res.status(500).json({ error: '삭제하지 못했어요.' }); }
});
// 공유 — 로그인 없이 읽기 전용 데이터
app.get('/api/share/:shareId', async (req, res) => {
  if (!store.storeReady) return res.status(503).json({ error: '준비되지 않았어요.' });
  try {
    const b = await store.getSharedBanner(req.params.shareId);
    if (!b) return res.status(404).json({ error: '공유된 배너를 찾을 수 없어요.' });
    res.json(b);
  } catch (err) { console.error('[share]', err); res.status(500).json({ error: '불러오지 못했어요.' }); }
});
// 공유 뷰어 페이지 (로그인 없이) — /s/<shareId>
app.get('/s/:shareId', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'share.html'));
});

// 업로드 단계(multer) 오류 → 친절 안내 (라우트보다 먼저 터지므로 별도 핸들러 필요)
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'PDF 파일이 너무 커요(최대 20MB). 더 작은 파일로 올려주세요.'
      : `파일 업로드 중 문제가 생겼어요. (${err.code})`;
    return res.status(413).json({ code: err.code, error: msg });
  }
  if (err) {
    console.error('[server] 처리 오류:', err);
    return res.status(500).json({ code: 'SERVER_ERROR', error: '서버에서 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
  next();
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ 일룸 X배너 어플 실행: http://localhost:${PORT}`);
  console.log(`   public:  ${PUBLIC_DIR}`);
  console.log(`   assets:  ${ASSETS_DIR}`);
});
