import type { Category, DomainRule } from '@/types/archive';
import { domainMatchesRule } from '@/utils/domain';
import { listCategories, listDomainRules } from './archive-store';

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
