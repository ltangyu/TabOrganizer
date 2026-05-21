import type { RuntimeMessage, OrganizeSummary } from '@/types/messages';
import type { TabCandidate } from '@/types/archive';
import { scanAllTabs } from '@/modules/tab-scanner';
import { checkBatch } from '@/modules/link-checker';
import { snapshotTabs } from '@/modules/tab-snapshotter';
import { closeTabs } from '@/modules/tab-closer';
import { addExcluded, listCategories, createCategory, db } from '@/modules/archive-store';
import { backfillUncategorized, loadCategoryState } from '@/modules/category-engine';
import { findMissingTabs, reopenMissingTabs, saveOrganizeScanSnapshot } from '@/modules/recovery';
import { openTabsSkipDuplicates } from '@/modules/tab-opener';
import {
  ALARM_REVALIDATE,
  DEFAULT_INTERVAL_MIN,
  ensureAlarmConfigured,
  runRevalidation,
} from '@/modules/periodic-revalidator';

interface SettingsShape {
  revalidateIntervalMinutes: number;
  organizeInProgress: boolean;
  organizeStartedAt?: number;
}

const SETTINGS_KEY = 'tabOrganizer.settings';
/** 整理流程最長允許時間（ms）。超過視為 worker 意外卸載，自動清除 in-progress flag。 */
const ORGANIZE_STALE_MS = 5 * 60 * 1000; // 5 分鐘

async function getSettings(): Promise<SettingsShape> {
  const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] as
    | Partial<SettingsShape>
    | undefined;
  return {
    revalidateIntervalMinutes: stored?.revalidateIntervalMinutes ?? DEFAULT_INTERVAL_MIN,
    organizeInProgress: stored?.organizeInProgress ?? false,
    ...(stored?.organizeStartedAt !== undefined
      ? { organizeStartedAt: stored.organizeStartedAt }
      : {}),
  };
}

async function setSettings(patch: Partial<SettingsShape>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...patch } });
}

/** 啟動時清除卡住的整理 flag（防止 service worker 被卸載後 flag 卡 true）。 */
async function clearStaleOrganizeFlag(): Promise<void> {
  const s = await getSettings();
  if (!s.organizeInProgress) return;
  const startedAt = s.organizeStartedAt ?? 0;
  if (Date.now() - startedAt > ORGANIZE_STALE_MS) {
    await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
    console.warn('[TabOrganizer] cleared stale organize flag');
  }
}

/**
 * 強制重設 flag — 用在「明確無 organize 在跑」的時機點：
 * - onStartup（Chrome 重啟）
 * - onInstalled（extension 安裝 / reload）
 * - organize/reset 訊息（UI 手動觸發）
 * 這時若 flag 仍為 true，必定是上次 worker 中途死掉沒清。
 * setSettings 寫入後 chrome.storage.onChanged 會自動 fire，UI 反應式更新。
 */
async function forceResetOrganizeFlag(): Promise<void> {
  await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
}

chrome.runtime.onInstalled.addListener(async () => {
  const cats = await listCategories();
  if (cats.length === 0) {
    // 內建一個「收件匣」分類，name 用繁中作為 fallback，但實際顯示走 builtinKey i18n
    await createCategory('收件匣', '#9c9c9c', 'category.builtin.inbox');
  }
  // extension 剛 install/update/reload，必定沒在 organize → 無條件清 flag
  await forceResetOrganizeFlag();
  const settings = await getSettings();
  await ensureAlarmConfigured(settings.revalidateIntervalMinutes);
});

chrome.runtime.onStartup.addListener(async () => {
  // Chrome 剛啟動，必定沒在 organize → 無條件清 flag
  await forceResetOrganizeFlag();
  const settings = await getSettings();
  await ensureAlarmConfigured(settings.revalidateIntervalMinutes);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ORGANIZE_NEXT_CHUNK_ALARM) {
    await processNextChunk();
    return;
  }
  if (alarm.name === ALARM_REVALIDATE) {
    const r = await runRevalidation();
    broadcast({ type: 'revalidate/done', checked: r.checked, gone: r.gone });
    broadcast({ type: 'archive/changed' });
  }
});

