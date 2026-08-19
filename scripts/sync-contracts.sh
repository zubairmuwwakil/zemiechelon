#!/usr/bin/env bash
# Vendors PickMe's contract JSON into this repo so the build is hermetic.
# Run by hand after a PickMe catalogue change, then commit the result.
# CI does NOT run this — drift shows up as a fixture-parity failure instead.
set -euo pipefail

PICKME_ROOT="${PICKME_ROOT:-../PickMe}"
DEST="src/data/contracts"

if [[ ! -d "$PICKME_ROOT" ]]; then
  echo "error: PickMe repo not found at '$PICKME_ROOT'" >&2
  echo "       set PICKME_ROOT=/path/to/PickMe and re-run" >&2
  exit 1
fi

mkdir -p "$DEST"

copy() {
  local src="$PICKME_ROOT/$1" dst="$DEST/$2"
  [[ -f "$src" ]] || { echo "error: missing $src" >&2; exit 1; }
  cp "$src" "$dst"
  echo "  $2  <-  $1"
}

echo "syncing contracts from $PICKME_ROOT"
copy "contracts/card-catalogue.json"  "card-catalogue.json"
copy "contracts/engine-fixtures.json" "engine-fixtures.json"
copy "Engine/Sources/CardCopilotEngine/Resources/owner-state.json" "owner-state.json"
echo "done — review the diff and commit"
