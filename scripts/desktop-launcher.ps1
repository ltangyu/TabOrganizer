# TabOrganizer desktop launcher -- zero-setup, loader-mediated
#
# Strategy:
#   1. Launch Chrome with --user-data-dir + --load-extension + --app=loader.html
#   2. loader.html shows a TabOrganizer splash, polls until extension's
#      service worker is ready, then replaces location with the manager URL.
#   3. Single Chrome window from start to finish, no flicker, no error page.

$EXT_ID  = 'eanilmbkohdgpndehpbikchfpnaboloh'
$DIST    = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'
$LOADER  = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\scripts\loader.html'
$PROFILE = "$env:LOCALAPPDATA\TabOrganizer\ChromeProfile"

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

# Persistent profile so data survives across launches
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType Directory -Path $PROFILE -Force | Out-Null
}

# Convert local loader path to file:// URL
$loaderUri = (New-Object System.Uri($LOADER)).AbsoluteUri

Start-Process $chrome @(
    "--user-data-dir=`"$PROFILE`"",
    "--load-extension=`"$DIST`"",
    '--no-first-run',
    '--no-default-browser-check',
    "--app=`"$loaderUri`""
)
