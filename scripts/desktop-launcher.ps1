# TabOrganizer desktop launcher
#
# Pre-requisite: extension must be permanently installed in the user's
# daily Chrome (one-time setup via chrome://extensions -> Load unpacked).
# Since Chrome 137+ restricts --load-extension command-line flag,
# permanent installation is the only reliable way.
#
# After install (extension ID is fixed via manifest "key" field), this
# launcher just opens chrome.exe --app=chrome-extension://[id]/... so
# the manager appears as a standalone app window in the user's daily
# Chrome -- no separate profile, no extension reloading.

$EXT_ID = 'eanilmbkohdgpndehpbikchfpnaboloh'
$MGR    = "chrome-extension://$EXT_ID/src/manager/manager.html"
$DIST   = 'D:\Desktop\AI\MiniPrograms\TabOrganizer\dist'

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

# Check if extension is installed in user's default Chrome profile
$prefPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
$installed = $false
if (Test-Path $prefPath) {
    try {
        $json = Get-Content $prefPath -Raw -Encoding UTF8
        $installed = $json -match [Regex]::Escape("`"$EXT_ID`"")
    } catch {}
}

if ($installed) {
    # Open manager as app window
    Start-Process $chrome "--app=`"$MGR`""
    exit 0
}

# Not installed -- show one-time setup instructions
Add-Type -AssemblyName PresentationFramework
Start-Process $chrome 'chrome://extensions/'
Start-Sleep -Milliseconds 500
explorer $DIST

$msg = @"
First-time setup (only needed ONCE):

1. In chrome://extensions, enable "Developer mode" (top-right).
2. Drag the dist folder onto the extensions page.
   (Or click "Load unpacked" and select dist.)
3. Confirm the extension ID matches:
       $EXT_ID
4. Close this dialog. Double-click TabOrganizer again -- the
   manager will open directly in app-window mode.

Why one-time install:
Chrome 137+ disables the --load-extension command-line flag for
security. Permanent installation via chrome://extensions is the
only reliable way to keep an unpacked extension across launches.
"@

[System.Windows.MessageBox]::Show(
    $msg, 'TabOrganizer first-time setup', 'OK', 'Information'
) | Out-Null
