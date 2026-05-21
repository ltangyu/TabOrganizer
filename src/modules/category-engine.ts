import type { Category, DomainRule } from '@/types/archive';
import { baseDomain, domainMatchesRule } from '@/utils/domain';
import {
  addDomainRule,
  createCategory,
  db,
  listCategories,
  listDomainRules,
} from './archive-store';

export interface CategoryEngineState {
  categories: Category[];
  rules: DomainRule[];
}

let cache: CategoryEngineState | null = null;

export async function loadCategoryState(force = false): Promise<CategoryEngineState> {
  if (cache && !force) return cache;
  const [categories, rules] = await Promise.all([listCategories(), listDomainRules()]);
  cache = { categories, rules };
  return cache;
}

export function invalidateCategoryCache(): void {
  cache = null;
}

export function suggestCategoryId(domain: string, state: CategoryEngineState): number | null {
  if (!domain) return null;
  const exact = state.rules.find((r) => r.domain === domain);
  if (exact) return exact.categoryId;
  const wildcard = state.rules.find((r) => domainMatchesRule(domain, r.domain));
  if (wildcard) return wildcard.categoryId;
  return null;
}

export function categoryById(id: number | null, state: CategoryEngineState): Category | undefined {
  if (id == null) return undefined;
  return state.categories.find((c) => c.id === id);
}

/**
 * 對指定 domain：若已有匹配規則 → 回傳現有 categoryId；
 * 沒有就建立「以 baseDomain 命名的 category」+ 寫入 baseDomain → category 的規則。
 *
 * 例：domain = "docs.google.com"
 *   1. baseDomain = "google.com"
 *   2. 若無規則 → 建立 category {name:"google.com"} + 規則 {domain:"google.com"}
 *   3. 之後所有 *.google.com 都會自動歸到這個 category（透過 wildcard 匹配？
 *      不會，wildcard 規則要明寫 *.google.com。所以我們改寫 rule.domain = "*.google.com"
 *      讓所有子網域都命中）
 *
 * 寫入後會修改傳入的 state（push 進 cache），同時也 invalidate 全域 cache。
 */
export async function ensureDomainCategory(
  domain: string,
  state: CategoryEngineState,
): Promise<number | null> {
  if (!domain) return null;
  // 1. 已有匹配規則 → 直接用
  const existing = suggestCategoryId(domain, state);
  if (existing != null) return existing;

  // 2. 用 baseDomain 當分類名稱（讓 docs.google.com / mail.google.com 合併到 google.com）
  const base = baseDomain(domain);
  const ruleDomain = `*.${base}`;

  // 3. 找已存在同名 category（避免重複建立 — base 可能在另一輪迴圈剛建好）
  let categoryId = state.categories.find((c) => c.name === base)?.id;

  if (categoryId == null) {
    categoryId = await createCategory(base, '#9c9c9c');
    state.categories.push({
      id: categoryId,
      name: base,
      color: '#9c9c9c',
      createdAt: Date.now(),
    });
  }

  // 4. 寫 base 本身 + wildcard 規則（兩條都加，確保 base 自己也命中）
  const hasBaseRule = state.rules.some((r) => r.domain === base);
  const hasWildRule = state.rules.some((r) => r.domain === ruleDomain);
  if (!hasBaseRule) {
    const id = await addDomainRule(base, categoryId);
    state.rules.push({ id, domain: base, categoryId });
  }
  if (!hasWildRule) {
    const id = await addDomainRule(ruleDomain, categoryId);
    state.rules.push({ id, domain: ruleDomain, categoryId });
  }

  return categoryId;
}

/**
 * 對 archives 表已存在但 categoryId == null 的紀錄做一次性回填：
 * 依當前 state 的規則重新計算 suggestCategoryId 並更新。
 * 回傳被更新的筆數。
 */
export async function backfillUncategorized(state: CategoryEngineState): Promise<number> {
  // Dexie 對 null 的索引查詢不可靠，改成全表掃描後過濾
  const all = await db.archives.toArray();
  const uncategorized = all.filter((a) => a.categoryId == null);
  let updated = 0;
  for (const a of uncategorized) {
    if (a.id == null) continue;
    const id = suggestCategoryId(a.domain, state);
    if (id != null) {
      await db.archives.update(a.id, { categoryId: id });
      updated++;
    }
  }
  return updated;
}
