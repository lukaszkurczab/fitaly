#!/usr/bin/env bash
# verify-backend-contract.sh — Read-only check that mobile contracts match backend canonical.
#
# This script is designed for CI: it compares the mobile-side mirrored
# contract snapshots against the backend repo's canonical snapshots and
# exits non-zero if they differ. It never modifies files.
#
# Usage:
#   ./scripts/verify-backend-contract.sh                    # auto-detect sibling dir
#   BACKEND_REPO=/path/to/backend ./scripts/verify-backend-contract.sh  # explicit path
#
# For CI with separate repos, set BACKEND_REPO to the checkout path.
# Example GitHub Actions step:
#
#   - uses: actions/checkout@v5
#     with:
#       repository: <org>/fitaly-backend
#       path: backend
#   - run: BACKEND_REPO=backend ./scripts/verify-backend-contract.sh

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
  echo "SKIP: Backend repo not available — cannot verify cross-repo contract sync."
  echo "  Set BACKEND_REPO=/path/to/fitaly-backend to enable."
  exit 0
fi

drift_count=0

for contract_file in "${CONTRACT_FILES[@]}"; do
  MOBILE_CONTRACT="$MOBILE_ROOT/src/__contract_fixtures__/$contract_file"
  BACKEND_CONTRACT="$BACKEND_ROOT/tests/contract_fixtures/$contract_file"

  if [[ ! -f "$BACKEND_CONTRACT" ]]; then
    echo "ERROR: Canonical contract not found at $BACKEND_CONTRACT"
    drift_count=$((drift_count + 1))
    continue
  fi

  if [[ ! -f "$MOBILE_CONTRACT" ]]; then
    echo "ERROR: Mobile contract not found at $MOBILE_CONTRACT"
    drift_count=$((drift_count + 1))
    continue
  fi

  if diff -q "$BACKEND_CONTRACT" "$MOBILE_CONTRACT" > /dev/null 2>&1; then
    echo "OK: $contract_file matches backend canonical snapshot."
    continue
  fi

  echo "DRIFT DETECTED: $contract_file differs from backend canonical."
  echo ""
  echo "Backend (canonical): $BACKEND_CONTRACT"
  echo "Mobile (local copy): $MOBILE_CONTRACT"
  echo ""
  diff --unified "$BACKEND_CONTRACT" "$MOBILE_CONTRACT" || true
  echo ""
  drift_count=$((drift_count + 1))
done

if [[ $drift_count -eq 0 ]]; then
  exit 0
fi

echo "To fix: run ./scripts/sync-backend-contract.sh"
exit 1
