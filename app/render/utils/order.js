// 중간 영역 순서·숨김 — data._order(키 배열) 로 정렬, data._hidden(키 배열) 은 제외.
// 헤더/매장/푸터는 케이스 템플릿에 고정. 빈(html 없는) 블록은 자동 제외.
// 숨김은 비파괴적: 데이터는 state 에 남고 렌더(미리보기·내보내기)에서만 빠짐.
// blocks: [{ key, html }]
export function orderBlocks(data, blocks) {
  const order = data?._order;
  const hidden = Array.isArray(data?._hidden) ? data._hidden : [];
  const list = (blocks || []).filter((b) => b && b.html && b.html.trim() && !hidden.includes(b.key));
  if (Array.isArray(order) && order.length) {
    list.sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return list.map((b) => b.html).join('\n      ');
}
