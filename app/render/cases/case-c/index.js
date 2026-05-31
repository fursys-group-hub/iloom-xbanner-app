// 케이스 C — 디에이치 방배형 (제품 이미지 카드 + 하단 배경 이미지 + 컴팩트 결제)
// 케이스 A 와 차이: max-benefit 아래 ProductCards 3종 + 배경 이미지(.case-c) + 컴팩트 결제

import { Header }         from '../../components/header.js';
import { StoreBox }       from '../../components/store-box.js';
import { MaxBenefit }     from '../../components/max-benefit.js';
import { ProductCards }   from '../../components/product-cards.js';
import { BenefitTable }   from '../../components/benefit-table.js';
import { renderPayment }  from '../../components/payment.js';
import { Notices }        from '../../components/notices.js';
import { Footer }         from '../../components/footer.js';
import { orderBlocks }    from '../../utils/order.js';

export function renderCaseC(data = {}) {
  return `
    <div class="x-banner case-c">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'maxBenefit', html: MaxBenefit(data.maxBenefit) },
        { key: 'product',    html: ProductCards(data.productSection) },
        { key: 'table',      html: BenefitTable(data.benefitTable) },
        { key: 'payment',    html: renderPayment(data, 'compact') },
        { key: 'notices',    html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
