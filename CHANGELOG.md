# Changelog

All notable changes to TabOrganizer.

## [0.1.0] — 2026-05-20

### Added
- 一鍵整理所有開啟分頁：HEAD 檢查 → 截圖 → 關閉
- 分類與 domain 規則（支援 `*.example.com` wildcard）
- 截圖縮圖存 IndexedDB、原圖存下載資料夾
- 404 / 失效連結自動剔除（記到剔除清單）
- 全螢幕管理頁（縮圖網格 + 篩選 + 搜尋）
- 按原分類一鍵重新打開所有頁面
- 定期重掃舊連結（chrome.alarms）
- 可拖曳控制面板（設定 / 排版 / 整理 3 tab）
- 深色模式（CSS token swap，深灰階非純黑，狀態燈保留原色）
- 10 種語言介面（zh-Hant / zh-Hans / en / ja / ko / es / fr / de / pt / vi，動態載入）
- 內建分類「收件匣」隨語言切換（使用者改名後自動降級為 user-defined）
- 4 色狀態燈（OK / WARN / ERR / IDLE）含光暈

### Tech
- Vue 3.5 + TypeScript 5.6 + Vite 5 + @crxjs/vite-plugin
- Pinia 2 + Dexie.js 4
- Chrome MV3 manifest
- 完全本機運作，無外部資料傳輸
