// 미리보기 페이지 전용 — window.__state__ 가 있으면 그걸로 렌더 (서버 캡처용)
// 없으면 samples/case-a-default.json fetch (수동 열람용)

import { renderBanner } from '/render/render-banner.js';
import { fitBanner, applyBackground } from '/fit-banner.js';

const ROOT_SEL = '#bannerRoot';

async function loadDefaultSample() {
  const res = await fetch('/samples/case-a-default.json');
  if (!res.ok) throw new Error(`samples 로드 실패 (${res.status})`);
  return res.json();
}

async function boot() {
  const root = document.querySelector(ROOT_SEL);
  if (!root) {
    console.error('#bannerRoot 가 페이지에 없습니다.');
    return;
  }
  try {
    const data = window.__state__ ?? (await loadDefaultSample());
    root.innerHTML = renderBanner(data);
    // 폰트 로딩 후 배경 적용 + 배너별 빈 공간 자동 채움 (내보내기 캡처 전에 적용)
    const fit = () => {
      const bn = root.querySelector('.x-banner');
      applyBackground(bn, window.state ?? data);
      fitBanner(bn);
    };
    if (document.fonts?.ready) { await document.fonts.ready; }
    fit();
    window.state = data;
    window.renderAgain = () => { root.innerHTML = renderBanner(window.state); fit(); };
    console.log('✅ 미리보기 렌더 완료:', data._caseId, '·', data.aptName);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<pre style="padding:24px;color:#FF453A;font-family:monospace;">${err.message}</pre>`;
  }
}

boot();
