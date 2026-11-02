#!/usr/bin/env bash
set -euo pipefail

# generateVersion.sh - Generate version metadata using GitVersion.
# Writes version-<SEMVER>.txt in the repo root for updateVersion.sh to consume.
#
# Resolution order for the GitVersion binary:
#   1. $GITVERSION_BIN (set by CI after `dotnet tool install GitVersion.Tool`)
#   2. `gitversion` / `dotnet-gitversion` on PATH
#   3. Docker image (local dev convenience)
# Requirements: jq. GitVersion needs full history — use `fetch-depth: 0` in CI checkout.
#
# Ported from choredock.
# Usage: ./scripts/version/generateVersion.sh (run from repo root, or anywhere — cd's to repo root)

GITVERSION_IMAGE="gittools/gitversion:6.3.0"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

clean_up() {
  [[ -n "${TMP_FILE:-}" && -f "$TMP_FILE" ]] && rm -f "$TMP_FILE"
}
trap clean_up EXIT

echo "Fetching tags..."
git fetch --tags || echo "warning: could not fetch tags (offline?)"

TMP_FILE=$(mktemp)

# "$REPO" is passed as GitVersion's target path rather than relying on the working directory.
# Without it this script fails with "Cannot find the .git directory" when run from Git Bash on
# Windows - the shell's cwd is an MSYS path the native tool does not resolve back to the repo.
# Harmless everywhere else, and it makes the three branches below match the Docker one.
if [[ -n "${GITVERSION_BIN:-}" && -x "${GITVERSION_BIN}" ]]; then
  echo "Running GitVersion (tool): $GITVERSION_BIN"
  "$GITVERSION_BIN" "$REPO" /output json > "$TMP_FILE"
elif command -v dotnet-gitversion >/dev/null 2>&1; then
  echo "Running GitVersion (dotnet tool: dotnet-gitversion)"
  dotnet-gitversion "$REPO" /output json > "$TMP_FILE"
elif command -v gitversion >/dev/null 2>&1; then
  echo "Running GitVersion (local)"
  gitversion "$REPO" /output json > "$TMP_FILE"
elif command -v docker >/dev/null 2>&1; then
  echo "Running GitVersion (Docker): $GITVERSION_IMAGE"
  docker run --rm -v "$(pwd):/repo" "$GITVERSION_IMAGE" /repo /output json > "$TMP_FILE"
else
  echo "Error: GITVERSION_BIN, gitversion/dotnet-gitversion, or Docker is required to run GitVersion." >&2
  exit 1
fi

# jq is PREFERRED but NOT REQUIRED. It used to be required, which meant every CI run had to
# `apt-get install -y jq` first - and that is a network call to the Ubuntu archive on the critical
# path of the very first job in the pipeline. It failed exactly that way ("Failed to fetch
# .../libonig5_6.9.9-1build1_amd64.deb  Connection failed", exit 100) after spending three minutes
# on apt, taking the whole pipeline down over a dependency of a dependency of a JSON parser.
#
# GitVersion's JSON is a flat object of scalars, one "Key": value per line, so a sed extractor
# handles it completely. jq is still used when present (it is the correct tool, and it is there on
# most dev machines); the fallback exists so no CI job has to install anything to read a version.
if command -v jq >/dev/null 2>&1; then
  json_get() { jq -r --arg k "$1" '.[$k] // empty' "$TMP_FILE"; }
else
  echo "jq not found - using the built-in line parser."
  json_get() {
    local value
    # Matches   "Key": "string",   and   "Key": 28,   and   "Key": null,
    # capturing the quoted body (\2) or the bare token (\3); exactly one of the two is ever set.
    value=$(sed -n -E "s/^[[:space:]]*\"$1\"[[:space:]]*:[[:space:]]*(\"(.*)\"|([^,]*)),?[[:space:]]*$/\2\3/p" "$TMP_FILE" | head -n1)
    # JSON null is absence, not the four-character string - match jq's `// empty`.
    if [[ "$value" == "null" ]]; then value=""; fi
    printf '%s' "$value"
  }
fi

SEMVER=$(json_get SemVer)
FULL_SEMVER=$(json_get FullSemVer)
MAJOR_MINOR_PATCH=$(json_get MajorMinorPatch)
GIT_HASH=$(json_get Sha)
GIT_TAG=$(json_get PreReleaseTag)
GIT_BRANCH=$(json_get BranchName)
COMMIT_COUNT=$(json_get CommitsSinceVersionSource)
COMMIT_COUNT=${COMMIT_COUNT:-0}

# Fallbacks
SEMVER=${SEMVER:-"0.0.0"}
FULL_SEMVER=${FULL_SEMVER:-"0.0.0+0"}
MAJOR_MINOR_PATCH=${MAJOR_MINOR_PATCH:-"0.0.0"}

# Replace 'PullRequest'/'pr' labels with 'Patch' in SemVer so PR builds still produce a usable version.
VERSION=${SEMVER//PullRequest/Patch}

BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Remove any existing version-*.txt files in repo root
rm -f "$REPO"/version-*.txt || true

VERSION_FILE="$REPO/version-$VERSION.txt"
cat > "$VERSION_FILE" <<EOF
version=$VERSION
major_minor_patch=$MAJOR_MINOR_PATCH
full_semver=$FULL_SEMVER
git_hash=$GIT_HASH
git_tag=$GIT_TAG
git_branch=$GIT_BRANCH
commit_count=$COMMIT_COUNT
build_date=$BUILD_DATE
EOF

echo "Generated version: $VERSION"
echo "Major minor patch: $MAJOR_MINOR_PATCH"
echo "Full semver: $FULL_SEMVER"
echo "Git hash: $GIT_HASH"
echo "Git tag: $GIT_TAG"
echo "Git branch: $GIT_BRANCH"
echo "Commit count: $COMMIT_COUNT"
echo "Build date: $BUILD_DATE"
echo ""
echo "$VERSION_FILE content:"
cat "$VERSION_FILE"

echo "Done."
