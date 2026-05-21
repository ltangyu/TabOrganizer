import type { TabCandidate } from '@/types/archive';
import { extractDomain, isInternalUrl } from '@/utils/domain';
import {
  ensureDomainCategory,
  invalidateCategoryCache,
  loadCategoryState,
  suggestCategoryId,
} from './category-engine';

export interface ScanResult {
  candidates: TabCandidate[];
  groupedByDomain: Record<string, TabCandidate[]>;
  total: number;
  suggested: number;
  unassigned: number;
}

export interface ScanOptions {
  /**
   * 若 true：對沒有匹配規則的 domain 自動建立 category + 規則
   * （並把 DB 寫入永久化，下次 scan 直接命中）。
   * organize 流程開 true，popup 預覽用 false（避免無意中建立分類）。
   */
  autoCreateCategories?: boolean;
}

export async function scanAllTabs(opts: ScanOptions = {}): Promise<ScanResult> {
  let state = await loadCategoryState(true);
  const tabs = await chrome.tabs.query({});

  // 收集所有合法 candidate 的 domain
  const validTabs = tabs.filter(
    (t) => t.id != null && t.url != null && !isInternalUrl(t.url),
  );

  if (opts.autoCreateCategories) {
    // 第一輪：對每個沒匹配規則的 domain，建立 category + rule
    const unmatched = new Set<string>();
    for (const t of validTabs) {
      const domain = extractDomain(t.url!);
      if (!domain) continue;
      if (suggestCategoryId(domain, state) == null) {
        unmatched.add(domain);
      }
    }
    for (const d of unmatched) {
      await ensureDomainCategory(d, state);
    }
    if (unmatched.size > 0) {
      invalidateCategoryCache();
      state = await loadCategoryState(true);
    }
  }

  // 第二輪：build candidates（auto-create 已跑完，每個 domain 都應該有規則）
  const candidates: TabCandidate[] = [];
  const grouped: Record<string, TabCandidate[]> = {};

  for (const t of validTabs) {
    const domain = extractDomain(t.url!);
    const c: TabCandidate = {
      tabId: t.id!,
      windowId: t.windowId,
      url: t.url!,
      title: t.title || t.url!,
      domain,
      ...(t.favIconUrl ? { favIconUrl: t.favIconUrl } : {}),
      suggestedCategoryId: suggestCategoryId(domain, state),
    };
    candidates.push(c);
    (grouped[domain] ??= []).push(c);
  }

  const suggested = candidates.filter((c) => c.suggestedCategoryId != null).length;
  return {
    candidates,
    groupedByDomain: grouped,
    total: candidates.length,
    suggested,
    unassigned: candidates.length - suggested,
  };
}
