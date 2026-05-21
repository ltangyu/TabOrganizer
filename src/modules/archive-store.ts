import Dexie, { type Table } from 'dexie';
import type {
  ArchivedTab,
  Category,
  DomainRule,
  ExcludedRecord,
  ScanHistory,
} from '@/types/archive';
import { normalizeUrl } from '@/utils/url';

class TabOrganizerDB extends Dexie {
  archives!: Table<ArchivedTab, number>;
  categories!: Table<Category, number>;
  domainRules!: Table<DomainRule, number>;
  excluded!: Table<ExcludedRecord, number>;
  scanHistory!: Table<ScanHistory, number>;

  constructor() {
    super('TabOrganizerDB');
    this.version(1).stores({
      archives: '++id, url, domain, categoryId, archivedAt, status, [categoryId+archivedAt]',
      categories: '++id, name, createdAt',
      domainRules: '++id, domain, categoryId',
      excluded: '++id, url, domain, excludedAt',
      scanHistory: '++id, ranAt',
    });
  }
}

export const db = new TabOrganizerDB();

export async function listCategories(): Promise<Category[]> {
  return await db.categories.orderBy('createdAt').toArray();
}

export async function createCategory(
  name: string,
  color = '#000000',
  builtinKey?: string,
): Promise<number> {
  const rec: Category = { name, color, createdAt: Date.now() };
  if (builtinKey) rec.builtinKey = builtinKey;
  return (await db.categories.add(rec)) as number;
}

export async function updateCategory(id: number, patch: Partial<Category>): Promise<void> {
  await db.categories.update(id, patch);
}

export async function deleteCategory(id: number): Promise<void> {
  await db.transaction('rw', db.categories, db.domainRules, db.archives, async () => {
    await db.categories.delete(id);
    await db.domainRules.where('categoryId').equals(id).delete();
    await db.archives.where('categoryId').equals(id).modify({ categoryId: null });
  });
}

export async function listDomainRules(): Promise<DomainRule[]> {
  return await db.domainRules.toArray();
}

export async function addDomainRule(domain: string, categoryId: number): Promise<number> {
  return (await db.domainRules.add({ domain: domain.toLowerCase().trim(), categoryId })) as number;
}

export async function deleteDomainRule(id: number): Promise<void> {
  await db.domainRules.delete(id);
}

export async function addArchivedTab(tab: ArchivedTab): Promise<number> {
  return (await db.archives.add(tab)) as number;
}

/**
 * 加入歸檔但「保證 URL 唯一」— 若 archives 表已有相同（標準化）URL 的紀錄，
 * 先刪掉舊的再插入新的。
 * 這樣縮圖網格不會出現同 URL 的多張卡片（最新一次截圖取代舊的）。
 */
export async function upsertArchivedTab(tab: ArchivedTab): Promise<number> {
  const norm = normalizeUrl(tab.url);
  const all = await db.archives.toArray();
  const olderIds: number[] = [];
  for (const a of all) {
    if (a.id != null && normalizeUrl(a.url) === norm) {
      olderIds.push(a.id);
    }
  }
  if (olderIds.length > 0) {
    await db.archives.bulkDelete(olderIds);
  }
  return (await db.archives.add(tab)) as number;
}

/**
 * 對 archives 表做一次性 dedup：同 URL 多筆 → 只留最新的。
 * 回傳被刪除的筆數。
 */
export async function dedupeArchives(): Promise<number> {
  const all = await db.archives.orderBy('archivedAt').reverse().toArray();
  const seen = new Set<string>();
  const idsToDelete: number[] = [];
  for (const a of all) {
    if (a.id == null) continue;
    const norm = normalizeUrl(a.url);
    if (seen.has(norm)) {
      idsToDelete.push(a.id); // 同 URL 較舊那筆
    } else {
      seen.add(norm);
    }
  }
  if (idsToDelete.length > 0) {
    await db.archives.bulkDelete(idsToDelete);
  }
  return idsToDelete.length;
}

export async function listArchives(opts?: {
  categoryId?: number | null;
  domain?: string;
  status?: 'ok' | 'gone';
}): Promise<ArchivedTab[]> {
  let coll = db.archives.orderBy('archivedAt').reverse();
  let results = await coll.toArray();
  if (opts?.categoryId !== undefined) {
    results = results.filter((a) => a.categoryId === opts.categoryId);
  }
  if (opts?.domain) {
    results = results.filter((a) => a.domain === opts.domain);
  }
  if (opts?.status) {
    results = results.filter((a) => a.status === opts.status);
  }
  return results;
}

export async function deleteArchive(id: number): Promise<void> {
  await db.archives.delete(id);
}

export async function updateArchive(id: number, patch: Partial<ArchivedTab>): Promise<void> {
  await db.archives.update(id, patch);
}

export async function addExcluded(rec: ExcludedRecord): Promise<number> {
  return (await db.excluded.add(rec)) as number;
}

export async function listExcluded(): Promise<ExcludedRecord[]> {
  return await db.excluded.orderBy('excludedAt').reverse().toArray();
}

export async function recordScan(rec: ScanHistory): Promise<number> {
  return (await db.scanHistory.add(rec)) as number;
}

export async function listScans(limit = 20): Promise<ScanHistory[]> {
  return await db.scanHistory.orderBy('ranAt').reverse().limit(limit).toArray();
}

export async function countArchives(): Promise<number> {
  return await db.archives.count();
}

export async function countArchivesByCategory(): Promise<Map<number | null, number>> {
  const all = await db.archives.toArray();
  const m = new Map<number | null, number>();
  for (const a of all) {
    m.set(a.categoryId, (m.get(a.categoryId) ?? 0) + 1);
  }
  return m;
}

export async function listDistinctDomains(): Promise<string[]> {
  const all = await db.archives.toArray();
  return Array.from(new Set(all.map((a) => a.domain))).sort();
}
