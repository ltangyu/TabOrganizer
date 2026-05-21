# TabOrganizer desktop launcher -- zero-setup version
#
# Always launches Chrome with:
#   --user-data-dir = persistent dedicated profile (so data survives across launches)
#   --load-extension = auto-loads TabOrganizer every launch
#   --app = opens manager directly in app-window mode (no tabs, no address bar)
#
# Pros: zero manual setup, works from the first double-click.
# Trade-off: organize/snapshot operates on tabs inside THIS Chrome window,
#            not the user's daily Chrome.

$EXT_ID  = 'eanilmbkohdgpndehpbikchfpnaboloh'
$DIST    = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'
$PROFILE = "$env:LOCALAPPDATA\TabOrganizer\ChromeProfile"
$MGR     = "chrome-extension://$EXT_ID/src/manager/manager.html"

# Find Chrome
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
    [System.Windows.MessageBox]::Show(
        'Chrome not found. Please install Google Chrome first.',
        'TabOrganizer', 'OK', 'Error'
    ) | Out-Null
    exit 1
}

# Ensure persistent profile dir exists
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType Directory -Path $PROFILE -Force | Out-Null
}

# Launch: dedicated profile + auto-load extension + open manager in app mode
Start-Process $chrome @(
    "--user-data-dir=`"$PROFILE`"",
    "--load-extension=`"$DIST`"",
    '--no-first-run',
    '--no-default-browser-check',
    "--app=`"$MGR`""
)
