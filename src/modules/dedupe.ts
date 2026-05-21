import type { TabCandidate } from '@/types/archive';
import { normalizeUrl } from '@/utils/url';

export interface DedupeResult {
  /** 每個 URL 只留一個代表 tab */
  unique: TabCandidate[];
  /** 其他「重複的」tab 的 tabId — 之後直接關掉 */
  duplicateTabIds: number[];
}

/**
 * 對掃描到的 TabCandidate 列表，按「標準化 URL」去重。
 * 同 URL 多個分頁 → 只保留第一個遇到的當「代表」，其他 tab 列為重複（將被關閉）。
 *
 * 例：開了 3 個 youtube.com 同個影片 → unique 留 1 個、duplicateTabIds 收 2 個。
 *
 * 這樣 organize 流程只會截圖/歸檔 N 個 unique URL，不會浪費時間在重複上。
 */
export function dedupeCandidatesByUrl(candidates: TabCandidate[]): DedupeResult {
  const seen = new Map<string, TabCandidate>();
  const dupTabIds: number[] = [];

  for (const c of candidates) {
    if (!c.url) continue;
    const norm = normalizeUrl(c.url);
    if (seen.has(norm)) {
      dupTabIds.push(c.tabId);
    } else {
      seen.set(norm, c);
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicateTabIds: dupTabIds,
  };
}