function broadcast(msg: RuntimeMessage): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* no receiver — fine */
  });
}

function ensureManagerOpen(focusProgress = false): void {
  const managerUrl = chrome.runtime.getURL('src/manager/manager.html');
  chrome.tabs.query({ url: managerUrl + '*' }, (tabs) => {
    if (tabs.length > 0 && tabs[0]?.id != null) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: managerUrl + (focusProgress ? '#progress' : '') });
    }
  });
}

/**
 * Chunked organize architecture（真正無限制處理 N 個 tab）：
 * 1. organizeAll() 跑 scan + check 階段（短時間）
 * 2. 結束後把 alive 候選名單存進 chrome.storage（OrganizeQueue）
 * 3. 觸發 chrome.alarms 'organize-next-chunk'
 * 4. alarm handler 從 storage 讀 queue，處理 CHUNK_SIZE 個 tab，回存 queue
 * 5. 若還有 → 再觸發 alarm（SW 可以中間死掉，下次 alarm 喚醒繼續）
 * 6. queue 空 → 廣播 done、清 flag
 */
const ORGANIZE_QUEUE_KEY = 'tabOrganizer.organizeQueue';
const ORGANIZE_NEXT_CHUNK_ALARM = 'tab-organizer-next-chunk';
const ORGANIZE_CHUNK_SIZE = 10;

interface OrganizeQueue {
  alive: TabCandidate[];
  archived: number;
  failed: number;
  excluded: number;
  closed: number;
  scanned: number;
  t0: number;
}

async function getQueue(): Promise<OrganizeQueue | null> {
  const r = (await chrome.storage.local.get(ORGANIZE_QUEUE_KEY))[ORGANIZE_QUEUE_KEY];
  return (r as OrganizeQueue | undefined) ?? null;
}

async function setQueue(q: OrganizeQueue | null): Promise<void> {
  if (q === null) {
    await chrome.storage.local.remove(ORGANIZE_QUEUE_KEY);
  } else {
    await chrome.storage.local.set({ [ORGANIZE_QUEUE_KEY]: q });
  }
}

async function finishOrganize(q: OrganizeQueue): Promise<void> {
  const summary: OrganizeSummary = {
    scanned: q.scanned,
    checked: q.scanned,
    snapshotted: q.archived,
    excluded: q.excluded,
    closed: q.closed,
    durationMs: Date.now() - q.t0,
  };
  broadcast({ type: 'archive/changed' });
  broadcast({ type: 'organize/done', summary });
  await setQueue(null);
  await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
}

