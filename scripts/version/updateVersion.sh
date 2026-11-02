#!/usr/bin/env bash
set -euo pipefail

# updateVersion.sh
# Reads version-*.txt (written by generateVersion.sh / .ps1) and stamps its `version=` onto
# package.json "version". Without a version-*.txt it stamps 0.0.0.
#
#   merge into main    ->  0.1.1
#   minor / major      ->  tag v0.2.0, or a commit message containing "+semver: minor"
#   feature / PR build ->  0.1.1-beta-my-thing.3, 0.1.1-pr7.2
#
# Usage: ./scripts/version/updateVersion.sh (from anywhere; cd's to repo root)
#        ./scripts/version/updateVersion.sh --version 0.2.0   # stamp an explicit version
#
# Run it with `bash`, not `. ./...`: sourcing would apply `set -euo pipefail` to your shell.

VERSION_OVERRIDE="${VERSION_OVERRIDE:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version) VERSION_OVERRIDE="${2:?--version needs a value}"; shift 2 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "error: unknown argument '$1' (see --help)" >&2; exit 1 ;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"
PACKAGE_JSON="package.json"

VERSION_FILE=$(ls version-*.txt 2>/dev/null | head -n1 || true)
VERSION="0.0.0"
if [[ -n "$VERSION_FILE" ]]; then
  echo "Reading version info from $VERSION_FILE"
  VERSION=$(grep '^version=' "$VERSION_FILE" | head -n1 | cut -d= -f2-)
  VERSION=${VERSION:-0.0.0}
else
  echo "No version-*.txt found. Using fallback 0.0.0." >&2
fi

if [[ -n "$VERSION_OVERRIDE" ]]; then
  echo "Version overridden: $VERSION -> ${VERSION_OVERRIDE#v}"
  VERSION="${VERSION_OVERRIDE#v}"
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "error: '$VERSION' is not a valid semver version" >&2
  exit 1
fi

if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "error: $PACKAGE_JSON not found in $REPO" >&2
  exit 1
fi

# Targeted replace of the first "version" key rather than a JSON round-trip: it keeps the rest of
# package.json (key order, indentation, trailing newline) byte for byte.
node -e '
  const fs = require("fs");
  const [file, version] = process.argv.slice(1);
  const src = fs.readFileSync(file, "utf8");
  const re = /("version"\s*:\s*")[^"]*(")/;
  if (!re.test(src)) {
    console.error(`error: no "version" key found in ${file}`);
    process.exit(1);
  }
  fs.writeFileSync(file, src.replace(re, `$1${version}$2`));
' "$PACKAGE_JSON" "$VERSION"

echo "Updated $PACKAGE_JSON: version=$VERSION"
grep '"version":' "$PACKAGE_JSON" | head -n1
echo "Version update complete."
