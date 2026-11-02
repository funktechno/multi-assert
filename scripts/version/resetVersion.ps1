# resetVersion.ps1
# Puts package.json "version" back to the 1.0.0 baseline it is committed with. version-*.txt is
# left alone. Windows twin of resetVersion.sh.
#
# Usage: .\scripts\version\resetVersion.ps1
$ErrorActionPreference = "Stop"
$baseline = "1.0.0"
& "$PSScriptRoot/updateVersion.ps1" -Version $baseline
Write-Host "Version reset complete (baseline $baseline)."
