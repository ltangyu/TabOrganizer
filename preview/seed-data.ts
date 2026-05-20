import { db } from '@/modules/archive-store';
import type { ArchivedTab, Category, DomainRule, ExcludedRecord } from '@/types/archive';

async function makeThumb(label: string, hue: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, `hsl(${hue}, 12%, 96%)`);
  g.addColorStop(1, `hsl(${hue}, 12%, 88%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 320);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = '600 28px Inter, "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 256, 160);

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let y = 40; y < 320; y += 24) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(452, y);
    ctx.stroke();
  }

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/png'),
  );
}

const SAMPLE_TABS: Array<Omit<ArchivedTab, 'thumbBlob' | 'archivedAt' | 'status' | 'categoryId'> & {
  category: string;
  daysAgo: number;
  status?: 'ok' | 'gone';
  hue: number;
}> = [
  { url: 'https://github.com/vuejs/core/issues/9210', title: 'vue 3.5 reactivity proxy memory leak · Issue #9210', domain: 'github.com', category: '工作', daysAgo: 0, hue: 0, status: 'ok' },
  { url: 'https://github.com/anthropics/anthropic-sdk-python', title: 'anthropic-sdk-python · README', domain: 'github.com', category: '工作', daysAgo: 0, hue: 0, status: 'ok' },
  { url: 'https://github.com/microsoft/TypeScript/pull/55555', title: '[TypeScript] Add satisfies expression refinement', domain: 'github.com', category: '工作', daysAgo: 1, hue: 0, status: 'ok' },
  { url: 'https://stackoverflow.com/questions/12321/typescript-strict', title: 'How to use exactOptionalPropertyTypes correctly', domain: 'stackoverflow.com', category: '工作', daysAgo: 1, hue: 30, status: 'ok' },
  { url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API', title: 'IndexedDB API — MDN Web Docs', domain: 'developer.mozilla.org', category: '學習', daysAgo: 2, hue: 220, status: 'ok' },
  { url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', title: 'Fetch API — MDN', domain: 'developer.mozilla.org', category: '學習', daysAgo: 2, hue: 220, status: 'ok' },
  { url: 'https://vitejs.dev/guide/build.html', title: 'Building for Production · Vite', domain: 'vitejs.dev', category: '學習', daysAgo: 3, hue: 200, status: 'ok' },
  { url: 'https://dexie.org/docs/Tutorial/Vue', title: 'Dexie + Vue Tutorial', domain: 'dexie.org', category: '學習', daysAgo: 3, hue: 280, status: 'ok' },
  { url: 'https://www.youtube.com/watch?v=longvideoid', title: 'Building a Chrome Extension in 2026 — YouTube', domain: 'youtube.com', category: '娛樂', daysAgo: 4, hue: 350, status: 'ok' },
  { url: 'https://www.youtube.com/watch?v=concert', title: '深夜長 Live · 久石讓', domain: 'youtube.com', category: '娛樂', daysAgo: 5, hue: 350, status: 'ok' },
  { url: 'https://www.reddit.com/r/programming/comments/123', title: 'Why I switched from Webpack to Vite — r/programming', domain: 'reddit.com', category: '娛樂', daysAgo: 5, hue: 20, status: 'ok' },
  { url: 'https://news.ycombinator.com/item?id=987654', title: 'Show HN: TabOrganizer — manage browser tabs effortlessly', domain: 'news.ycombinator.com', category: '工作', daysAgo: 6, hue: 30, status: 'gone' },
  { url: 'https://medium.com/@author/long-article-title', title: 'A long article about software craftsmanship', domain: 'medium.com', category: '學習', daysAgo: 7, hue: 130, status: 'ok' },
  { url: 'https://twitter.com/anthropic/status/123', title: 'Anthropic on X: launching Claude Opus 4.7', domain: 'twitter.com', category: '工作', daysAgo: 7, hue: 195, status: 'ok' },
  { url: 'https://www.notion.so/workspace/Project-Doc', title: 'TabOrganizer · Project Doc', domain: 'notion.so', category: '工作', daysAgo: 8, hue: 60, status: 'ok' },
  { url: 'https://figma.com/file/abc/Tab-Organizer', title: 'TabOrganizer · Figma 設計檔', domain: 'figma.com', category: '工作', daysAgo: 9, hue: 290, status: 'ok' },
  { url: 'https://www.deepl.com/translator', title: 'DeepL 翻譯', domain: 'deepl.com', category: '學習', daysAgo: 10, hue: 240, status: 'ok' },
  { url: 'https://hbr.org/article-on-management', title: '管理階層該學什麼 — Harvard Business Review', domain: 'hbr.org', category: '學習', daysAgo: 12, hue: 0, status: 'gone' },
  { url: 'https://chat.openai.com/c/some-session', title: 'ChatGPT 對話 — TypeScript 教學', domain: 'chat.openai.com', category: '工作', daysAgo: 15, hue: 160, status: 'ok' },
  { url: 'https://claude.ai/chat/abc-xyz', title: 'Claude · 程式碼審查紀錄', domain: 'claude.ai', category: '工作', daysAgo: 16, hue: 35, status: 'ok' },
];

const EXCLUDED: Omit<ExcludedRecord, 'excludedAt'>[] = [
  { url: 'https://news.ycombinator.com/item?id=987654', title: 'Show HN: TabOrganizer', domain: 'news.ycombinator.com', reason: 'http-error', statusCode: 404 },
  { url: 'https://hbr.org/article-on-management', title: '管理階層該學什麼', domain: 'hbr.org', reason: 'http-error', statusCode: 410 },
  { url: 'https://example.test/dead-link', title: '無效範例頁', domain: 'example.test', reason: 'network-error' },
  { url: 'https://slow.example.com/timeout', title: '逾時的範例頁', domain: 'slow.example.com', reason: 'timeout' },
];

export async function seedDatabase(): Promise<void> {
  const existing = await db.categories.count();
  if (existing > 0) return;

  const categoryDefs: Omit<Category, 'id'>[] = [
    { name: '工作', color: '#000000', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30 },
    { name: '學習', color: '#6b6b6b', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20 },
    { name: '娛樂', color: '#9c9c9c', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10 },
    {
      name: '收件匣',
      color: '#c8c6c6',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
      builtinKey: 'category.builtin.inbox',
    },
  ];

  const catIds: Record<string, number> = {};
  for (const def of categoryDefs) {
    const id = (await db.categories.add(def)) as number;
    catIds[def.name] = id;
  }

  const ruleDefs: Omit<DomainRule, 'id'>[] = [
    { domain: 'github.com', categoryId: catIds['工作']! },
    { domain: 'stackoverflow.com', categoryId: catIds['工作']! },
    { domain: '*.developer.mozilla.org', categoryId: catIds['學習']! },
    { domain: 'developer.mozilla.org', categoryId: catIds['學習']! },
    { domain: 'youtube.com', categoryId: catIds['娛樂']! },
    { domain: 'reddit.com', categoryId: catIds['娛樂']! },
  ];
  await db.domainRules.bulkAdd(ruleDefs as DomainRule[]);

  for (const t of SAMPLE_TABS) {
    const blob = await makeThumb(t.domain, t.hue);
    const archivedAt = Date.now() - 1000 * 60 * 60 * 24 * t.daysAgo - 1000 * 60 * 23;
    // 「待分類」→ 對應到新建的「收件匣」分類
    const catKey = t.category === '待分類' ? '收件匣' : t.category;
    const rec: ArchivedTab = {
      url: t.url,
      title: t.title,
      domain: t.domain,
      categoryId: catIds[catKey] ?? null,
      thumbBlob: blob,
      archivedAt,
      status: t.status ?? 'ok',
    };
    await db.archives.add(rec);
  }

  for (const e of EXCLUDED) {
    await db.excluded.add({ ...e, excludedAt: Date.now() - 1000 * 60 * 60 * 24 * 2 });
  }
}
