# TabOrganizer

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg)](https://www.typescriptlang.org/)

Chrome / Edge MV3 擴充功能。把累積過多的分頁分類、截圖保留 URL，然後關閉以釋放記憶體；管理頁以縮圖網格瀏覽，按原分類一鍵重新打開。10 種語言、深色模式、可拖曳控制面板。

> 一鍵把幾十個開著的分頁變成有條理的歸檔，記憶體即時釋放。

## 主要功能

- **分頁分類**：手動分類 + 按 domain 自動推薦規則（支援 `*.example.com` wildcard）
- **截圖歸檔**：HEAD 檢查 → 截圖（縮圖存 IndexedDB，原圖下載到本機）→ 關閉分頁釋放記憶體
- **404 自動剔除**：失效連結不浪費截圖成本，記到剔除清單，分頁仍會關閉
- **一鍵整理**：所有分頁掃描 → 檢查 → 截圖 → 關閉的完整自動流程
- **管理頁**：縮圖卡片網格、可篩選、可搜尋、可按原分類重新打開
- **定期重掃**：背景任務定期檢查已歸檔連結是否仍有效
- **多語言**：繁體中文、简体中文、English、日本語、한국어、Español、Français、Deutsch、Português、Tiếng Việt（按需動態載入）
- **深色模式**：CSS variable token swap（深灰階非純黑），狀態燈保留原色

## 快速開始

### 下載免安裝版（推薦）

到 [Releases](https://github.com/ltangyu/TabOrganizer/releases) 下載最新 `TabOrganizer-v0.1.0-portable.zip`，解壓縮到任意位置。

### 載入到 Chrome / Edge（任何作業系統）

| 平台 | 路徑 |
|---|---|
| Windows | `chrome://extensions` 或 `edge://extensions` |
| macOS | 同上（Chrome / Edge 跨平台） |
| Linux | 同上 |

1. 開啟 `chrome://extensions/`（Edge 則為 `edge://extensions/`）
2. 右上開啟「**開發人員模式**」
3. 點「**載入未封裝項目**」（macOS / Linux 可能顯示為「Load unpacked」）
4. 選解壓縮後的資料夾（內含 `manifest.json`）
5. 工具列出現 TabOrganizer icon

### 第一次使用

1. 點工具列 icon 開啟 popup
2. 點「**控制面板**」→「整理」tab → 看到目前可整理分頁數
3. 點「**分類設定**」建立第一個分類（例如「工作」+ 規則 `github.com`）
4. 隨意開幾個分頁（混合 GitHub 與其他網站）
5. 點「**一鍵整理所有分頁**」
6. 自動跳到管理頁 → 看見 5 階段進度 → 完成後縮圖網格出現

## 從原始碼建置

```bash
git clone https://github.com/ltangyu/TabOrganizer.git
cd TabOrganizer
npm install
npm run build
```

`dist/` 即為可載入 Chrome 的擴充功能資料夾。

## 開發模式

```bash
# 含 HMR 的開發模式（dist/ 即時更新）
npm run dev

# 視覺預覽（內含 chrome.* mock + 範例資料，瀏覽器即可看 UI）
npm run preview:dev
# → http://localhost:5180/

# 製作 portable zip
npm run package
# → releases/TabOrganizer-v0.1.0-portable.zip
```

## 技術棧

- **語言**：TypeScript 5.6（strict）
- **UI**：Vue 3.5（`<script setup>`） + Pinia 2
- **建置**：Vite 5 + `@crxjs/vite-plugin` 2.x
- **儲存**：Dexie.js 4（IndexedDB 封裝）
- **設計**：[ii Design Language](https://github.com/ltangyu/ii) — 黑白灰 + 0.5px 邊框 + 10px 圓角 + Inter / Space Grotesk

## 專案結構

```
src/
├── background/service-worker.ts      # 一鍵整理協調器、定期重掃
├── popup/                             # 工具列彈窗（360×480）
├── manager/                           # 全螢幕管理頁
├── components/
│   ├── layout/                        # ShellHeader、CategoryStrip
│   ├── archive/                       # ThumbnailCard、Grid、Filter
│   ├── category/                      # Editor、Picker、DomainRuleList
│   ├── control/ControlPanel.vue       # 可拖曳控制面板（設定/排版/整理 3 tab）
│   ├── progress/                      # 整理進度 overlay
│   └── ui/                            # ModalShell、StatusDot 等
├── stores/                            # Pinia stores
├── modules/                           # tab-scanner / link-checker / tab-snapshotter 等
├── locales/                           # 10 種語言 JSON
├── composables/i18n.ts                # 動態載入 i18n
├── styles/                            # ii Design Language tokens
└── types/                             # 共用 TypeScript 型別
```

## 隱私政策

TabOrganizer 完全在本機運作 — 所有資料（分類、截圖、歸檔紀錄）都存於使用者的 IndexedDB 與下載資料夾，**不傳送任何資料到外部伺服器**。

詳細隱私政策見 [PRIVACY.md](PRIVACY.md)。

## 貢獻

歡迎 PR 或 Issue：

- Bug：[Issues](https://github.com/ltangyu/TabOrganizer/issues)
- 新增語言：在 `src/locales/` 新增 `<lang-code>.json`，並在 `src/composables/i18n.ts` 的 `SUPPORTED_LANGS` 加入該語言；Vite glob 會自動拾取，不用改其他程式碼

## License

[MIT](LICENSE) © 2026
