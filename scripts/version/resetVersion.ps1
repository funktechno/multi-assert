# resetVersion.ps1
# Puts package.json "version" back to the 0.1.0 baseline it is committed with. version-*.txt is
# left alone. Windows twin of resetVersion.sh.
#
# Usage: .\scripts\version\resetVersion.ps1
$ErrorActionPreference = "Stop"
$baseline = "0.1.0"
& "$PSScriptRoot/updateVersion.ps1" -Version $baseline
Write-Host "Version reset complete (baseline $baseline)."
