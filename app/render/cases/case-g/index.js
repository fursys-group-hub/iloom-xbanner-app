// 케이스 G — 도안 우미린 트리쉐이드형 (1아파트 + 2매장 + 추가혜택 카드 3종 + ★결제 카드 영역 제외)
// 케이스 A 와 차이: 혜택표 아래 ExtraBenefits(추가혜택 3종, 공동구매 세대수 칩) + 결제 영역 없음

import { Header }        from '../../components/header.js';
import { StoreBox }      from '../../components/store-box.js';
import { MaxBenefit }    from '../../components/max-benefit.js';
import { BenefitTable }  from '../../components/benefit-table.js';
import { ExtraBenefits } from '../../components/extra-benefits.js';
import { Notices }       from '../../components/notices.js';
import { Footer }        from '../../components/footer.js';
import { orderBlocks }   from '../../utils/order.js';

export function renderCaseG(data = {}) {
  return `
    <div class="x-banner case-g">
      ${Header(data)}
      ${StoreBox(data)}
      ${orderBlocks(data, [
        { key: 'maxBenefit', html: MaxBenefit(data.maxBenefit) },
        { key: 'table',      html: BenefitTable(data.benefitTable) },
        { key: 'extra',      html: ExtraBenefits(data.extraSection) },
        { key: 'notices',    html: Notices(data.notices) },
      ])}
      ${Footer(data.footer)}
    </div>
  `;
}
