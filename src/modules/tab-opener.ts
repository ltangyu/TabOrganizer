import { normalizeUrl } from '@/utils/url';

export interface OpenBatchResult {
  opened: number;
  /** 因為已開著或輸入內重複而沒開的數量 */
  skipped: number;
}

async function getCurrentlyOpenUrlSet(): Promise<Set<string>> {
  const tabs = await chrome.tabs.query({});
  const set = new Set<string>();
  for (const t of tabs) {
    if (t.url) set.add(normalizeUrl(t.url));
  }
  return set;
}

/**
 * 批次開啟 URL，**自動跳過**：
 * 1. 輸入清單內重複的 URL（同一批 dedup）
 * 2. 已在 chrome.tabs 開著的 URL（跨批 dedup）
 *
 * 全部以背景 tab 開啟（active: false），避免搶走管理頁焦點。
 * 給「重新開啟分類」「比對遺失全部復原」用。
 */
export async function openTabsSkipDuplicates(urls: string[]): Promise<OpenBatchResult> {
  const openSet = await getCurrentlyOpenUrlSet();
  const seen = new Set<string>();
  const toOpen: string[] = [];

  for (const url of urls) {
    if (!url) continue;
    const norm = normalizeUrl(url);
    if (seen.has(norm) || openSet.has(norm)) continue;
    seen.add(norm);
    toOpen.push(url);
  }

  let opened = 0;
  for (const url of toOpen) {
    try {
      await chrome.tabs.create({ url, active: false });
      opened++;
    } catch (e) {
      console.warn('[TabOrganizer] open tab failed', url, e);
    }
  }

  return { opened, skipped: urls.length - opened };
}

/**
 * 開啟單一 URL：
 * - 若該 URL 已在某個 tab 開著 → 切到那個 tab + focus 它的視窗（不重開）
 * - 否則 → 開新 tab 並 active 它
 *
 * 給管理頁卡片「開啟」按鈕用。
 */
export async function openOrFocusTab(url: string): Promise<void> {
  if (!url) return;
  const norm = normalizeUrl(url);
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => t.url && normalizeUrl(t.url) === norm);
  if (existing?.id != null) {
    try {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId != null) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    } catch (e) {
      console.warn('[TabOrganizer] focus existing tab failed', url, e);
    }
  } else {
    await chrome.tabs.create({ url, active: true });
  }
}
