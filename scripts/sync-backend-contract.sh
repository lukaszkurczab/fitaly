#!/usr/bin/env bash
# sync-backend-contract.sh — Sync canonical shared contracts from backend repo.
#
# This script copies the canonical contract snapshots from the backend repo
# into the mobile repo's contract fixtures directory. It is the single
# mechanism for updating the mobile-side copies of shared contracts.
#
# Usage:
#   ./scripts/sync-backend-contract.sh                    # auto-detect sibling dir
#   BACKEND_REPO=/path/to/backend ./scripts/sync-backend-contract.sh  # explicit path
#
# The script:
#   1. Locates the backend repo (sibling directory or BACKEND_REPO env var)
#   2. Copies canonical contract JSON files
#   3. Reports whether anything changed
#
# In CI, use verify-backend-contract.sh instead (read-only check).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTRACT_FILES=(
  "smart_reminders_v1.contract.json"
  "profile_onboarding_v1.contract.json"
)

# Resolve backend repo location
if [[ -n "${BACKEND_REPO:-}" ]]; then
  BACKEND_ROOT="$BACKEND_REPO"
elif [[ -d "$MOBILE_ROOT/../fitaly-backend" ]]; then
  BACKEND_ROOT="$(cd "$MOBILE_ROOT/../fitaly-backend" && pwd)"
else
  echo "ERROR: Cannot find backend repo."
  echo "  Set BACKEND_REPO=/path/to/fitaly-backend"
  echo "  or place it as a sibling directory."
  exit 1
fi

synced_count=0

for contract_file in "${CONTRACT_FILES[@]}"; do
  MOBILE_CONTRACT="$MOBILE_ROOT/src/__contract_fixtures__/$contract_file"
  BACKEND_CONTRACT="$BACKEND_ROOT/tests/contract_fixtures/$contract_file"

  if [[ ! -f "$BACKEND_CONTRACT" ]]; then
    echo "ERROR: Canonical contract not found at $BACKEND_CONTRACT"
    exit 1
  fi

  if diff -q "$BACKEND_CONTRACT" "$MOBILE_CONTRACT" > /dev/null 2>&1; then
    echo "OK: $contract_file is already in sync."
    continue
  fi

  cp "$BACKEND_CONTRACT" "$MOBILE_CONTRACT"
  echo "SYNCED: $contract_file"
  echo "  From: $BACKEND_CONTRACT"
  echo "  To:   $MOBILE_CONTRACT"
  echo ""
  synced_count=$((synced_count + 1))
done

if [[ $synced_count -eq 0 ]]; then
  echo "OK: Mobile contracts are already in sync with backend canonical."
  exit 0
fi

echo "Review the diff and commit the updated fixtures."
