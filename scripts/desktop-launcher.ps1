# TabOrganizer desktop launcher (Chinese guide via HTML, no PS encoding issue)
#
# Behavior:
#   - If extension is permanently installed in Default profile:
#       opens manager as --app window in user's daily Chrome.
#   - Otherwise:
#       opens chrome://extensions + install-guide.html (Chinese) in
#       new tabs of user's daily Chrome + dist folder in Explorer.

$EXT_ID = 'eanilmbkohdgpndehpbikchfpnaboloh'
$MGR    = "chrome-extension://$EXT_ID/src/manager/manager.html"
$DIST   = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'
$GUIDE  = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\scripts\install-guide.html'

$chrome = $null
foreach ($p in @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)) {
    if (Test-Path $p) { $chrome = $p; break }
}
if (-not $chrome) { exit 1 }

# Detect install
$installed = $false
$prefPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
if (Test-Path $prefPath) {
    try {
        $json = Get-Content $prefPath -Raw -Encoding UTF8
        $installed = $json -match [Regex]::Escape("`"$EXT_ID`"")
    } catch {}
}

if ($installed) {
    # Permanent install detected -- open manager as app window
    Start-Process $chrome "--app=`"$MGR`""
    exit 0
}

# Not installed: open extensions page + Chinese install guide + dist folder
$guideUri = (New-Object System.Uri($GUIDE)).AbsoluteUri
Start-Process $chrome 'chrome://extensions/'
Start-Sleep -Milliseconds 400
Start-Process $chrome $guideUri
Start-Sleep -Milliseconds 400
explorer $DIST
