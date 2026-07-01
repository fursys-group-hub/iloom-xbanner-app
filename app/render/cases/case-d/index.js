// 케이스 D — 잠실래미안+잠실르엘형 (2아파트 + 이중기간 + 축하형 + 6컬럼 표 + 후기 이벤트 2카드 + 컴팩트 결제)
// 케이스 A 와 차이: Header 이중기간 라인 + Celebration(축하형) + ReviewEvent + 결제 compact

import { Header }       from '../../components/header.js';
import { StoreBox }     from '../../components/store-box.js';
import { Celebration }  from '../../components/celebration.js';
import { BenefitTable } from '../../components/benefit-table.js';
import { ReviewEvent }  from '../../components/review-event.js';
import { SpecialPromoGrid } from '../../components/special-promo-grid.js';
import { renderPayment } from '../../components/payment.js';
import { Notices }      from '../../components/notices.js';
import { Footer }       from '../../components/footer.js';
import { orderBlocks }  from '../../utils/order.js';

export function renderCaseD(data = {}) {
  return `
    <div class="x-banner case-d">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'celebration', html: Celebration(data.celebration) },
        { key: 'table',       html: BenefitTable(data.benefitTable) },
        { key: 'review',      html: ReviewEvent(data.reviewSection) },
        { key: 'promo',       html: data._hasRealPromo ? SpecialPromoGrid({ ...data.specialPromoSection, layout: data._promoLayout }) : '' },
        { key: 'payment',     html: renderPayment(data, 'card_2') },
        { key: 'notices',     html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
