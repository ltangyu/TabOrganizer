import type { ArchivedTab, Category } from '@/types/archive';

export function searchArchives(
  archives: ArchivedTab[],
  categories: Category[],
  query: string,
): ArchivedTab[] {
  const q = query.trim().toLowerCase();
  if (!q) return archives;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return archives;

  const categoryNameById = new Map<number, string>();
  for (const c of categories) {
    if (c.id != null) categoryNameById.set(c.id, c.name.toLowerCase());
  }

  return archives.filter((a) => {
    const hay = [
      a.title.toLowerCase(),
      a.url.toLowerCase(),
      a.domain,
      a.categoryId != null ? categoryNameById.get(a.categoryId) ?? '' : '',
    ].join(' ');
    return tokens.every((t) => hay.includes(t));
  });
}
