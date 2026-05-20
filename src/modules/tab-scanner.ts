import type { TabCandidate } from '@/types/archive';
import { extractDomain, isInternalUrl } from '@/utils/domain';
import { loadCategoryState, suggestCategoryId } from './category-engine';

export interface ScanResult {
  candidates: TabCandidate[];
  groupedByDomain: Record<string, TabCandidate[]>;
  total: number;
  suggested: number;
  unassigned: number;
}

export async function scanAllTabs(): Promise<ScanResult> {
  const state = await loadCategoryState(true);
  const tabs = await chrome.tabs.query({});
  const candidates: TabCandidate[] = [];
  const grouped: Record<string, TabCandidate[]> = {};

  for (const t of tabs) {
    if (!t.id || !t.url || isInternalUrl(t.url)) continue;
    const domain = extractDomain(t.url);
    const c: TabCandidate = {
      tabId: t.id,
      windowId: t.windowId,
      url: t.url,
      title: t.title || t.url,
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