async function processNextChunk(): Promise<void> {
  // 安全網 alarm：30 秒後 fallback 觸發。
  // 若本輪正常結束，會被結尾的 100ms 短 delay alarm 覆蓋（同 name → replace）。
  // 若 SW 在 chunk 處理中途死掉，30 秒後此 alarm 仍會喚醒 SW 繼續下一輪。
  chrome.alarms.create(ORGANIZE_NEXT_CHUNK_ALARM, { delayInMinutes: 0.5 });

  const q = await getQueue();
  if (!q) {
    chrome.alarms.clear(ORGANIZE_NEXT_CHUNK_ALARM);
    await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
    return;
  }

  if (q.alive.length === 0) {
    chrome.alarms.clear(ORGANIZE_NEXT_CHUNK_ALARM);
    await finishOrganize(q);
    return;
  }

  // 重要：peek-then-shift 模式
  // 不再一次 splice 整個 chunk 出來（這樣 SW 中途死掉會損失整個 chunk = 10 tab）。
  // 改為每處理完「一個」tab 才 shift 並存回 queue。
  // SW 死掉最多只重複處理 / 損失「正在跑 snapshotTabs 那一個」tab。
  // 對 415 tab 的整理，把損失上限從 ~300 (30 deaths × 10) 降到 ~30 (30 deaths × 1)。
  for (let i = 0; i < ORGANIZE_CHUNK_SIZE; i++) {
    if (q.alive.length === 0) break;

    const t = q.alive[0]!; // peek，先別 shift
    const baseCurrent = q.archived + q.failed + q.excluded;

    broadcast({
      type: 'organize/progress',
      current: baseCurrent + 1,
      total: q.scanned,
      stage: 'snapshotting',
      currentTitle: t.title,
    });

    let archivedDelta = 0;
    let failedDelta = 0;
    try {
      const result = await snapshotTabs([t]);
      archivedDelta = result.archivedCount;
      failedDelta = result.failedCount;
    } catch (e) {
      console.warn('[TabOrganizer] single-tab failed', t.url, e);
      failedDelta = 1;
    }

    // 處理完才從 queue 移除 + 寫回（不在處理前 shift，避免 SW 死掉 lose tab）
    q.alive.shift();
    q.archived += archivedDelta;
    q.failed += failedDelta;
    q.closed += archivedDelta + failedDelta;
    await setQueue(q);
  }

  broadcast({ type: 'archive/changed' });

  if (q.alive.length > 0) {
    // 用 100ms 短 delay 覆蓋安全網 alarm，讓下一輪盡快開始
    chrome.alarms.create(ORGANIZE_NEXT_CHUNK_ALARM, { delayInMinutes: 0.0017 });
  } else {
    chrome.alarms.clear(ORGANIZE_NEXT_CHUNK_ALARM);
    await finishOrganize(q);
  }
}

async function organizeAll(): Promise<void> {
  // 先嘗試清除卡住的舊 flag（防 worker 卸載卡住）
  await clearStaleOrganizeFlag();
  const settings = await getSettings();
  if (settings.organizeInProgress) {
    broadcast({
      type: 'organize/error',
      error: 'organize-in-progress',
      i18nKey: 'error.organizeInProgress',
    });
    return;
  }
  const t0 = Date.now();
  await setSettings({ organizeInProgress: true, organizeStartedAt: t0 });
  await setQueue(null); // 清舊 queue
  ensureManagerOpen(true);

  try {
    broadcast({ type: 'organize/progress', current: 0, total: 0, stage: 'scanning' });
    // autoCreateCategories: true → 對每個沒匹配規則的 domain 自動建立 category + rule
    // 這樣 412 個 tab 會依 base domain 自動歸類，而非全部塞進「未分類」
    const scan = await scanAllTabs({ autoCreateCategories: true });

    // 立刻 snapshot 候選 URL 清單到 chrome.storage —
    // 即使後面 SW 死光、queue 也被清，這份 snapshot 仍會留著，
    // 「比對遺失」功能可用它計算「掃進來但沒成功歸檔」的精準清單。
    try {
      await saveOrganizeScanSnapshot(
        scan.candidates.map((c) => ({
          url: c.url,
          title: c.title,
          domain: c.domain,
          ...(c.favIconUrl ? { favIconUrl: c.favIconUrl } : {}),
        })),
      );
    } catch (e) {
      console.warn('[TabOrganizer] saveOrganizeScanSnapshot failed', e);
    }
    // 回填：對舊有 categoryId == null 的 archive，用新建立的規則重新歸類
    // （讓使用者之前 organize 但沒分類的紀錄也自動歸到對應分類）
    try {
      const state = await loadCategoryState(true);
      const fixed = await backfillUncategorized(state);
      if (fixed > 0) {
        console.log('[TabOrganizer] backfilled', fixed, 'uncategorized archives');
        broadcast({ type: 'archive/changed' });
      }
    } catch (e) {
      console.warn('[TabOrganizer] backfill failed', e);
    }
    if (scan.total === 0) {
      const summary: OrganizeSummary = {
        scanned: 0, checked: 0, snapshotted: 0, excluded: 0, closed: 0,
        durationMs: Date.now() - t0,
      };
      broadcast({ type: 'organize/done', summary });
      await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
      return;
    }

    broadcast({ type: 'organize/progress', current: 0, total: scan.total, stage: 'checking' });
    const checkResults = await checkBatch(
      scan.candidates.map((c) => c.url),
      { concurrency: 16, timeoutMs: 4000 },
      (done, total, lastUrl) => {
        broadcast({
          type: 'organize/progress',
          current: done,
          total,
          stage: 'checking',
          ...(lastUrl ? { currentTitle: lastUrl } : {}),
        });
      },
    );

    const alive: TabCandidate[] = [];
    const dead: TabCandidate[] = [];
    for (const c of scan.candidates) {
      const r = checkResults.get(c.url);
      if (r && r.ok) alive.push(c);
      else dead.push(c);
    }

    // 寫剔除清單 + 立即關閉 dead tabs
    for (const d of dead) {
      const r = checkResults.get(d.url);
      await addExcluded({
        url: d.url, title: d.title, domain: d.domain,
        reason: r?.status === 'timeout' ? 'timeout'
          : r?.status === 'network-error' ? 'network-error'
          : 'http-error',
        ...(r?.status !== undefined ? { statusCode: r.status } : {}),
        excludedAt: Date.now(),
      });
    }
    const closedDead = await closeTabs(dead.map((c) => c.tabId));

    // 建立 queue 給 chunk 處理
    const queue: OrganizeQueue = {
      alive,
      archived: 0,
      failed: 0,
      excluded: dead.length,
      closed: closedDead,
      scanned: scan.total,
      t0,
    };
    await setQueue(queue);

    if (alive.length === 0) {
      await finishOrganize(queue);
      return;
    }

    // 啟動 chunk 處理（alarm handler 接手；本 invocation 結束）
    broadcast({
      type: 'organize/progress',
      current: dead.length,
      total: scan.total,
      stage: 'snapshotting',
    });
    chrome.alarms.create(ORGANIZE_NEXT_CHUNK_ALARM, { delayInMinutes: 0.0017 });
  } catch (e) {
    broadcast({ type: 'organize/error', error: (e as Error).message });
    await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
    await setQueue(null);
  }
}

