# TabOrganizer desktop launcher -- zero-setup, service-worker-driven
#
# Strategy:
#   1. Launch Chrome with --user-data-dir + --load-extension (no --app).
#   2. Chrome starts normally with a default new-tab window.
#   3. Extension's service worker fires chrome.runtime.onStartup, which
#      creates a popup-type window pointing at the manager, and closes
#      the default new-tab window.
#   4. User ends up with a single app-style window (no tabs, no address
#      bar), driven entirely by the extension itself -- no file:// or
#      --app= URLs that Chrome's security model rejects.

$EXT_ID  = 'eanilmbkohdgpndehpbikchfpnaboloh'
$DIST    = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'
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

# Persistent profile dir
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType Directory -Path $PROFILE -Force | Out-Null
}

# Launch: load extension; service worker opens manager popup + closes
# the default Chrome window for an app-like single-window experience.
Start-Process $chrome @(
    "--user-data-dir=`"$PROFILE`"",
    "--load-extension=`"$DIST`"",
    '--no-first-run',
    '--no-default-browser-check'
)
