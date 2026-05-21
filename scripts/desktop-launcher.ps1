# TabOrganizer desktop launcher
#
# Detection: Chrome MV3 stores extension metadata in BOTH Preferences and
# Secure Preferences. We must check both (Secure Preferences is the
# primary store for unpacked extensions in modern Chrome).

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

# Detect install across all standard profiles and both pref files
function Test-ExtInstalled {
    param([string]$ExtId)
    $base = "$env:LOCALAPPDATA\Google\Chrome\User Data"
    if (-not (Test-Path $base)) { return $false }

    $profiles = Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^(Default|Profile \d+)$' }

    foreach ($prof in $profiles) {
        foreach ($fileName in @('Preferences', 'Secure Preferences')) {
            $f = Join-Path $prof.FullName $fileName
            if (Test-Path $f) {
                try {
                    $content = Get-Content $f -Raw -Encoding UTF8
                    if ($content -match [Regex]::Escape($ExtId)) {
                        return $true
                    }
                } catch {}
            }
        }
    }
    return $false
}

if (Test-ExtInstalled $EXT_ID) {
    # Open manager as app window in user's daily Chrome
    Start-Process $chrome "--app=`"$MGR`""
    exit 0
}

# Not installed -- open extensions page + Chinese guide + dist folder
$guideUri = (New-Object System.Uri($GUIDE)).AbsoluteUri
Start-Process $chrome 'chrome://extensions/'
Start-Sleep -Milliseconds 400
Start-Process $chrome $guideUri
Start-Sleep -Milliseconds 400
explorer $DIST
