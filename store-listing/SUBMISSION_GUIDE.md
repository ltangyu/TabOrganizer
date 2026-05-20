# Chrome Web Store 上架指南

## 前置作業

1. **註冊開發者帳號**
   - 前往 [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
   - 用 Google 帳號登入
   - 一次性繳費 **5 USD** 註冊費（信用卡）

2. **準備好以下檔案**（本資料夾已備齊）
   - `releases/TabOrganizer-v0.1.0-portable.zip` — 上傳用 zip
   - `store-listing/description.zh-Hant.txt` 與 `description.en.txt` — 詳細描述
   - `store-listing/short-description.txt` — 短描述（10 種語言）
   - `store-listing/screenshot-checklist.md` — 截圖規格與內容指示
   - `PRIVACY.md` — 隱私政策（**需上傳到公開 URL**，例如 GitHub README）
   - 5 張截圖（依 screenshot-checklist.md 拍攝）

3. **隱私政策 URL**
   - Chrome Web Store 要求公開可訪問的隱私政策 URL
   - 推薦用：`https://github.com/ltangyu/TabOrganizer/blob/main/PRIVACY.md`
   - 或在 GitHub Pages 啟用：`https://ltangyu.github.io/TabOrganizer/PRIVACY.html`

## 上架流程

### Step 1: 上傳 zip

1. 進 devconsole → 「**新增項目**」（Add new item）
2. 上傳 `releases/TabOrganizer-v0.1.0-portable.zip`
3. 等待自動驗證（manifest / permissions / 程式碼掃描）

### Step 2: 填寫商店資訊

#### 主要分頁（Store listing）

| 欄位 | 內容來源 |
|---|---|
| 名稱（Title） | `TabOrganizer` |
| 摘要（Summary） | 從 `store-listing/short-description.txt` 對應語言複製（≤132 字） |
| 描述（Description） | 從 `store-listing/description.<lang>.txt` 複製 |
| 類別（Category） | **Productivity** |
| 語言 | 至少設定主要語言（建議：繁中 zh_TW + 英文 en） |
| 圖示（Icon） | 上傳 `icons/icon-128.png` |
| 螢幕截圖 | 依 `store-listing/screenshot-checklist.md` 拍 5 張 1280×800 |
| Promo tile（小） | 440×280（**必填**，可後製） |
| Marquee（大） | 1400×560（選填） |

#### 隱私分頁（Privacy）

| 欄位 | 內容 |
|---|---|
| Permission justification | 對每個權限填用途（從本檔 `permission justifications` 區複製） |
| Data usage | 勾選「**不蒐集任何資料**」 |
| 隱私政策 URL | 您的 `PRIVACY.md` 公開連結 |

#### 發布（Distribution）

| 欄位 | 內容 |
|---|---|
| 可見度 | **Public** |
| 地區 | All regions（建議） |
| 定價 | Free |

### Step 3: 提交審核

1. 點「**提交審查**」
2. 一般審核需 **1-3 個工作天**，新開發者第一次可能需要 7-14 天
3. 通過後自動上架；如被退件會收到 email 說明原因

## Permission Justifications（複製貼上用）

填到 devconsole 的「Permission justification」欄位：

### tabs

```
Required to enumerate, switch, and close browser tabs during the one-click organize workflow. Tabs are accessed only when user clicks the Organize button—never in the background.
```

### activeTab

```
Required for chrome.tabs.captureVisibleTab API, which takes a snapshot of the currently active tab during organize.
```

### downloads

```
Required to save full-resolution snapshot images (JPEG) to the user's Downloads folder under TabOrganizer/<domain>/.
```

### storage

```
Used to persist user preferences (language, dark mode, organize settings, revalidation interval) and organize-in-progress flag.
```

### alarms

```
Schedules background revalidation tasks (default weekly) to re-check whether archived links are still alive.
```

### tabGroups

```
Reserved for future feature: import existing Chrome Tab Groups as categorization source. Currently declared but not actively used.
```

### host_permissions: <all_urls>

```
Required for two reasons: (1) chrome.tabs.captureVisibleTab needs host permission for any URL the user wants to snapshot; (2) HEAD requests to check 404 / dead links also need host permission. No user data is sent anywhere—HEAD requests only check HTTP status. No cookies are read or transmitted to external parties.
```

## 隱私政策 — Data usage 勾選

進 devconsole 的 **Privacy practices** 頁面，依下表勾選：

| 問題 | 答案 |
|---|---|
| Collect user data? | **No** |
| Personally identifiable info? | No |
| Health info? | No |
| Financial info? | No |
| Authentication info? | No |
| Personal communications? | No |
| Location? | No |
| Web history? | No |
| User activity? | No |
| Website content? | No（即使會 capture 螢幕，所有資料僅存於使用者本機） |

**聲明文字**（複製到對應欄位）：
```
TabOrganizer does not collect, transmit, or share any user data with any external server. All data (categories, snapshots, archives) is stored exclusively in the user's local browser IndexedDB and Downloads folder.
```

## 審核常見退件原因 & 對策

| 原因 | 對策 |
|---|---|
| 權限過多未說明 | 我們的權限都有 justification，照上面複製即可 |
| 隱私政策 URL 404 | 確認 PRIVACY.md 在 GitHub main 分支可公開存取 |
| 截圖數量不足或低品質 | 至少 1 張（建議 5 張）1280×800 高品質截圖 |
| 描述與功能不符 | 確認 description 內容真實對應實際功能 |
| Manifest 權限與 justification 不一致 | 已逐項對應，無問題 |

## 更新已上架版本

每次發新版本：

1. 更新 `package.json` 的 `version`（如 0.1.0 → 0.1.1）
2. 更新 `manifest.config.ts`（自動讀 package.json）
3. `npm run package` → 產生新 zip
4. devconsole → 您的擴充功能 → 「Package」分頁 → 上傳新 zip
5. 更新 CHANGELOG 與 description 如有變動
6. 提交審核（通常更新版本審核較快）

## 參考連結

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Publishing a Chrome Extension](https://developer.chrome.com/docs/webstore/publish/)
- [Permission justifications guide](https://developer.chrome.com/docs/webstore/troubleshooting/#violations)
- [Store listing best practices](https://developer.chrome.com/docs/webstore/best_practices/)
