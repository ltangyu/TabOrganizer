import Dexie, { type Table } from 'dexie';
import type {
  ArchivedTab,
  Category,
  DomainRule,
  ExcludedRecord,
  ScanHistory,
} from '@/types/archive';

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
