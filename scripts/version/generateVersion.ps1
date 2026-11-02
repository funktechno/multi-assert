# generateVersion.ps1 - Generate version metadata using GitVersion.
# Writes version-<SEMVER>.txt in the repo root for updateVersion.ps1 to consume.
#
# Windows twin of generateVersion.sh - same output file, same keys, so either script can feed
# either updateVersion. The .sh runs on the Linux CI runner (it needs jq to parse GitVersion's
# JSON); this one runs on Windows and on a developer machine, where ConvertFrom-Json is built in.
#
# Resolution order for the GitVersion binary:
#   1. $env:GITVERSION_BIN (set by CI after `dotnet tool install GitVersion.Tool`)
#   2. `dotnet-gitversion` / `gitversion` on PATH (dotnet tool install --global GitVersion.Tool)
#   3. Docker image (local dev convenience)
# GitVersion needs full history + tags - a shallow clone gives wrong (or zero) commit counts, which
# is why the CI job sets GIT_DEPTH: "0".
#
# Ported from choredock.
# Usage: .\scripts\version\generateVersion.ps1
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot/../..").Path
Push-Location $repo
try {
    Write-Host "Fetching tags..."
    git fetch --tags

    # $repo is passed as GitVersion's target path rather than relying on the working directory -
    # same as generateVersion.sh, where omitting it breaks the Git Bash case outright.
    if ($env:GITVERSION_BIN -and (Test-Path $env:GITVERSION_BIN)) {
        Write-Host "Running GitVersion (tool): $env:GITVERSION_BIN"
        $gitVersionJson = & $env:GITVERSION_BIN $repo /output json
    }
    elseif (Get-Command dotnet-gitversion -ErrorAction SilentlyContinue) {
        Write-Host "Running GitVersion (dotnet tool: dotnet-gitversion)"
        $gitVersionJson = dotnet-gitversion $repo /output json
    }
    elseif (Get-Command gitversion -ErrorAction SilentlyContinue) {
        Write-Host "Running GitVersion (local)"
        $gitVersionJson = gitversion $repo /output json
    }
    else {
        Write-Host "Running GitVersion (Docker): gittools/gitversion:6.3.0"
        $gitVersionJson = docker run --rm -v "${repo}:/repo" gittools/gitversion:6.3.0 /repo /output json
    }

    $versionData = $gitVersionJson | ConvertFrom-Json

    # Remove any existing version-*.txt files in the repo root
    Get-ChildItem -Path $repo -Filter "version-*.txt" -ErrorAction SilentlyContinue | Remove-Item -Force

    # Replace 'PullRequest'/'pr' labels with 'Patch' in SemVer so PR builds still produce a usable
    # version - GitVersion.yml labels MR builds `pr<Number>`, which is not a valid file-name-safe
    # or assembly-version-safe token everywhere it gets used downstream.
    $VERSION = $versionData.SemVer -replace 'PullRequest', 'Patch' -replace '(?i)^(\d+\.\d+\.\d+)-pr', '$1-Patch'
    $FULL_SEMVER = $versionData.FullSemVer
    $MAJOR_MINOR_PATCH = $versionData.MajorMinorPatch
    $GIT_HASH = $versionData.Sha
    $GIT_TAG = $versionData.PreReleaseTag
    $GIT_BRANCH = $versionData.BranchName
    $COMMIT_COUNT = $versionData.CommitsSinceVersionSource
    $BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $versionFile = Join-Path $repo "version-$VERSION.txt"
    @"
version=$VERSION
major_minor_patch=$MAJOR_MINOR_PATCH
full_semver=$FULL_SEMVER
git_hash=$GIT_HASH
git_tag=$GIT_TAG
git_branch=$GIT_BRANCH
commit_count=$COMMIT_COUNT
build_date=$BUILD_DATE
"@ | Set-Content $versionFile

    Write-Host "Generated version: $VERSION"
    Write-Host "Major minor patch: $MAJOR_MINOR_PATCH"
    Write-Host "Full semver: $FULL_SEMVER"
    Write-Host "Git hash: $GIT_HASH"
    Write-Host "Git branch: $GIT_BRANCH"
    Write-Host "Commit count: $COMMIT_COUNT"
    Write-Host "Build date: $BUILD_DATE"
    Write-Host "$versionFile content:"
    Get-Content $versionFile
}
finally {
    Pop-Location
}
