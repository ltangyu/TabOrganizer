import type { RuntimeMessage, OrganizeSummary } from '@/types/messages';
import type { TabCandidate } from '@/types/archive';
import { scanAllTabs } from '@/modules/tab-scanner';
import { checkBatch } from '@/modules/link-checker';
import { snapshotTabs } from '@/modules/tab-snapshotter';
import { closeTabs } from '@/modules/tab-closer';
import { addExcluded, listCategories, createCategory } from '@/modules/archive-store';
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
  const q = await getQueue();
  if (!q) {
    // 沒有 queue → 清 flag 並退出
    await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
    return;
  }

  if (q.alive.length === 0) {
    await finishOrganize(q);
    return;
  }

  // 處理下一個 chunk
  const chunk = q.alive.splice(0, ORGANIZE_CHUNK_SIZE);
  const baseCurrent = q.archived + q.failed + q.excluded;

  try {
    const result = await snapshotTabs(chunk, (info) => {
      broadcast({
        type: 'organize/progress',
        current: baseCurrent + info.current,
        total: q.scanned,
        stage: 'snapshotting',
        ...(info.currentTitle !== undefined ? { currentTitle: info.currentTitle } : {}),
      });
    });
    q.archived += result.archivedCount;
    q.failed += result.failedCount;
    q.closed += result.archivedCount; // close-as-you-go
  } catch (e) {
    console.warn('[TabOrganizer] chunk failed', e);
    q.failed += chunk.length;
  }

  await setQueue(q);
  broadcast({ type: 'archive/changed' });

  if (q.alive.length > 0) {
    // 排下一輪 — 注意：Chrome 對 alarms periodInMinutes 強制最低 30 秒，
    // 但 delayInMinutes 可較短。0.0017 minutes = ~100ms。
    chrome.alarms.create(ORGANIZE_NEXT_CHUNK_ALARM, { delayInMinutes: 0.0017 });
  } else {
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
    const scan = await scanAllTabs();
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

async function reopenCategory(categoryId: number): Promise<void> {
  const { db } = await import('@/modules/archive-store');
  const items = await db.archives.where('categoryId').equals(categoryId).toArray();
  for (const a of items) {
    chrome.tabs.create({ url: a.url, active: false });
  }
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
      await reopenCategory(msg.categoryId);
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false });
  })();
  return true;
});
