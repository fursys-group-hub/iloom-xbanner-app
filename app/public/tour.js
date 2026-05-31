// 첫 사용 튜토리얼 — 미리보기 직접편집 흐름을 스포트라이트로 안내.
// 가벼운 안내(페이지 클릭을 막지 않음). 첫 진입 1회 자동, 이후 "도움말"로 재실행.

const TOUR_KEY = 'iloom-xbanner-tour-done';

const STEPS = [
  { sel: '[data-tour="preview"]', title: '여기서 바로 고쳐요',
    body: '미리보기에서 고치고 싶은 곳(제목·매장·표·결제 등)을 그냥 누르면, 그 자리에서 바로 편집할 수 있어요.' },
  { sel: '[data-tour="review"]', title: '꼭 확인할 곳만 모았어요',
    body: '품의서에서 자동으로 채운 것 중 한 번 봐야 할 항목이에요. 누르면 그 위치로 데려가고, 확인하면 목록에서 사라져요.' },
  { sel: '[data-tour="polish"]', title: '전체 다듬기',
    body: '큰 문구의 톤, 하단 배경 사진, 영역 순서를 여기서 바꿀 수 있어요.' },
  { sel: '[data-tour="export"]', title: '다 됐으면 내려받기',
    body: '확인이 끝나면 PNG/PDF로 받아서 인쇄소에 보내세요.' },
];

let idx = 0;
let overlay = null;

function buildOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.innerHTML = `
    <div class="tour-hole"></div>
    <div class="tour-pop" role="dialog" aria-modal="false">
      <div class="tour-step"></div>
      <h3 class="tour-title"></h3>
      <p class="tour-body"></p>
      <div class="tour-actions">
        <button type="button" class="tour-skip">건너뛰기</button>
        <button type="button" class="tour-next btn btn-primary btn-sm"></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.tour-skip').addEventListener('click', end);
  overlay.querySelector('.tour-next').addEventListener('click', next);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', position);
}

function onKey(e) {
  if (e.key === 'Escape' && overlay) { e.stopPropagation(); end(); }
}

function show() {
  const step = STEPS[idx];
  const target = document.querySelector(step.sel);
  if (!target) { next(); return; }   // 대상이 없으면 건너뜀
  overlay.querySelector('.tour-step').textContent = `${idx + 1} / ${STEPS.length}`;
  overlay.querySelector('.tour-title').textContent = step.title;
  overlay.querySelector('.tour-body').textContent = step.body;
  overlay.querySelector('.tour-next').textContent = idx === STEPS.length - 1 ? '시작하기' : '다음';
  position();
}

function position() {
  if (!overlay) return;
  const target = document.querySelector(STEPS[idx].sel);
  if (!target) return;
  const r = target.getBoundingClientRect();
  const pad = 6;
  const hole = overlay.querySelector('.tour-hole');
  Object.assign(hole.style, {
    left: `${r.left - pad}px`, top: `${r.top - pad}px`,
    width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
  });
  const pop = overlay.querySelector('.tour-pop');
  const pw = pop.offsetWidth, ph = pop.offsetHeight, m = 16, edge = 10;
  let left = r.right + m;
  if (left + pw > window.innerWidth - edge) left = r.left - pw - m;   // 오른쪽 안 되면 왼쪽
  if (left < edge) left = Math.min(Math.max(edge, r.left), window.innerWidth - pw - edge);
  let top = Math.min(Math.max(edge, r.top), window.innerHeight - ph - edge);
  Object.assign(pop.style, { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` });
}

function next() {
  idx += 1;
  if (idx >= STEPS.length) { end(); return; }
  show();
}

function end() {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* noop */ }
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', position);
  overlay?.remove();
  overlay = null;
}

// 언제든 재실행 (도움말 버튼) — done 플래그 무시
export function startTour() {
  if (overlay) return;
  idx = 0;
  buildOverlay();
  show();
}

// 첫 진입 1회만 자동
export function maybeStartTour() {
  if (navigator.webdriver) return;   // 자동화(Playwright 검증)에선 자동 시작 안 함
  try { if (localStorage.getItem(TOUR_KEY)) return; } catch { /* noop */ }
  setTimeout(() => {
    if (document.querySelector('[data-tour="preview"]')) startTour();
  }, 450);
}
