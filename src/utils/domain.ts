export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function domainMatchesRule(domain: string, rule: string): boolean {
  const r = rule.toLowerCase().trim();
  if (!r) return false;
  if (r.startsWith('*.')) {
    const suffix = r.slice(2);
    return domain === suffix || domain.endsWith('.' + suffix);
  }
  return domain === r;
}

/**
 * 取得 domain 的「基底」— registrable domain，給「自動依 domain 分類」用。
 *
 * "shop.pinkoi.com"          → "pinkoi.com"
 * "docs.google.com"          → "google.com"
 * "moneyball.com.tw"         → "moneyball.com.tw"（com.tw 是 2-part TLD）
 * "example.co.uk"            → "example.co.uk"
 *
 * 沒用完整 PSL，只 hardcode 最常見的 2-part TLD（夠用 99% 情況）。
 */
const TWO_PART_TLDS = new Set([
  'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.in', 'co.id', 'co.il', 'co.th',
  'com.tw', 'com.cn', 'com.hk', 'com.sg', 'com.au', 'com.br', 'com.mx', 'com.tr',
  'com.ar', 'com.my', 'com.ph', 'com.vn', 'com.pk', 'com.sa', 'com.eg',
  'ac.uk', 'gov.uk', 'org.uk', 'ac.jp', 'gov.tw', 'edu.tw',
  'net.tw', 'org.tw',
]);

export function baseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const last2 = parts.slice(-2).join('.');
  if (TWO_PART_TLDS.has(last2)) {
    return parts.slice(-3).join('.');
  }
  return last2;
}

export function isInternalUrl(url: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('moz-extension://') ||
    url.startsWith('view-source:') ||
    url.startsWith('devtools://')
  );
}

export function slugifyForFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
