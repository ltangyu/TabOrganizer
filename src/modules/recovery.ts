/**
 * 「比對還原遺失分頁」模組。
 *
 * 用途：找出「曾經開過但既沒在 archive、也沒在 excluded、也沒在現在開著的 tab」
 * 的 URL，讓使用者一鍵重開回來。
 *
 * 兩個資料來源：
 * 1. chrome.sessions.getRecentlyClosed（最多 25 筆，但精準 — 一定是被關掉的 tab）
 * 2. chrome.history.search（廣，可往前找 N 小時；噪音較多但覆蓋率高）
 *
 * 兩者結果 union + dedup，按 lastVisitTime 排序。
 */

import { db } from './archive-store';
import { extractDomain, isInternalUrl } from '@/utils/domain';

export interface MissingTab {
  url: string;
  title: string;
  domain: string;
  favIconUrl?: string;
  /** ms epoch；越大越新 */
  lastVisitTime?: number;
  source: 'session' | 'history';
}

export interface RecoveryScanOptions {
  /** 從多少小時前的 history 抓資料；預設 4 */
  historyHoursAgo?: number;
  /** 從 sessions 最多抓幾筆；預設 25（chrome 上限） */
  sessionMax?: number;
  /** history 最多抓幾筆；預設 5000 */
  historyMax?: number;
}

/**
 * URL 標準化（給 dedup 用）：去掉 fragment、結尾斜線。
 * 不去 querystring（同站不同 query 可能是不同頁面）。
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname.replace(/\/+$/, '');
    if (!path) path = '/';
    return u.protocol + '//' + u.host + path + u.search;
  } catch {
    return url;
  }
}

export async function findMissingTabs(
  opts: RecoveryScanOptions = {},
): Promise<MissingTab[]> {
  const hoursAgo = opts.historyHoursAgo ?? 4;
  const sessionMax = opts.sessionMax ?? 25;
  const historyMax = opts.historyMax ?? 5000;

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

  // 2. 從 chrome.sessions 撈最近關閉的 tab
  if (chrome.sessions?.getRecentlyClosed) {
    try {
      const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: sessionMax });
      for (const s of sessions) {
        // session 可能是單一 tab 或整個 window 含多 tab
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

  // 3. 從 chrome.history 撈最近 N 小時的瀏覽紀錄
  if (chrome.history?.search) {
    try {
      const startTime = Date.now() - hoursAgo * 3600 * 1000;
      const history = await chrome.history.search({
        text: '',
        startTime,
        maxResults: historyMax,
      });
      for (const h of history) {
        if (!h.url || isInternalUrl(h.url)) continue;
        const norm = normalizeUrl(h.url);
        if (known.has(norm) || missing.has(norm)) continue;
        missing.set(norm, {
          url: h.url,
          title: h.title || h.url,
          domain: extractDomain(h.url),
          ...(h.lastVisitTime ? { lastVisitTime: h.lastVisitTime } : {}),
          source: 'history',
        });
      }
    } catch (e) {
      console.warn('[TabOrganizer] history.search failed', e);
    }
  }

  // 4. 排序：lastVisitTime 由新到舊
  return Array.from(missing.values()).sort(
    (a, b) => (b.lastVisitTime ?? 0) - (a.lastVisitTime ?? 0),
  );
}

/**
 * 把選中的 URL 一次性開回來（背景 tab，避免搶焦點）。
 * 回傳實際開啟的數量。
 */
export async function reopenMissingTabs(urls: string[]): Promise<number> {
  let opened = 0;
  for (const url of urls) {
    try {
      await chrome.tabs.create({ url, active: false });
      opened++;
    } catch (e) {
      console.warn('[TabOrganizer] reopen failed', url, e);
    }
  }
  return opened;
}
