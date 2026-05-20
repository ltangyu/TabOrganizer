import './chrome-mock';
import { registerHandler } from './chrome-mock';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ManagerApp from '@/manager/ManagerApp.vue';
import '@/styles/global.css';
import { seedDatabase } from './seed-data';

// 模擬 organize/start：依序廣播 scanning → checking → snapshotting → closing → done
registerHandler('organize/start', () => {
  const chrome = (globalThis as any).chrome;
  const dispatch = chrome.runtime.onMessage.dispatchInternal;
  if (!dispatch) return { ok: false };

  const tabs = [
    { domain: 'github.com', title: 'vuejs/core' },
    { domain: 'github.com', title: 'anthropics/sdk' },
    { domain: 'github.com', title: 'TypeScript PR' },
    { domain: 'stackoverflow.com', title: 'SO question' },
    { domain: 'stackoverflow.com', title: 'SO question 2' },
    { domain: 'developer.mozilla.org', title: 'IndexedDB MDN' },
    { domain: 'developer.mozilla.org', title: 'Fetch MDN' },
    { domain: 'vitejs.dev', title: 'Vite build' },
    { domain: 'youtube.com', title: 'YT' },
    { domain: 'reddit.com', title: 'r/programming' },
    { domain: 'news.ycombinator.com', title: 'HN' },
    { domain: 'twitter.com', title: 'X' },
    { domain: 'figma.com', title: 'Figma' },
    { domain: 'notion.so', title: 'Notion' },
  ];
  const total = tabs.length;
  let cur = 0;
  const t0 = Date.now();

  // 標記整理中
  chrome.storage.local.set({
    'tabOrganizer.settings': { revalidateIntervalMinutes: 10080, organizeInProgress: true },
  });
  chrome.storage.onChanged?.dispatchInternal?.(
    { 'tabOrganizer.settings': { newValue: { organizeInProgress: true } } },
    'local',
  );

  // 階段 1：scanning
  setTimeout(() => dispatch({ type: 'organize/progress', current: 0, total, stage: 'scanning' }), 100);

  // 階段 2：checking
  setTimeout(
    () => dispatch({ type: 'organize/progress', current: 0, total, stage: 'checking' }),
    700,
  );

  // 階段 3：snapshotting（逐張）
  let delay = 1400;
  tabs.forEach((t, i) => {
    setTimeout(() => {
      cur = i + 1;
      dispatch({
        type: 'organize/progress',
        current: cur,
        total,
        stage: 'snapshotting',
        currentTitle: t.title,
      });
    }, delay);
    delay += 200;
  });

  // 階段 4：closing
  setTimeout(
    () => dispatch({ type: 'organize/progress', current: total, total, stage: 'closing' }),
    delay,
  );

  // 階段 5：done
  setTimeout(() => {
    dispatch({
      type: 'organize/done',
      summary: {
        scanned: total,
        checked: total,
        snapshotted: total - 2,
        excluded: 2,
        closed: total,
        durationMs: Date.now() - t0,
      },
    });
    // 清除整理中標記
    chrome.storage.local.set({
      'tabOrganizer.settings': { revalidateIntervalMinutes: 10080, organizeInProgress: false },
    });
    chrome.storage.onChanged?.dispatchInternal?.(
      { 'tabOrganizer.settings': { newValue: { organizeInProgress: false } } },
      'local',
    );
  }, delay + 400);

  return { ok: true };
});

// 模擬 revalidate/run 完成並廣播 revalidate/done
registerHandler('revalidate/run', () => {
  setTimeout(() => {
    // 透過 chrome.runtime.onMessage listener 廣播
    const evt = { type: 'revalidate/done', checked: 20, gone: 3 };
    (globalThis as any).chrome.runtime.onMessage.dispatchInternal?.(evt);
  }, 600);
  return { ok: true, checked: 20, gone: 3 };
});

registerHandler('scan/request', () => ({
  type: 'scan/response',
  candidates: [
    { tabId: 1, windowId: 1, url: 'https://github.com/vuejs/core', title: 'vuejs/core', domain: 'github.com', suggestedCategoryId: 1 },
    { tabId: 2, windowId: 1, url: 'https://github.com/anthropics/sdk', title: 'anthropics/sdk', domain: 'github.com', suggestedCategoryId: 1 },
    { tabId: 3, windowId: 1, url: 'https://github.com/microsoft/ts/pull/55555', title: 'TypeScript PR', domain: 'github.com', suggestedCategoryId: 1 },
    { tabId: 4, windowId: 1, url: 'https://stackoverflow.com/q1', title: 'SO question', domain: 'stackoverflow.com', suggestedCategoryId: 1 },
    { tabId: 5, windowId: 1, url: 'https://stackoverflow.com/q2', title: 'SO question 2', domain: 'stackoverflow.com', suggestedCategoryId: 1 },
    { tabId: 6, windowId: 1, url: 'https://developer.mozilla.org/idb', title: 'IndexedDB MDN', domain: 'developer.mozilla.org', suggestedCategoryId: 2 },
    { tabId: 7, windowId: 1, url: 'https://developer.mozilla.org/fetch', title: 'Fetch MDN', domain: 'developer.mozilla.org', suggestedCategoryId: 2 },
    { tabId: 8, windowId: 1, url: 'https://vitejs.dev/build', title: 'Vite build', domain: 'vitejs.dev', suggestedCategoryId: 2 },
    { tabId: 9, windowId: 1, url: 'https://youtube.com/x', title: 'YT', domain: 'youtube.com', suggestedCategoryId: 3 },
    { tabId: 10, windowId: 1, url: 'https://reddit.com/r/programming', title: 'r/programming', domain: 'reddit.com', suggestedCategoryId: 3 },
    { tabId: 11, windowId: 1, url: 'https://news.ycombinator.com/x', title: 'HN', domain: 'news.ycombinator.com', suggestedCategoryId: null },
    { tabId: 12, windowId: 1, url: 'https://twitter.com/x', title: 'X', domain: 'twitter.com', suggestedCategoryId: null },
    { tabId: 13, windowId: 1, url: 'https://figma.com/x', title: 'Figma', domain: 'figma.com', suggestedCategoryId: null },
    { tabId: 14, windowId: 1, url: 'https://notion.so/x', title: 'Notion', domain: 'notion.so', suggestedCategoryId: null },
  ],
  total: 47,
  suggested: 32,
  unassigned: 15,
}));

(async () => {
  await seedDatabase();
  const app = createApp(ManagerApp);
  app.use(createPinia());
  app.mount('#app');
})();
