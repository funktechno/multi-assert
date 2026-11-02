# updateVersion.ps1
# Windows twin of updateVersion.sh: reads version-*.txt (written by generateVersion.ps1 / .sh) and
# stamps its `version=` onto package.json "version". Without a version-*.txt it stamps 0.0.0.
#
# Usage (any directory): .\scripts\version\updateVersion.ps1
#                        .\scripts\version\updateVersion.ps1 -Version 0.2.0   # explicit version
param(
    [string] $Version = ""
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot/../..").Path
$PackageJson = Join-Path $repo "package.json"

$stamp = "0.0.0"
$versionFile = Get-ChildItem -Path $repo -Filter "version-*.txt" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($versionFile) {
    Write-Host "Reading version info from $($versionFile.Name)"
    $line = Get-Content $versionFile.FullName | Where-Object { $_ -match '^version=' } | Select-Object -First 1
    if ($line) { $stamp = $line -replace '^version=', '' }
} else {
    Write-Host "No version-*.txt found. Using fallback 0.0.0."
}

if ($Version) {
    $Version = $Version -replace '^v', ''
    Write-Host "Version overridden: $stamp -> $Version"
    $stamp = $Version
}

if ($stamp -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') {
    throw "'$stamp' is not a valid semver version"
}
if (-not (Test-Path $PackageJson)) {
    throw "package.json not found: $PackageJson"
}

# Targeted replace of the first "version" key (a ConvertTo-Json round trip would reorder keys).
# Instance .Replace(input, replacement, count), NOT the static [regex]::Replace, whose trailing
# `1` would bind to RegexOptions and rewrite every "version" key.
$raw = Get-Content $PackageJson -Raw
$rx = [regex]'("version"\s*:\s*")[^"]*(")'
if (-not $rx.IsMatch($raw)) {
    throw "no `"version`" key found in $PackageJson"
}
$updated = $rx.Replace($raw, ('${1}' + $stamp + '${2}'), 1)
Set-Content -Path $PackageJson -Value $updated -NoNewline

Write-Host "Updated ${PackageJson}: version=$stamp"
Select-String -Path $PackageJson -Pattern '"version":' | Select-Object -First 1
Write-Host "Version update complete."
