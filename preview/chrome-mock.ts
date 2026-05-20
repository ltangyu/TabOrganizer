// 預覽用 chrome.* API stub。在 Vue mount 之前載入以避免 popup/manager 元件呼叫真實 API。

interface FakeStorage {
  [key: string]: unknown;
}

interface MessageListener {
  (msg: unknown, sender: unknown, sendResponse: (response?: unknown) => void): boolean | undefined;
}

const storage: FakeStorage = {};
const messageListeners: MessageListener[] = [];
const alarmListeners: Array<(alarm: { name: string }) => void> = [];
type StorageChangeListener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void;
const storageChangeListeners: StorageChangeListener[] = [];

export interface FakeTabInfo {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

const fakeTabs: FakeTabInfo[] = [
  { id: 1, windowId: 1, url: 'https://github.com/anthropics/anthropic-sdk-python', title: 'anthropics/anthropic-sdk-python · GitHub' },
  { id: 2, windowId: 1, url: 'https://github.com/vuejs/core', title: 'vuejs/core · GitHub' },
  { id: 3, windowId: 1, url: 'https://stackoverflow.com/questions/12345', title: 'How to fix TypeScript strict null check — Stack Overflow' },
  { id: 4, windowId: 1, url: 'https://news.ycombinator.com/item?id=987654', title: 'Show HN: TabOrganizer | Hacker News' },
  { id: 5, windowId: 1, url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', title: 'Fetch API — MDN' },
  { id: 6, windowId: 1, url: 'https://www.youtube.com/watch?v=abc', title: 'A long tutorial video — YouTube' },
  { id: 7, windowId: 1, url: 'https://www.reddit.com/r/programming/comments/xyz', title: 'r/programming — Reddit' },
  { id: 8, windowId: 1, url: 'https://medium.com/@author/long-article-title', title: 'A long article about software — Medium' },
  { id: 9, windowId: 1, url: 'https://twitter.com/anthropic/status/123', title: 'Anthropic on X' },
  { id: 10, windowId: 1, url: 'https://www.notion.so/workspace/Project-doc', title: 'Project doc — Notion' },
];

let messageHandlers: Record<string, (msg: any) => Promise<unknown> | unknown> = {};
export function registerHandler(type: string, fn: (msg: any) => Promise<unknown> | unknown): void {
  messageHandlers[type] = fn;
}

const fakeChrome: any = {
  runtime: {
    getURL: (path: string) => `https://preview.local/${path}`,
    sendMessage: (msg: any) => {
      const handler = messageHandlers[msg?.type];
      if (handler) return Promise.resolve(handler(msg));
      return Promise.resolve({ ok: true });
    },
    onMessage: {
      addListener: (fn: MessageListener) => messageListeners.push(fn),
      removeListener: (fn: MessageListener) => {
        const i = messageListeners.indexOf(fn);
        if (i >= 0) messageListeners.splice(i, 1);
      },
      // 預覽用：模擬 service worker broadcast
      dispatchInternal: (msg: unknown) => {
        for (const l of messageListeners) {
          try {
            l(msg, {}, () => {});
          } catch (e) {
            console.warn('listener err', e);
          }
        }
      },
    },
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
  },
  storage: {
    local: {
      get: (key: string | string[] | null) => {
        if (key == null) return Promise.resolve({ ...storage });
        if (typeof key === 'string') return Promise.resolve({ [key]: storage[key] });
        const out: FakeStorage = {};
        for (const k of key) out[k] = storage[k];
        return Promise.resolve(out);
      },
      set: (obj: FakeStorage) => {
        Object.assign(storage, obj);
        return Promise.resolve();
      },
    },
    onChanged: {
      addListener: (fn: StorageChangeListener) => storageChangeListeners.push(fn),
      dispatchInternal: (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => {
        for (const l of storageChangeListeners) {
          try {
            l(changes, area);
          } catch (e) {
            console.warn('storage listener err', e);
          }
        }
      },
    },
  },
  tabs: {
    query: () =>
      Promise.resolve(
        fakeTabs.map((t) => ({
          ...t,
          active: t.id === 1,
          windowId: 1,
        })),
      ),
    create: (props: any) => {
      console.info('[preview] chrome.tabs.create', props);
      return Promise.resolve({ id: Date.now(), ...props });
    },
    update: (id: number, props: any) => Promise.resolve({ id, ...props }),
    get: (id: number) => Promise.resolve(fakeTabs.find((t) => t.id === id) ?? null),
    remove: (ids: number | number[]) => {
      console.info('[preview] chrome.tabs.remove', ids);
      return Promise.resolve();
    },
    captureVisibleTab: () =>
      Promise.resolve(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      ),
  },
  windows: {
    update: () => Promise.resolve({}),
  },
  alarms: {
    create: () => {},
    get: () => Promise.resolve(undefined),
    clear: () => Promise.resolve(true),
    onAlarm: {
      addListener: (fn: (alarm: { name: string }) => void) => alarmListeners.push(fn),
    },
  },
  downloads: {
    download: (opts: any) => {
      console.info('[preview] chrome.downloads.download', opts);
      return Promise.resolve(Math.floor(Math.random() * 1e6));
    },
  },
  action: {
    onClicked: { addListener: () => {} },
  },
};

(globalThis as any).chrome = fakeChrome;

export {};
