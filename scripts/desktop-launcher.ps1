# TabOrganizer desktop launcher -- two-step launch
#
# Strategy:
#   1. First chrome.exe call: starts Chrome with --user-data-dir and
#      --load-extension. Chrome opens its default new-tab window
#      (about:blank to keep it minimal). Extension registers in this
#      Chrome instance.
#   2. Wait 3 seconds for extension's service worker to be ready.
#   3. Second chrome.exe call: --app=chrome-extension://[id]/manager.html
#      Because --user-data-dir is identical, this attaches to the same
#      Chrome instance and opens a new --app window (no tabs, no address
#      bar).
#   4. Optional: send Ctrl+W to the initial about:blank tab to close it.
#
# This approach avoids the race between Chrome resolving the --app URL
# and --load-extension finishing registration.

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

# Persistent profile dir
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType Directory -Path $PROFILE -Force | Out-Null
}

# Detect if a Chrome instance using this profile is already running.
# If so, don't restart it; just open the app window directly.
$alreadyRunning = $false
$profileLockFile = Join-Path $PROFILE 'SingletonLock'
if (Test-Path $profileLockFile) {
    $alreadyRunning = $true
}

if (-not $alreadyRunning) {
    # Step 1: launch Chrome to register the extension
    Start-Process $chrome @(
        "--user-data-dir=`"$PROFILE`"",
        "--load-extension=`"$DIST`"",
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=400,300',
        'about:blank'
    )
    # Step 2: wait for service worker registration
    Start-Sleep -Seconds 3
}

# Step 3: open manager URL in --app mode (no tabs, no address bar).
# Same user-data-dir means this attaches to the existing Chrome instance
# and opens a new window inside it.
Start-Process $chrome @(
    "--user-data-dir=`"$PROFILE`"",
    "--app=`"$MGR`""
)
