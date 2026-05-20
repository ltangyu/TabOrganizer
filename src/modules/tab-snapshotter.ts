import type { TabCandidate, ArchivedTab } from '@/types/archive';
import type { ProgressStage } from '@/types/messages';
import { sleep } from '@/utils/time';
import { resizeToThumb } from '@/utils/image';
import { slugifyForFilename } from '@/utils/domain';
import { addArchivedTab } from './archive-store';

const SETTLE_DELAY_MS = 250;
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
      await chrome.tabs.update(t.tabId, { active: true });
      await sleep(SETTLE_DELAY_MS);

      const dataUrl = await chrome.tabs.captureVisibleTab(t.windowId, {
        format: 'jpeg',
        quality: 80,
      });

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
    } catch (e) {
      console.warn('[TabOrganizer] snapshot failed', t.url, e);
      failed++;
      failedTabIds.push(t.tabId);
    }
  }

  return { archivedCount: archived, failedCount: failed, archivedTabIds, failedTabIds };
}
