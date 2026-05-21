/**
 * 用 chrome.debugger API 抓取「整頁」截圖（含滾動範圍），而非僅可見區域。
 *
 * chrome.tabs.captureVisibleTab 只能截可見視窗大小；對於需要長截圖的歸檔
 * 用途，必須用 DevTools Protocol 的 Page.captureScreenshot + captureBeyondViewport。
 *
 * 關鍵特性：chrome.debugger 在「背景 tab」也能截圖（無需 chrome.tabs.update 切 active），
 * 這對 organize 流程非常重要 — 不會搶走管理頁焦點。
 *
 * 副作用：執行期間目標 tab 會出現黃色「DevTools 正在偵錯」橫幅；attach/detach
 * 完成後自動消失。
 *
 * 防呆：所有 chrome.debugger 呼叫都包 timeout，避免單一 tab 掛住整個流程
 * （例如 YouTube 播放器、無限滾動頁面、chrome.debugger 自己 hang）。
 */

const DEBUGGER_VERSION = '1.3';
const ATTACH_TIMEOUT_MS = 3_000;
// 從 15s 縮短到 6s — 對於會 hang 的頁面（Drive folder、無限滾動等）
// 等 15s 才放棄太慢；6s 已涵蓋絕大多數正常頁面的截圖時間，
// 偶爾真的需要更久的就讓它落入 fallback captureVisibleTab。
const COMMAND_TIMEOUT_MS = 6_000;

export interface FullPageCaptureOpts {
  format?: 'jpeg' | 'png';
  quality?: number;
  /** 上限高度（px），避免超長頁面爆 base64。預設 16000 */
  maxHeight?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * 對指定 tab 抓全頁截圖，回傳 data URL。
 * 若 chrome.debugger 不可用、attach 失敗、或任一階段 timeout → throw，呼叫者應 fallback。
 */
export async function captureFullPage(
  tabId: number,
  opts: FullPageCaptureOpts = {},
): Promise<string> {
  const format = opts.format ?? 'jpeg';
  const quality = opts.quality ?? 80;
  const maxHeight = opts.maxHeight ?? 16000;

  // 防禦性 detach：上一輪若是 timeout 中斷，debugger session 可能還掛著 →
  // 下次 attach 會回「Another debugger is already attached」。
  // 先試著清掉殘留 session，沒有就無聲略過。
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    /* no leftover session, fine */
  }

  await withTimeout(
    chrome.debugger.attach({ tabId }, DEBUGGER_VERSION),
    ATTACH_TIMEOUT_MS,
    'debugger.attach',
  );

  try {
    // 確認頁面 metric 不會超過 maxHeight，否則 clip 限縮
    const layout = (await withTimeout(
      chrome.debugger.sendCommand({ tabId }, 'Page.getLayoutMetrics') as Promise<unknown>,
      COMMAND_TIMEOUT_MS,
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

    const result = (await withTimeout(
      chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', params) as Promise<unknown>,
      COMMAND_TIMEOUT_MS,
      'Page.captureScreenshot',
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
