// 케이스 B — 한화포레나형 (4컬럼 + 특별 프로모션 2x2 그리드 + 컴팩트 결제)
// 케이스 A 와 차이: SpecialPromoGrid 추가 + 결제 안내 컴팩트(1줄 로고)

import { Header }           from '../../components/header.js';
import { StoreBox }         from '../../components/store-box.js';
import { MaxBenefit }       from '../../components/max-benefit.js';
import { BenefitTable }     from '../../components/benefit-table.js';
import { SpecialPromoGrid } from '../../components/special-promo-grid.js';
import { renderPayment }    from '../../components/payment.js';
import { Notices }          from '../../components/notices.js';
import { Footer }           from '../../components/footer.js';
import { orderBlocks }      from '../../utils/order.js';

export function renderCaseB(data = {}) {
  return `
    <div class="x-banner case-b">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'maxBenefit', html: MaxBenefit(data.maxBenefit) },
        { key: 'table',      html: BenefitTable(data.benefitTable) },
        { key: 'promo',      html: SpecialPromoGrid({ ...data.specialPromoSection, layout: data._promoLayout }) },
        { key: 'payment',    html: renderPayment(data, 'compact') },
        { key: 'notices',    html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
