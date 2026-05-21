import type { TabCandidate, ArchivedTab } from '@/types/archive';
import type { ProgressStage } from '@/types/messages';
import { sleep } from '@/utils/time';
import { resizeToThumb } from '@/utils/image';
import { slugifyForFilename } from '@/utils/domain';
import { addArchivedTab } from './archive-store';
import { captureFullPage } from './full-page-capture';

const FALLBACK_SETTLE_MS = 150;
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
 * 1. 優先用 chrome.debugger 全頁截圖（背景 tab 也能截，不搶焦點，且有 timeout 保護）
 * 2. 若 debugger 失敗才退而求其次：切 active + captureVisibleTab
 *    這條 fallback 會打斷使用者操作（管理頁失焦），但只在 chrome.debugger
 *    完全不可用時才會走（例如 chrome:// 內部頁、debugger 被其他 ext 佔用）
 */
async function captureTab(t: TabCandidate): Promise<string> {
  try {
    return await captureFullPage(t.tabId, {
      format: 'jpeg',
      quality: 80,
      maxHeight: 16000,
    });
  } catch (debugErr) {
    console.warn('[TabOrganizer] full-page capture failed, fallback', t.url, debugErr);
    await chrome.tabs.update(t.tabId, { active: true });
    // captureVisibleTab 需要視窗也是 focused，但管理頁通常在另一個視窗 ——
    // 這裡盡量試試看，失敗就讓外層 catch 處理
    await sleep(FALLBACK_SETTLE_MS);
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
