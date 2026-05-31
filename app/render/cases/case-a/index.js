// 케이스 A — 광주데시앙 v8 골든 표준 (5컬럼 + card_1 결제 안내)
// 영역 부품을 순서대로 호출해 .x-banner 한 장 조립

import { Header }        from '../../components/header.js';
import { StoreBox }      from '../../components/store-box.js';
import { MaxBenefit }    from '../../components/max-benefit.js';
import { BenefitTable }  from '../../components/benefit-table.js';
import { renderPayment } from '../../components/payment.js';
import { Notices }       from '../../components/notices.js';
import { Footer }        from '../../components/footer.js';
import { orderBlocks }   from '../../utils/order.js';

export function renderCaseA(data = {}) {
  return `
    <div class="x-banner">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'maxBenefit', html: MaxBenefit(data.maxBenefit) },
        { key: 'table',      html: BenefitTable(data.benefitTable) },
        { key: 'payment',    html: renderPayment(data, 'card_1') },
        { key: 'notices',    html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
