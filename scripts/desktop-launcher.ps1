# TabOrganizer 智能桌面啟動器
# 1. 偵測 extension 是否已裝到日常 Chrome
# 2. 若已裝：直接 --app 模式開啟管理頁
# 3. 若未裝：自動載入到 default profile（永久安裝）+ 開啟管理頁
#
# 第一次執行會自動安裝；之後每次執行只需開啟管理頁。

$EXT_ID = "eanilmbkohdgpndehpbikchfpnaboloh"
$DIST = "D:\Desktop\AI\MiniPrograms\TabOrganizer\dist"
$MANAGER_URL = "chrome-extension://$EXT_ID/src/manager/manager.html"

# 找 Chrome
$chrome = $null
foreach ($p in @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)) {
  if (Test-Path $p) { $chrome = $p; break }
}
if (-not $chrome) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show('找不到 Chrome。請先安裝 Google Chrome。', 'TabOrganizer', 'OK', 'Error') | Out-Null
  exit 1
}

# 檢查日常 Chrome 的 Default profile 是否已安裝此 extension
$prefPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
$installed = $false
if (Test-Path $prefPath) {
  try {
    $prefsJson = Get-Content $prefPath -Raw -Encoding UTF8
    # 簡單字串匹配比 JSON parse 快且不依賴 schema
    if ($prefsJson -match "`"$EXT_ID`"") {
      $installed = $true
    }
  } catch { }
}

if ($installed) {
  # 已安裝 → 直接 --app 模式開管理頁（無 tab bar、無位址列）
  Start-Process $chrome "--app=`"$MANAGER_URL`""
} else {
  # 首次：用 --load-extension 把 extension 載入到 default profile
  # 加 --no-first-run 避免歡迎流程
  # 第一次成功載入後，Chrome 會記住此 extension（持久安裝）
  # 注意：若日常 Chrome 已開啟，這指令會在現有 Chrome 視窗開新分頁但不會載入 extension
  # → 此情況需要使用者重啟 Chrome 後才會生效

  # 偵測 Chrome 是否在跑
  $chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue
  if ($chromeRunning) {
    # Chrome 已開 → 顯示說明請使用者手動安裝
    Add-Type -AssemblyName PresentationFramework
    $msg = @"
首次設定：請完成一次性安裝。

1. 即將開啟 chrome://extensions 與 dist 資料夾
2. 在 extensions 頁面右上開啟「開發人員模式」
3. 把 dist 資料夾拖到頁面（或點「載入未封裝項目」）
4. 確認 extension ID = $EXT_ID
5. 完成後重新雙擊桌面 TabOrganizer 圖示

只需做這一次，之後每次雙擊都會直接開啟管理頁。
"@
    [System.Windows.MessageBox]::Show($msg, 'TabOrganizer 首次設定', 'OK', 'Information') | Out-Null
    Start-Process $chrome "chrome://extensions/"
    explorer $DIST
  } else {
    # Chrome 未開 → --load-extension 一次性載入並開管理頁
    # 注意：這仍只在本次 session 生效，Chrome 關閉後 extension 會被卸載
    # 需要使用者手動到 chrome://extensions 點「確認」或「保留」才會永久安裝
    Start-Process $chrome @(
      "--load-extension=`"$DIST`"",
      "--no-first-run",
      "--no-default-browser-check",
      "--app=`"$MANAGER_URL`""
    )
    Start-Sleep -Seconds 2
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("已自動載入 extension 並開啟管理頁。`n`n若想永久安裝（之後不用 --load-extension）：`n  到 chrome://extensions/ 找到 TabOrganizer 確認「保留」", 'TabOrganizer', 'OK', 'Information') | Out-Null
  }
}
