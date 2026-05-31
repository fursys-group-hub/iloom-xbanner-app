// ============================================================
//  일룸 배너 에디터 앱
// ============================================================

const _defaults = TEMPLATES[0].defaultData;
let state = {
  aptName:       _defaults.aptName,
  mainTitle:     _defaults.mainTitle,
  period:        _defaults.period,
  locationName1: _defaults.locationName1,
  locationName2: _defaults.locationName2,
  descBefore:    _defaults.descBefore,
  descHighlight: _defaults.descHighlight,
  descAfter:     _defaults.descAfter,
  columns:       _defaults.columns.map(c => ({ ...c })),
  tableRows:     _defaults.tableRows.map(r => ({ ...r })),
  paySubtitle:   _defaults.paySubtitle,
  payMicroText:  _defaults.payMicroText,
  notice:        _defaults.notice,
};

let previewZoom = null; // null = 자동 피팅

// ─── 초기화 ───
function init() {
  populateForm();
  bindEvents();
  renderTableEditor();
  updateBanner();
  window.addEventListener('resize', () => { if (previewZoom === null) updateBanner(); });
}

// ─── 폼 초기값 채우기 ───
function populateForm() {
  document.getElementById('aptName').value       = state.aptName;
  document.getElementById('mainTitle').value     = state.mainTitle;
  document.getElementById('period').value        = state.period;
  document.getElementById('locationName1').value = state.locationName1;
  document.getElementById('locationName2').value = state.locationName2;
  document.getElementById('descBefore').value    = state.descBefore;
  document.getElementById('descHighlight').value = state.descHighlight;
  document.getElementById('descAfter').value     = state.descAfter;
  document.getElementById('paySubtitle').value   = state.paySubtitle;
  document.getElementById('payMicroText').value  = state.payMicroText;
  document.getElementById('notice').value        = state.notice;
}

// ─── 이벤트 바인딩 ───
function bindEvents() {
  const textIds = [
    'aptName', 'mainTitle', 'period',
    'locationName1', 'locationName2',
    'descBefore', 'descHighlight', 'descAfter',
    'paySubtitle', 'payMicroText', 'notice',
  ];
  textIds.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      updateState();
      updateBanner();
    });
  });

  document.getElementById('addRowBtn').addEventListener('click', addRow);
  document.getElementById('addColBtn').addEventListener('click', addColumn);
  document.getElementById('exportPng').addEventListener('click', exportPng);
  document.getElementById('exportPdf').addEventListener('click', exportPdf);

  document.getElementById('zoomIn').addEventListener('click', () => {
    previewZoom = Math.min((previewZoom ?? getAutoScale()) + 0.05, 1);
    updateBanner();
  });
  document.getElementById('zoomOut').addEventListener('click', () => {
    previewZoom = Math.max((previewZoom ?? getAutoScale()) - 0.05, 0.1);
    updateBanner();
  });
  document.getElementById('zoomFit').addEventListener('click', () => {
    previewZoom = null;
    updateBanner();
  });
}

// ─── 상태 업데이트 ───
function updateState() {
  state.aptName       = document.getElementById('aptName').value;
  state.mainTitle     = document.getElementById('mainTitle').value;
  state.period        = document.getElementById('period').value;
  state.locationName1 = document.getElementById('locationName1').value;
  state.locationName2 = document.getElementById('locationName2').value;
  state.descBefore    = document.getElementById('descBefore').value;
  state.descHighlight = document.getElementById('descHighlight').value;
  state.descAfter     = document.getElementById('descAfter').value;
  state.paySubtitle   = document.getElementById('paySubtitle').value;
  state.payMicroText  = document.getElementById('payMicroText').value;
  state.notice        = document.getElementById('notice').value;
}

// ─── 열 추가/삭제/수정 ───
function addColumn() {
  const newId = 'c' + Date.now();
  state.columns.push({ id: newId, header: '' });
  state.tableRows.forEach(row => { row[newId] = ''; });
  renderTableEditor();
  updateBanner();
}

function removeColumn(colId) {
  state.columns = state.columns.filter(c => c.id !== colId);
  renderTableEditor();
  updateBanner();
}

function updateColumnHeader(colId, value) {
  const col = state.columns.find(c => c.id === colId);
  if (col) col.header = value;
  updateBanner();
}

// ─── 행 추가/삭제 ───
function addRow() {
  const newRow = {};
  state.columns.forEach(col => { newRow[col.id] = ''; });
  state.tableRows.push(newRow);
  renderTableEditor();
  updateBanner();
}

function removeRow(idx) {
  state.tableRows.splice(idx, 1);
  renderTableEditor();
  updateBanner();
}

function updateCell(rowIdx, colId, value) {
  state.tableRows[rowIdx][colId] = value;
  updateBanner();
}

