/**
 * 用 chrome.debugger API 抓取「整頁」截圖（含滾動範圍），而非僅可見區域。
 *
 * chrome.tabs.captureVisibleTab 只能截可見視窗大小；對於需要長截圖的歸檔
 * 用途，必須用 DevTools Protocol 的 Page.captureScreenshot + captureBeyondViewport。
 *
 * 副作用：執行期間目標 tab 會出現黃色「DevTools 正在偵錯」橫幅；attach/detach
 * 完成後自動消失。
 */

const DEBUGGER_VERSION = '1.3';

export interface FullPageCaptureOpts {
  format?: 'jpeg' | 'png';
  quality?: number;
  /** 上限高度（px），避免超長頁面爆 base64。預設 16000 */
  maxHeight?: number;
}

/**
 * 對指定 tab 抓全頁截圖，回傳 data URL。
 * 若 chrome.debugger 不可用或 attach 失敗，throw — 呼叫者應 fallback。
 */
export async function captureFullPage(
  tabId: number,
  opts: FullPageCaptureOpts = {},
): Promise<string> {
  const format = opts.format ?? 'jpeg';
  const quality = opts.quality ?? 80;
  const maxHeight = opts.maxHeight ?? 16000;

  await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);

  try {
    // 確認頁面 metric 不會超過 maxHeight，否則 clip 限縮
    const layout = (await chrome.debugger.sendCommand(
      { tabId },
      'Page.getLayoutMetrics',
    )) as {
      cssContentSize?: { x: number; y: number; width: number; height: number };
      contentSize?: { x: number; y: number; width: number; height: number };
    };
    const contentSize = layout.cssContentSize ?? layout.contentSize;

    let clip: { x: number; y: number; width: number; height: number; scale: number } | undefined;
    if (contentSize) {
      const targetH = Math.min(contentSize.height, maxHeight);
      clip = {
        x: 0,
        y: 0,
        width: contentSize.width,
        height: targetH,
        scale: 1,
      };
    }

    const params: Record<string, unknown> = {
      format,
      quality: format === 'jpeg' ? quality : undefined,
      captureBeyondViewport: true,
      fromSurface: true,
    };
    if (clip) params.clip = clip;

    const result = (await chrome.debugger.sendCommand(
      { tabId },
      'Page.captureScreenshot',
      params,
    )) as { data: string };

    return `data:image/${format};base64,${result.data}`;
  } finally {
    // 一定要 detach 否則 tab 永遠卡黃色 banner
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      /* 已被 detach 或 tab 已關閉 */
    }
  }
}
