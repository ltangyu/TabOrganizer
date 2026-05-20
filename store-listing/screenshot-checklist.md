# Chrome Web Store 截圖清單

Chrome Web Store 要求至少 1 張截圖，最多 5 張。**建議拍滿 5 張**以提升曝光。

## 規格

| 項目 | 規格 |
|---|---|
| 解析度 | **1280 × 800** px（建議）或 640 × 400 px |
| 格式 | PNG 或 JPEG |
| 數量 | 1–5 張 |
| 內容 | 必須是擴充功能實際畫面（不接受拼貼） |

## 建議的 5 張截圖（按順序）

### 1. **主管理頁 — 縮圖網格（明亮模式）**
- 開啟 `chrome-extension://[id]/src/manager/manager.html`
- 確認有至少 8-12 張縮圖卡片（用 `Organize all tabs` 整理一批分頁後）
- 顯示完整 header（brand mark + 「就緒 · N」 + 搜尋框 + 網格/清單 + 已剔除 + 控制面板 + 一鍵整理所有分頁）
- 顯示 CategoryStrip 6 個 chip
- 顯示 FilterBar
- 視窗縮到 1280×800

### 2. **進度視窗 — 一鍵整理中**
- 在管理頁按「一鍵整理所有分頁」
- 進度視窗顯示「截圖中…」階段、進度條 ~50%、目前處理的標題
- 後方仍能隱約看到管理頁

### 3. **控制面板 — 設定 tab（深色模式）**
- 開啟控制面板 → 預設 active 設定 tab
- 啟用「黑夜模式」展示深色 UI
- 顯示「介面 / 整理流程」兩個區塊與完整 segmented controls
- 拖曳到視窗中央或右上方

### 4. **控制面板 — 排版 tab（即時調整）**
- 控制面板切到「排版」tab
- 顯示欄數 slider、卡片密度、縮圖比例、動作位置等
- 背景顯示管理頁，可以看到調整後的網格變化（如改成 7 欄）

### 5. **截圖詳情 modal + 內建分類多語言**
- 點任一縮圖開啟 SnapshotDetailModal
- 顯示大圖 + 標題 / URL / 網域 / 分類 / 歸檔時間 / 狀態 / 下載路徑 完整中繼資料
- 底部 3 個按鈕：刪除歸檔 / 改分類 / 重新開啟分頁
- 可額外切到英文（en）展示 i18n 效果

## 拍攝步驟（Windows 範例）

1. **建置最新版本**：`npm run build`
2. **載入到 Chrome**：`chrome://extensions` → 開發人員模式 → 載入未封裝 `dist/`
3. **準備資料**：實際開 10-15 個分頁（混合 GitHub / MDN / YouTube 等），執行一鍵整理
4. **拍截圖**：
   - Windows：`Win + Shift + S` 或 ShareX
   - Mac：`Cmd + Shift + 4` 然後選範圍
5. **縮放**：用 [ShareX / IrfanView / Photoshop] 統一縮成 1280×800

## 推薦的 promotional 圖（選填）

| 類型 | 規格 | 用途 |
|---|---|---|
| Small Promo Tile | 440 × 280 | 商店列表縮圖（必填） |
| Marquee Promo Tile | 1400 × 560 | 首頁精選 banner（選填，但有的話 Google 更願意推薦） |
| Icon | 128 × 128 | 已有，使用 `icons/icon-128.png` |

Small Promo Tile 建議用：黑底 + 白色 TabOrganizer logo + 一行簡短說明「One-click tab cleanup」。

## 多語言截圖

Chrome Web Store 支援多語言 listing。如果想提升各語系曝光度，可為每個目標語言（zh-Hant / zh-Hans / en / ja 等）各拍一組 5 張截圖（切到該語言後再拍）。

最低標準：英文 5 張 + 繁中 5 張，其他語言可只填短描述用同樣的英文截圖。
