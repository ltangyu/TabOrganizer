import type { TabCandidate, ArchivedTab } from '@/types/archive';
import type { ProgressStage } from '@/types/messages';
import { sleep } from '@/utils/time';
import { resizeToThumb } from '@/utils/image';
import { slugifyForFilename } from '@/utils/domain';
import { addArchivedTab } from './archive-store';
import { captureFullPage } from './full-page-capture';

/**
 * 切 active 後等待頁面渲染（GPU 從背景節流喚醒）的時間。
 * 太短 → 截到黑屏或部分渲染；太長 → 整理 412 tab 多花 N*delta 秒。
 * 400ms 經驗值：覆蓋大多數頁面從背景節流恢復到首次 paint 的時間。
 */
const SETTLE_DELAY_MS = 400;
const THUMB_MAX_WIDTH = 512;

export type SnapshotProgress = (info: {
  current: number;
  total: number;
  stage: ProgressStage;
  currentTitle?: string;
}) => void;

export interface SnapshotOutcome {
  archivedCount: number;
  failedCount: number;
  archivedTabIds: number[];
  failedTabIds: number[];
}

/**
 * 抓單一 tab 截圖：
 *
 * **關鍵：必須先 chrome.tabs.update {active:true} 才能截到真實內容。**
 * 雖然 chrome.debugger Page.captureScreenshot 能對背景 tab 呼叫，但 Chrome
 * 會節流背景 tab 的 GPU compositing → 抓到黑屏或殘留 frame。
 *
 * 不會搶管理頁焦點：chrome.tabs.update {active:true} 只改變該視窗內哪個
 * tab 是 active，**不會改變 Windows 視窗焦點**。管理頁通常在獨立視窗
 * （--app 或 popup window），所以使用者完全不會被干擾，只有「被整理的那個
 * 視窗」內部會看到 tab 一個個切換並被關閉。
 *
 * 1. 切 active → sleep 400ms 喚醒渲染
 * 2. chrome.debugger 全頁截圖（含滾動範圍）
 * 3. 若 debugger 失敗 → 用 captureVisibleTab 抓 active tab 可視區（fallback）
 */
async function captureTab(t: TabCandidate): Promise<string> {
  try {
    await chrome.tabs.update(t.tabId, { active: true });
  } catch {
    /* tab 可能已被使用者關閉 */
  }
  await sleep(SETTLE_DELAY_MS);

  try {
    return await captureFullPage(t.tabId, {
      format: 'jpeg',
      quality: 80,
      maxHeight: 16000,
    });
  } catch (debugErr) {
    console.warn('[TabOrganizer] full-page capture failed, fallback', t.url, debugErr);
    // tab 已 active，直接 captureVisibleTab 抓可視區
    return await chrome.tabs.captureVisibleTab(t.windowId, {
      format: 'jpeg',
      quality: 80,
    });
  }
}

export async function snapshotTabs(
  tabs: TabCandidate[],
  onProgress?: SnapshotProgress,
): Promise<SnapshotOutcome> {
  let archived = 0;
  let failed = 0;
  const archivedTabIds: number[] = [];
  const failedTabIds: number[] = [];
  const total = tabs.length;

  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i]!;
    onProgress?.({ current: i + 1, total, stage: 'snapshotting', currentTitle: t.title });
    try {
      const dataUrl = await captureTab(t);

      let thumbBlob: Blob | null = null;
      try {
        thumbBlob = await resizeToThumb(dataUrl, THUMB_MAX_WIDTH, 0.8);
      } catch {
        thumbBlob = null;
      }

      const tsSlug = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `TabOrganizer/${slugifyForFilename(t.domain || 'misc')}/${tsSlug}-${slugifyForFilename(t.title)}.jpg`;

      let downloadId: number | undefined;
      try {
        downloadId = await chrome.downloads.download({
          url: dataUrl,
          filename,
          saveAs: false,
          conflictAction: 'uniquify',
        });
      } catch {
        downloadId = undefined;
      }

      const record: ArchivedTab = {
        url: t.url,
        title: t.title,
        domain: t.domain,
        ...(t.favIconUrl ? { favIconUrl: t.favIconUrl } : {}),
        categoryId: t.suggestedCategoryId,
        thumbBlob,
        ...(downloadId !== undefined ? { downloadId } : {}),
        downloadPath: filename,
        archivedAt: Date.now(),
        status: 'ok',
      };
      await addArchivedTab(record);
      archived++;
      archivedTabIds.push(t.tabId);

      // 截圖完立即關掉這個 tab（close-as-you-go）
      // 這樣即使 SW 中途死掉，已處理的分頁不會殘留
      try {
        await chrome.tabs.remove(t.tabId);
      } catch {
        /* tab 可能已被使用者手動關閉 */
      }
    } catch (e) {
      console.warn('[TabOrganizer] snapshot failed', t.url, e);
      failed++;
      failedTabIds.push(t.tabId);
      // 使用者選了「一鍵整理」= 全部關閉。截不到的也關掉避免殘留佔記憶體。
      // （URL 已在 scan 階段記錄；若需要可從 scan history 找回）
      try {
        await chrome.tabs.remove(t.tabId);
      } catch {
        /* 已被關閉或不存在 */
      }
    }
  }

  return { archivedCount: archived, failedCount: failed, archivedTabIds, failedTabIds };
}