// ─── 표 에디터 렌더링 ───
function renderTableEditor() {
  const cols = state.columns;
  const gridCols = `repeat(${cols.length}, 1fr) 28px`;

  const headEl = document.getElementById('tableHead');
  headEl.style.gridTemplateColumns = gridCols;
  headEl.innerHTML = cols.map(col => `
    <div class="th-cell">
      <input class="th-input" type="text"
        value="${escAttr(col.header)}"
        placeholder="열 이름"
        oninput="updateColumnHeader('${col.id}', this.value)">
      <button class="remove-col-btn" onclick="removeColumn('${col.id}')" title="열 삭제">×</button>
    </div>
  `).join('') + '<span></span>';

  const rowsEl = document.getElementById('tableRows');
  rowsEl.innerHTML = state.tableRows.map((row, i) => `
    <div class="tbl-row" style="grid-template-columns: ${gridCols}">
      ${cols.map(col => `
        <input class="field-input" type="text"
          value="${escAttr(row[col.id] || '')}"
          placeholder=""
          oninput="updateCell(${i}, '${col.id}', this.value)">
      `).join('')}
      <button class="remove-row-btn" onclick="removeRow(${i})" title="삭제">×</button>
    </div>
  `).join('');
}

// ─── 자동 피팅 스케일 계산 (너비 기준) ───
// 600×1800 세로 배너: 미리보기 너비를 꽉 채우도록 스케일 (1 초과 허용)
function getAutoScale() {
  const previewArea = document.querySelector('.preview-area');
  if (!previewArea) return 0.45;
  const availW = previewArea.offsetWidth - 64; // 좌우 패딩(32px×2) 제외
  return Math.max(availW / 600, 0.3);
}

// ─── 배너 렌더링 ───
function updateBanner() {
  const container = document.getElementById('bannerContainer');
  container.innerHTML = renderBanner('template-iloom', state);
  const inner = container.querySelector('.banner-inner');
  if (!inner) return;

  // 콘텐츠가 600×1800 초과 시 내부 축소 비율 계산
  inner.style.transform = 'none';
  const fitScale = Math.min(
    inner.scrollHeight > 1800 ? 1800 / inner.scrollHeight : 1,
    inner.scrollWidth  > 600  ? 600  / inner.scrollWidth  : 1,
  );

  // 미리보기 줌 (null = 자동 피팅)
  const viewScale = previewZoom ?? getAutoScale();
  const totalScale = fitScale * viewScale;

  inner.style.transformOrigin = 'top left';
  inner.style.transform = `scale(${totalScale})`;
  container.style.width  = `${600  * viewScale}px`;
  container.style.height = `${1800 * viewScale}px`;

  const indicator = document.getElementById('zoomIndicator');
  if (indicator) indicator.textContent = `${Math.round(viewScale * 100)}%`;
}

// ─── PNG 내보내기 ───
async function exportPng() {
  showLoading('고화질 PNG 생성 중...');
  try {
    const bannerHtml = renderBanner('template-iloom', state);
    const res = await fetch('/api/export/png', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerHtml, scale: 3 }),
    });
    if (!res.ok) throw new Error(await res.text());
    downloadBlob(await res.blob(), `banner_${Date.now()}.png`);
  } catch (e) {
    console.warn('서버 PNG 실패, 클라이언트 폴백:', e.message);
    await exportPngFallback();
  } finally {
    hideLoading();
  }
}

async function exportPngFallback() {
  const el = createExportElement();
  document.body.appendChild(el);
  await document.fonts.ready;
  const canvas = await html2canvas(el, {
    width: 600, height: 1800, scale: 3,
    useCORS: true, allowTaint: true, backgroundColor: null, logging: false,
  });
  document.body.removeChild(el);
  const link = document.createElement('a');
  link.download = `banner_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

// ─── PDF 내보내기 ───
async function exportPdf() {
  showLoading('인쇄용 PDF 생성 중...\nPuppeteer 렌더링, 잠시 기다려주세요');
  try {
    const bannerHtml = renderBanner('template-iloom', state);
    const res = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerHtml }),
    });
    if (!res.ok) throw new Error(await res.text());
    downloadBlob(await res.blob(), `banner_${Date.now()}.pdf`);
  } catch (e) {
    console.error('PDF 오류:', e);
    alert('PDF 생성 오류.\n서버가 실행 중인지 확인해주세요 (node server.js)');
  } finally {
    hideLoading();
  }
}

function createExportElement() {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;height:1800px;overflow:hidden;z-index:-1;';
  wrapper.innerHTML = renderBanner('template-iloom', state);
  const inner = wrapper.querySelector('.banner-inner');
  if (inner) inner.style.transform = 'none';
  return wrapper;
}

// ─── 유틸 ───
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function escAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showLoading(msg) {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-box">
        <div class="loading-spinner"></div>
        <div class="loading-text">${msg.replace(/\n/g, '<br>')}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector('.loading-text').innerHTML = msg.replace(/\n/g, '<br>');
  }
  overlay.classList.add('active');
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ─── 앱 시작 ───
document.addEventListener('DOMContentLoaded', () => {
  requestAnimationFrame(() => init()); // 레이아웃 완료 후 실행
});
