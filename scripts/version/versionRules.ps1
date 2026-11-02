# versionRules.ps1 - PowerShell twin of versionRules.sh (the version-string rules); dot-source it, don't run it.
#
#   Get-VersionRules -Branch <name> -MajorMinorPatch <GitVersion's> -Version <...> -FullSemVer <...> -CommitCount <...>
#
# returns MajorMinorPatch, Version, FullSemVer and CommitCount after the rules (see versionRules.sh for them and the reasons):
#   main/master   MAJOR.MINOR.(tag patch + merge requests merged into main since the tag, min 1)   0.6.56; the tagged commit is the tag
#   anything else <that number>-<commits on the branch since main's newest merge>                  0.6.56-3 (no suffix for 0, or for main's tree)

# GitHub's merge commit for a pull request (doi matches GitLab's "into 'main'" here instead).
$MainMergeGrep = "^Merge pull request #"

function Get-NewestStableTag([string]$Ref) {
    git tag --merged $Ref --sort=-v:refname | Where-Object { $_ -match '^v?\d+\.\d+\.\d+$' } | Select-Object -First 1
}

function Get-ReleaseLineVersion([string]$Ref) {
    $tag = Get-NewestStableTag $Ref
    if (-not $tag) { return $null }
    if ((git rev-parse "$tag^{commit}") -eq (git rev-parse "$Ref^{commit}")) { return $tag.TrimStart('v') }
    $parts = $tag.TrimStart('v').Split('.')
    $merges = [int](git rev-list --count --merges "--grep=$MainMergeGrep" "$tag..$Ref")
    if ($merges -lt 1) { $merges = 1 }
    return "$($parts[0]).$($parts[1]).$([int]$parts[2] + $merges)"
}

function Get-BranchCommits([string]$Ref) {
    $last = git rev-list -1 --merges "--grep=$MainMergeGrep" $Ref
    if (-not $last) { $last = Get-NewestStableTag $Ref }
    if (-not $last) { return 0 }
    git diff --quiet $last $Ref -- 2>$null
    if ($LASTEXITCODE -eq 0) { return 0 }
    return [int](git rev-list --count --no-merges "$last..$Ref")
}

function Get-VersionRules([string]$Branch, [string]$MajorMinorPatch, [string]$Version, [string]$FullSemVer, $CommitCount) {
    $result = [ordered]@{ MajorMinorPatch = $MajorMinorPatch; Version = $Version; FullSemVer = $FullSemVer; CommitCount = $CommitCount }
    $base = Get-ReleaseLineVersion 'HEAD'
    if (-not $base) { return $result }
    $result.MajorMinorPatch = $base
    # A commit that carries a stable tag IS that tag, whatever the branch is called (a tag run's branch is the tag's name).
    $tagged = git tag --points-at HEAD | Where-Object { $_ -match '^v?\d+\.\d+\.\d+$' } | Select-Object -First 1
    if ($Branch -in @('main', 'master') -or $tagged) {
        $result.Version = $base
        $result.FullSemVer = $base
        $result.CommitCount = 0
    }
    else {
        $ahead = Get-BranchCommits 'HEAD'
        $result.Version = if ($ahead -eq 0) { $base } else { "$base-$ahead" }
        $result.CommitCount = $ahead
    }
    return $result
}
