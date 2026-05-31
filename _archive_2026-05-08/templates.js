// ============================================================
//  배너 템플릿 정의 — 일룸 X배너 단일 템플릿
// ============================================================

const TEMPLATES = [
  {
    id: 'template-iloom',
    name: '일룸 X배너',
    defaultData: {
      aptName: '광주 더파크 비스타 데시앙',
      mainTitle: '입주 특별 프로모션',
      period: '03.07 - 03.08',
      locationName1: '일룸 분당서현',
      locationName2: '일룸 분당',
      descBefore:    '입주박람회 현장에서만 드리는',
      descHighlight: '최대 109만원 특별 혜택',
      descAfter:     '지금 바로 만나 보세요!',
      columns: [
        { id: 'c0', header: '구매 금액' },
        { id: 'c1', header: '입주 아파트\n현장 계약 혜택' },
        { id: 'c2', header: 'LG연계 혜택' },
        { id: 'c3', header: '총 혜택' },
      ],
      tableRows: [
        { c0: '200만원~',  c1: '10만원',  c2: '-',    c3: '10만원'  },
        { c0: '300만원~',  c1: '20만원',  c2: '3만원', c3: '23만원'  },
        { c0: '500만원~',  c1: '40만원',  c2: '6만원', c3: '46만원'  },
        { c0: '700만원~',  c1: '60만원',  c2: '9만원', c3: '69만원'  },
        { c0: '1000만원~', c1: '100만원', c2: '9만원', c3: '109만원' },
      ],
      paySubtitle: '3가지 포인트 중 나에게 맞는\n적립 혜택으로 선택하세요!',
      payMicroText: '네이버 포인트 / L.POINT / SSG 머니 중 선택이 가능합니다.\n포인트는 제품 배송완료 기준으로 익월말경 지급 예정입니다.',
      notice: '본 프로모션은 통합회원 한정 프로모션입니다.\n혜택은 기간 이후 주문 건에는 적용이 불가합니다. 타 프로모션과 중복 불가합니다.\n포인트는 마지막 납기 후 익월 말 지급됩니다. (포인트 유효기간 이후 재발송 불가)\n주문 품목 변경은 일룸 분당서현, 일룸 분당에서만 가능합니다.',
    },
  },
];

// ============================================================
//  렌더러
// ============================================================

function renderBanner(_templateId, data) {
  return renderIloomBanner(data);
}

function renderIloomBanner(data) {
  const cols = data.columns || [];

  const headerCells = cols.map(col =>
    `<th>${escHtml(col.header).replace(/\n/g, '<br>')}</th>`
  ).join('');

  const tableRowsHtml = (data.tableRows || []).map(row => {
    const cells = cols.map(col =>
      `<td>${escHtml(row[col.id] || '')}</td>`
    ).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const noticeLines = (data.notice || '').split('\n').filter(l => l.trim());
  const noticeHtml = noticeLines.map(l => escHtml(l)).join('<br>');

  const paySubHtml     = (data.paySubtitle  || '').replace(/\n/g, '<br>');
  const payMicroHtml   = (data.payMicroText || '').replace(/\n/g, '<br>');
  const descBeforeHtml = (data.descBefore   || '').replace(/\n/g, '<br>');
  const descAfterHtml  = (data.descAfter    || '').replace(/\n/g, '<br>');

  return `
    <div class="banner-inner banner-template-iloom">

      <div class="il-welcome">WELCOME HOME</div>

      <div class="il-header-block">
        <span class="il-apt-name">${escHtml(data.aptName || '')}</span><br>
        <span class="il-main-title">${escHtml(data.mainTitle || '')}</span>
      </div>
      <div class="il-date">${escHtml(data.period || '')}</div>

      <div class="il-location-box">
        <div class="il-location-frame">
          ${escHtml(data.locationName1 || '')}<br>
          ${escHtml(data.locationName2 || '')}
        </div>
      </div>

      <div class="il-desc-text">
        ${descBeforeHtml ? `${descBeforeHtml}<br>` : ''}
        <strong>${escHtml(data.descHighlight || '')}</strong>
        ${descAfterHtml ? `<br>${descAfterHtml}` : ''}
      </div>

      <div class="il-section-wrapper">
        <div class="il-badge">구매 금액대별 혜택</div>
        <div class="il-card">
          <table class="il-table">
            <thead>
              <tr>${headerCells}</tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <div class="il-section-wrapper">
        <div class="il-badge">프로모션 혜택 지급 안내</div>
        <div class="il-card">
          <div class="il-point-text">${paySubHtml}</div>
          <div class="il-pay-logos">
            <span class="il-npay">N pay</span>
            <span class="il-lpoint">L.POINT</span>
            <span class="il-ssgpay">SSGPAY.</span>
          </div>
          <div class="il-micro-text">${payMicroHtml}</div>
        </div>
      </div>

      ${noticeHtml ? `<div class="il-disclaimer">${noticeHtml}</div>` : ''}

      <div class="il-logo-bottom">
        <img src="https://i.ibb.co/spxPXd3J/iloom-LOGO-Black-White-CMYK-1.png" alt="iloom" class="il-logo-img">
      </div>

    </div>
  `;
}

// ============================================================
//  유틸
// ============================================================

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
