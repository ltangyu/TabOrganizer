# TabOrganizer 隱私政策

**最後更新：2026-05-20**

## 簡述

TabOrganizer 完全在使用者本機運作。我們**不蒐集、不傳輸、不分享**您的任何資料給外部伺服器。

## 資料儲存位置

| 資料類型 | 儲存位置 |
|---|---|
| 分類設定、Domain 規則 | 您瀏覽器的 IndexedDB（`TabOrganizerDB`） |
| 截圖縮圖（WebP, 512px） | 您瀏覽器的 IndexedDB |
| 截圖原圖（JPEG） | 您本機的下載資料夾 `TabOrganizer/<domain>/` |
| 剔除紀錄（404 / 失效連結） | 您瀏覽器的 IndexedDB |
| UI 偏好（語言、深色模式、整理流程設定） | `chrome.storage.local` |

## 權限說明

TabOrganizer 需要的 Chrome 權限與用途：

| 權限 | 用途 |
|---|---|
| `tabs` | 列舉、切換、關閉您打開的分頁 |
| `activeTab` | `captureVisibleTab` API 需要 |
| `downloads` | 把截圖原圖寫到下載資料夾 |
| `storage` | 儲存設定與偏好 |
| `alarms` | 排程定期重掃失效連結 |
| `tabGroups` | （預留）讀取現有 Tab Groups 作分類來源 |
| `host_permissions: <all_urls>` | 對任意網站發 HEAD 請求檢查 404、`captureVisibleTab` 對任意網域 |

`<all_urls>` host permission 範圍較大，但是 TabOrganizer **僅在您手動觸發整理時**對相關 URL 發 HEAD 請求，且**不發送任何 cookie 或敏感資料**到外部。

## 不蒐集的資料

- 您的瀏覽歷史
- Cookie 或登入資訊
- 個人身分資訊
- 使用分析 / Telemetry
- 廣告追蹤

## 第三方服務

無。TabOrganizer 不使用任何第三方 API、不嵌入任何分析或追蹤腳本。

## 資料刪除

如要完全移除 TabOrganizer 的資料：

1. 在 `chrome://extensions` 移除 TabOrganizer 擴充功能 — 會清除 IndexedDB 與 chrome.storage
2. 手動刪除下載資料夾 `Downloads/TabOrganizer/`（截圖原圖）

## 聯絡

如有疑慮：
- GitHub Issues：[https://github.com/ltangyu/TabOrganizer/issues](https://github.com/ltangyu/TabOrganizer/issues)
- Email：l.tang.yu@gmail.com

## 變更紀錄

| 日期 | 變更 |
|---|---|
| 2026-05-20 | 初版 |
