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
