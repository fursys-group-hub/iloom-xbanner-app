// 케이스 E — 창원 롯데캐슬형 (1아파트 + 박람회 2회 단지별 카드 + 4컬럼표 + 제품 1종 + 컴팩트 결제)
// 케이스 A 와 차이: max-benefit 아래 Fairs(박람회 2회 카드) + 컴팩트 결제

import { Header }         from '../../components/header.js';
import { StoreBox }       from '../../components/store-box.js';
import { MaxBenefit }     from '../../components/max-benefit.js';
import { Fairs }          from '../../components/fairs.js';
import { BenefitTable }   from '../../components/benefit-table.js';
import { ProductCards }   from '../../components/product-cards.js';
import { SpecialPromoGrid } from '../../components/special-promo-grid.js';
import { renderPayment }  from '../../components/payment.js';
import { Notices }        from '../../components/notices.js';
import { Footer }         from '../../components/footer.js';
import { orderBlocks }    from '../../utils/order.js';

export function renderCaseE(data = {}) {
  return `
    <div class="x-banner case-e">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'maxBenefit', html: MaxBenefit(data.maxBenefit) },
        { key: 'fairs',      html: Fairs(data.fairsSection) },
        { key: 'table',      html: BenefitTable(data.benefitTable) },
        { key: 'product',    html: ProductCards(data.productSection) },
        { key: 'promo',      html: data._hasRealPromo ? SpecialPromoGrid({ ...data.specialPromoSection, layout: data._promoLayout }) : '' },
        { key: 'payment',    html: renderPayment(data, 'compact') },
        { key: 'notices',    html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
