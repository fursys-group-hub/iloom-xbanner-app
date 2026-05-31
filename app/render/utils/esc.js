// HTML 이스케이프 — 사용자 입력이 HTML 태그로 해석되지 않도록 막음 (XSS 방지)

const HTML_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_MAP[ch]);
}

const ATTR_MAP = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escAttr(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&"']/g, (ch) => ATTR_MAP[ch]);
}