async function reopenCategory(categoryId: number): Promise<{ opened: number; skipped: number }> {
  // 之前用 await import() 動態載入；換成 top-level 靜態 import 的 db 更穩。
  const items = await db.archives.where('categoryId').equals(categoryId).toArray();
  console.log(
    '[TabOrganizer] reopenCategory categoryId=',
    categoryId,
    'found archives=',
    items.length,
  );
  // 走 openTabsSkipDuplicates 自動跳過已開的 URL，避免重複分頁
  const result = await openTabsSkipDuplicates(items.map((a) => a.url));
  console.log('[TabOrganizer] reopenCategory result', result);
  return result;
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'organize/start') {
      organizeAll();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'organize/reset') {
      await forceResetOrganizeFlag();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'scan/request') {
      const scan = await scanAllTabs();
      sendResponse({
        type: 'scan/response',
        candidates: scan.candidates,
        total: scan.total,
        suggested: scan.suggested,
        unassigned: scan.unassigned,
      });
      return;
    }
    if (msg.type === 'manager/open') {
      ensureManagerOpen(false);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'revalidate/run') {
      const r = await runRevalidation();
      broadcast({ type: 'revalidate/done', checked: r.checked, gone: r.gone });
      broadcast({ type: 'archive/changed' });
      sendResponse({ ok: true, ...r });
      return;
    }
    if (msg.type === 'reopen/category') {
      const r = await reopenCategory(msg.categoryId);
      sendResponse({ ok: true, opened: r.opened, skipped: r.skipped });
      return;
    }
    if (msg.type === 'recover/scan') {
      const missing = await findMissingTabs();
      sendResponse({ type: 'recover/scan-response', missing });
      return;
    }
    if (msg.type === 'recover/reopen') {
      const { opened, skipped } = await reopenMissingTabs(msg.urls);
      sendResponse({ type: 'recover/reopen-response', opened, skipped });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});
