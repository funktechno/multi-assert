#!/usr/bin/env bash
# versionRules.sh - the one place the version-string rules live. Source it; don't run it.
#
# Sourced by generateVersion.sh (generateVersion.ps1 mirrors it), which every pipeline runs (GitLab's `test`, GitHub's `version` job), so a
# pipeline and a local run produce the same string. Modelled on cellhasher's scripts/version/versionRules.sh, whose `dev` line is our `main`.
#
#   apply_version_rules <branch>
#
# Reads and updates MAJOR_MINOR_PATCH, VERSION, FULL_SEMVER and COMMIT_COUNT, which the caller has already set from GitVersion:
#
#   main/master   MAJOR.MINOR.(tag patch + merge requests merged since the tag, min 1)   tag 0.6.0 + 56 merges -> 0.6.56
#                 (the tagged commit itself is the tag: 0.7.0)
#   a tagged commit  the tag itself (whatever the branch is called: a tag run's "branch" is the tag's name)
#   anything else <that number where the branch left main>-<commits on the branch>        0.6.56, 3 commits -> 0.6.56-3
#                 (0 commits, or a tree identical to main's, drops the suffix: the build IS main's version)
#
# MAJOR and MINOR come from the newest X.Y.Z tag (tag 0.7.0 to start 0.7.x). "Merge requests merged" are the merge commits GitLab writes into
# main ("Merge branch '<name>' into 'main'"), counted wherever they are reachable rather than along the first parent: GitHub (lastlink/pocket_dai,
# a mirror kept by sync pull requests) has the same commits but its own first-parent history, and must print the same number for the same code.
# COMMIT_COUNT becomes the branch's commit count (0 on main), the fourth part of AssemblyVersion and the "-N" of InformationalVersion.
#
# Needs full history and the tags (GIT_DEPTH 0 on GitLab, fetch-depth 0 on GitHub; generateVersion.sh runs `git fetch --tags`). Without a tag
# the rules leave GitVersion's values alone.

# The merge commit GitHub writes when a pull request lands on main ("Merge pull request #9 from ..."). doi matches GitLab's "into 'main'" here instead.
MAIN_MERGE_GREP="^Merge pull request #"

# release_line_version <ref>: the main line's number at <ref>: the newest stable X.Y.Z tag reachable from it, patch + main merges since that tag
# (min 1); <ref> being the tagged commit prints the tag. Prints nothing without a tag.
release_line_version() {
  local ref="$1" base_tag tag_major tag_minor tag_patch merges
  base_tag=$(git tag --merged "$ref" --sort=-v:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)
  [ -n "$base_tag" ] || return 0
  if [ "$(git rev-parse "$base_tag^{commit}")" = "$(git rev-parse "$ref^{commit}")" ]; then
    echo "${base_tag#v}"
    return 0
  fi
  IFS=. read -r tag_major tag_minor tag_patch <<< "${base_tag#v}"
  merges=$(git rev-list --count --merges --grep="$MAIN_MERGE_GREP" "$base_tag..$ref")
  if [ "$merges" -lt 1 ]; then merges=1; fi
  echo "$tag_major.$tag_minor.$((tag_patch + merges))"
}

# branch_commits <ref>: commits on a branch since main's newest merge (or the tag) reachable from it, merges not counted; 0 when the tree is the
# same as at that merge (a GitHub sync branch: GitHub's own commits, same code).
branch_commits() {
  local ref="$1" last
  last=$(git rev-list -1 --merges --grep="$MAIN_MERGE_GREP" "$ref" || true)
  if [ -z "$last" ]; then
    last=$(git tag --merged "$ref" --sort=-v:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)
  fi
  [ -n "$last" ] || { echo 0; return 0; }
  if git diff --quiet "$last" "$ref" -- 2>/dev/null; then echo 0; return 0; fi
  git rev-list --count --no-merges "$last..$ref"
}

apply_version_rules() {
  local branch="${1:-}" base ahead
  base=$(release_line_version HEAD)
  [ -n "$base" ] || return 0
  MAJOR_MINOR_PATCH="$base"
  # A commit that carries a stable tag IS that tag, whatever the pipeline calls the branch: a tag run passes the tag's name (0.7.0), which would
  # otherwise count commits past the last main merge it can see and print 0.7.0-1.
  if git tag --points-at HEAD | grep -qE '^v?[0-9]+\.[0-9]+\.[0-9]+$'; then branch=main; fi
  case "$branch" in
    main|master)
      VERSION="$base"
      FULL_SEMVER="$base"
      COMMIT_COUNT=0
      ;;
    *)
      ahead=$(branch_commits HEAD)
      VERSION="$base-$ahead"
      VERSION="${VERSION%-0}"
      COMMIT_COUNT="$ahead"
      ;;
  esac
}
