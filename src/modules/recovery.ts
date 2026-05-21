/**
 * 「比對還原遺失分頁」模組。
 *
 * 用途：找出「曾經 organize 想處理但既沒在 archive、也沒在 excluded、也沒在現在
 * 開著的 tab」的 URL，讓使用者一鍵重開回來。
 *
 * 資料來源（優先序）：
 * 1. lastOrganizeScan（chrome.storage）— 整理開始時 snapshot 的完整候選清單
 *    精準度 100%，是「真正被 organize 操作但沒成功歸檔」的 URL
 * 2. chrome.sessions.getRecentlyClosed — fallback，最多 25 筆
 *    只用在「沒有 snapshot」（譬如本次升級前的舊損失）的情況
 *
 * 刻意不用 chrome.history — 噪音太多（任何近期造訪都會列入），
 * 不是「真正被關掉但沒歸檔」的精準訊號。
 */

import { db } from './archive-store';
import { extractDomain, isInternalUrl } from '@/utils/domain';
import { normalizeUrl } from '@/utils/url';
import { openTabsSkipDuplicates, type OpenBatchResult } from './tab-opener';

export const LAST_ORGANIZE_SCAN_KEY = 'tabOrganizer.lastOrganizeScan';

export interface MissingTab {
  url: string;
  title: string;
  domain: string;
  favIconUrl?: string;
  /** ms epoch；越大越新 */
  lastVisitTime?: number;
  source: 'organize-snapshot' | 'session';
}

export interface SavedScanCandidate {
  url: string;
  title: string;
  domain: string;
  favIconUrl?: string;
  scannedAt: number;
}

/**
 * 由 organize 流程在「scan 完、開始 check 前」呼叫。
 * 把當下所有候選 URL 持久化，之後即使 SW 死光、queue 也清空，
 * 只要 chrome.storage 還在，這份清單就能用來比對哪些 URL「應該被處理但沒進 archive」。
 */
export async function saveOrganizeScanSnapshot(
  candidates: Array<{ url: string; title: string; domain: string; favIconUrl?: string }>,
): Promise<void> {
  const now = Date.now();
  const saved: SavedScanCandidate[] = candidates.map((c) => ({
    url: c.url,
    title: c.title,
    domain: c.domain,
    ...(c.favIconUrl ? { favIconUrl: c.favIconUrl } : {}),
    scannedAt: now,
  }));
  await chrome.storage.local.set({ [LAST_ORGANIZE_SCAN_KEY]: saved });
}

async function getOrganizeScanSnapshot(): Promise<SavedScanCandidate[]> {
  const r = (await chrome.storage.local.get(LAST_ORGANIZE_SCAN_KEY))[LAST_ORGANIZE_SCAN_KEY];
  return Array.isArray(r) ? (r as SavedScanCandidate[]) : [];
}

export async function findMissingTabs(): Promise<MissingTab[]> {
  // 1. 取已知 URL 集合（archive、excluded、目前開著）
  const [archives, excluded, openTabs] = await Promise.all([
    db.archives.toArray(),
    db.excluded.toArray(),
    chrome.tabs.query({}),
  ]);

  const known = new Set<string>();
  archives.forEach((a) => known.add(normalizeUrl(a.url)));
  excluded.forEach((e) => known.add(normalizeUrl(e.url)));
  openTabs.forEach((t) => {
    if (t.url) known.add(normalizeUrl(t.url));
  });

  const missing = new Map<string, MissingTab>();

  // 2. 主要來源：上次 organize 的 snapshot（精準）
  const snapshot = await getOrganizeScanSnapshot();
  for (const s of snapshot) {
    if (!s.url || isInternalUrl(s.url)) continue;
    const norm = normalizeUrl(s.url);
    if (known.has(norm)) continue;
    missing.set(norm, {
      url: s.url,
      title: s.title,
      domain: s.domain,
      ...(s.favIconUrl ? { favIconUrl: s.favIconUrl } : {}),
      lastVisitTime: s.scannedAt,
      source: 'organize-snapshot',
    });
  }

  // 3. Fallback：chrome.sessions（給「沒 snapshot」的舊損失用）
  if (chrome.sessions?.getRecentlyClosed) {
    try {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
      for (const s of sessions) {
        const tabsInSession: chrome.tabs.Tab[] = [];
        if (s.tab) tabsInSession.push(s.tab);
        if (s.window?.tabs) tabsInSession.push(...s.window.tabs);

        for (const t of tabsInSession) {
          if (!t.url || isInternalUrl(t.url)) continue;
          const norm = normalizeUrl(t.url);
          if (known.has(norm) || missing.has(norm)) continue;
          missing.set(norm, {
            url: t.url,
            title: t.title || t.url,
            domain: extractDomain(t.url),
            ...(t.favIconUrl ? { favIconUrl: t.favIconUrl } : {}),
            ...(s.lastModified ? { lastVisitTime: s.lastModified * 1000 } : {}),
            source: 'session',
          });
        }
      }
    } catch (e) {
      console.warn('[TabOrganizer] sessions.getRecentlyClosed failed', e);
    }
  }

  // 4. 排序：lastVisitTime 由新到舊
  return Array.from(missing.values()).sort(
    (a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0),
  );
}

/**
 * 把選中的 URL 一次性開回來（背景 tab + 自動跳過已開的）。
 * 走共用 openTabsSkipDuplicates，所以重複的 URL（同清單內或已開的）都不會建分頁。
 */
export async function reopenMissingTabs(urls: string[]): Promise<OpenBatchResult> {
  return await openTabsSkipDuplicates(urls);
}
