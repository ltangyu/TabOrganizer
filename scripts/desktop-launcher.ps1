# TabOrganizer smart desktop launcher (ASCII-only to avoid PS encoding issues)
#
# 1. Detects if the extension is already permanently installed in the
#    user's daily Chrome Default profile.
# 2. If installed: opens manager directly in --app mode (no Chrome UI).
# 3. If not installed: launches a Chrome instance with --load-extension
#    + --app pointing at the manager URL, so user gets immediate access.
#    User can later click "Keep" on chrome://extensions to make it
#    permanent in their Default profile.

$EXT_ID = 'eanilmbkohdgpndehpbikchfpnaboloh'
$DIST   = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'
$MGR    = "chrome-extension://$EXT_ID/src/manager/manager.html"

function Find-Chrome {
    foreach ($p in @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
    )) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function Test-ExtInstalled {
    param([string]$ExtId)
    $pref = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
    if (-not (Test-Path $pref)) { return $false }
    try {
        $json = Get-Content $pref -Raw -Encoding UTF8
        return $json -match [Regex]::Escape("`"$ExtId`"")
    } catch {
        return $false
    }
}

$chrome = Find-Chrome
if (-not $chrome) {
    [System.Windows.MessageBox]::Show('Chrome not found. Please install Google Chrome first.', 'TabOrganizer', 'OK', 'Error') | Out-Null
    exit 1
}

if (Test-ExtInstalled $EXT_ID) {
    # Installed: open manager directly in app-window mode
    Start-Process $chrome "--app=`"$MGR`""
    exit 0
}

# Not installed yet -- decide flow based on Chrome already running or not
$chromeRunning = Get-Process chrome -ErrorAction SilentlyContinue

if ($chromeRunning) {
    # Chrome is open -- can't safely --load-extension into running instance.
    # Open extensions page + dist folder, then show guidance.
    Add-Type -AssemblyName PresentationFramework
    Start-Process $chrome 'chrome://extensions/'
    Start-Sleep -Milliseconds 400
    explorer $DIST
    $msg = @"
First-time setup (only needed once):

1. The chrome://extensions tab is now open in your Chrome
2. The dist folder is now open in File Explorer
3. In the extensions page, enable "Developer mode" (top-right)
4. Drag the dist folder onto the extensions page
   (or click "Load unpacked" and select dist)
5. Confirm the extension ID matches:
       $EXT_ID

After this one-time install, every future double-click of the
TabOrganizer desktop icon will open the manager directly in an
app-style window inside your daily Chrome.
"@
    [System.Windows.MessageBox]::Show($msg, 'TabOrganizer first-time setup', 'OK', 'Information') | Out-Null
    exit 0
}

# Chrome not running -- launch Chrome with --load-extension + --app for
# immediate use. Extension will be loaded for this session; user can
# click "Keep" in chrome://extensions to make it permanent.
Start-Process $chrome @(
    "--load-extension=`"$DIST`"",
    '--no-first-run',
    '--no-default-browser-check',
    "--app=`"$MGR`""
)
Start-Sleep -Seconds 2
Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
    "TabOrganizer manager is now open.`n`nFor permanent install (skip --load-extension next time):`nGo to chrome://extensions and click `"Keep`" on the TabOrganizer card.",
    'TabOrganizer',
    'OK',
    'Information'
) | Out-Null
