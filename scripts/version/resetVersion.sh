#!/usr/bin/env bash
set -euo pipefail

# resetVersion.sh
# Puts package.json "version" back to the 0.1.0 baseline it is committed with. version-*.txt is
# left alone. Use it after testing updateVersion.sh locally so a GitVersion-derived number is not
# committed by accident.
#
# Usage: ./scripts/version/resetVersion.sh (from anywhere; cd's to repo root)

BASELINE="0.1.0"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"

if [[ ! -f package.json ]]; then
  echo "error: package.json not found - nothing reset." >&2
  exit 1
fi

bash "$REPO/scripts/version/updateVersion.sh" --version "$BASELINE"
echo "Version reset complete (baseline $BASELINE)."
