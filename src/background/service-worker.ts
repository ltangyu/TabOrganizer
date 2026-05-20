import type { RuntimeMessage, OrganizeSummary } from '@/types/messages';
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

chrome.runtime.onInstalled.addListener(async (details) => {
  const cats = await listCategories();
  if (cats.length === 0) {
    // 內建一個「收件匣」分類，name 用繁中作為 fallback，但實際顯示走 builtinKey i18n
    await createCategory('收件匣', '#9c9c9c', 'category.builtin.inbox');
  }
  await clearStaleOrganizeFlag();
  const settings = await getSettings();
  await ensureAlarmConfigured(settings.revalidateIntervalMinutes);

  // 首次安裝：自動開啟管理頁（提升首次使用體驗）
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/manager.html') });
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await clearStaleOrganizeFlag();
  const settings = await getSettings();
  await ensureAlarmConfigured(settings.revalidateIntervalMinutes);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_REVALIDATE) return;
  const r = await runRevalidation();
  broadcast({ type: 'revalidate/done', checked: r.checked, gone: r.gone });
  broadcast({ type: 'archive/changed' });
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
  ensureManagerOpen(true);

  try {
    broadcast({ type: 'organize/progress', current: 0, total: 0, stage: 'scanning' });
    const scan = await scanAllTabs();
    if (scan.total === 0) {
      const summary: OrganizeSummary = {
        scanned: 0,
        checked: 0,
        snapshotted: 0,
        excluded: 0,
        closed: 0,
        durationMs: Date.now() - t0,
      };
      broadcast({ type: 'organize/done', summary });
      return;
    }

    broadcast({
      type: 'organize/progress',
      current: 0,
      total: scan.total,
      stage: 'checking',
    });
    const checkResults = await checkBatch(scan.candidates.map((c) => c.url), {
      concurrency: 8,
      timeoutMs: 5000,
    });

    const alive = [] as typeof scan.candidates;
    const dead = [] as typeof scan.candidates;
    for (const c of scan.candidates) {
      const r = checkResults.get(c.url);
      if (r && r.ok) alive.push(c);
      else dead.push(c);
    }

    for (const d of dead) {
      const r = checkResults.get(d.url);
      await addExcluded({
        url: d.url,
        title: d.title,
        domain: d.domain,
        reason:
          r?.status === 'timeout'
            ? 'timeout'
            : r?.status === 'network-error'
              ? 'network-error'
              : 'http-error',
        ...(r?.status !== undefined ? { statusCode: r.status } : {}),
        excludedAt: Date.now(),
      });
    }

    const snapResult = await snapshotTabs(alive, (info) => {
      broadcast({
        type: 'organize/progress',
        current: info.current,
        total: info.total,
        stage: info.stage,
        ...(info.currentTitle !== undefined ? { currentTitle: info.currentTitle } : {}),
      });
    });

    broadcast({
      type: 'organize/progress',
      current: scan.total,
      total: scan.total,
      stage: 'closing',
    });
    const closableIds = [
      ...snapResult.archivedTabIds,
      ...dead.map((c) => c.tabId),
    ];
    const closed = await closeTabs(closableIds);

    const summary: OrganizeSummary = {
      scanned: scan.total,
      checked: scan.total,
      snapshotted: snapResult.archivedCount,
      excluded: dead.length,
      closed,
      durationMs: Date.now() - t0,
    };
    broadcast({ type: 'archive/changed' });
    broadcast({ type: 'organize/done', summary });
  } catch (e) {
    broadcast({ type: 'organize/error', error: (e as Error).message });
  } finally {
    await setSettings({ organizeInProgress: false, organizeStartedAt: 0 });
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
