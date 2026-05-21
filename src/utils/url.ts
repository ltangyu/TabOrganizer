/**
 * URL 標準化（給「同 URL 去重」判斷用）：
 * - 去掉 fragment（#hash 後）
 * - 去掉結尾多餘斜線
 * - 不去 querystring（不同 query 視為不同頁面）
 *
 * 例：
 *   "https://example.com/foo/"       → "https://example.com/foo"
 *   "https://example.com/foo#bar"    → "https://example.com/foo"
 *   "https://example.com/foo?x=1"    → "https://example.com/foo?x=1"
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, '');
    if (!path) path = '/';
    return u.protocol + '//' + u.host + path + u.search;
  } catch {
    return url;
  }
}
