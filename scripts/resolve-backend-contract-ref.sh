#!/usr/bin/env bash
# Resolve the backend contract ref for the mobile cross-repo contract CI gate.
#
# Sources, in priority-safe order:
#   1. BACKEND_CONTRACT_REF_INPUT or BACKEND_CONTRACT_REF env var
#   2. PR_BODY marker: Backend-Contract-Ref: <ref>
#   3. default backend main for non-exact local/PR CI paths only
#
# Set BACKEND_CONTRACT_REF_REQUIRE_EXACT_SHA=true for release-candidate paths.

set -euo pipefail

DEFAULT_REF="main"
MARKER_NAME="Backend-Contract-Ref"
EXACT_SHA_REGEX='^[0-9a-fA-F]{40}$'

shopt -s extglob

trim() {
  local value="$1"
  value="${value##+([[:space:]])}"
  value="${value%%+([[:space:]])}"
  printf '%s' "$value"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

validate_ref() {
  local ref="$1"

  [[ -n "$ref" ]] || fail "Backend contract ref must not be empty."
  [[ ${#ref} -le 255 ]] || fail "Backend contract ref is too long."
  [[ "$ref" != /* ]] || fail "Backend contract ref must not start with '/': $ref"
  [[ "$ref" != */ ]] || fail "Backend contract ref must not end with '/': $ref"
  [[ "$ref" != *//* ]] || fail "Backend contract ref must not contain '//': $ref"
  [[ "$ref" != *..* ]] || fail "Backend contract ref must not contain '..': $ref"
  [[ "$ref" != *@\{* ]] || fail "Backend contract ref must not contain '@{': $ref"
  [[ "$ref" != *.lock ]] || fail "Backend contract ref must not end with '.lock': $ref"
  [[ "$ref" != *. ]] || fail "Backend contract ref must not end with '.': $ref"

  if [[ "$ref" =~ [[:space:]] ]]; then
    fail "Backend contract ref must not contain whitespace: $ref"
  fi

  if [[ "$ref" =~ [\\~^:\?\*\[] ]]; then
    fail "Backend contract ref contains a disallowed character: $ref"
  fi

  if ! [[ "$ref" =~ ^[A-Za-z0-9._/-]+$ ]]; then
    fail "Backend contract ref may only contain letters, numbers, '.', '_', '/', and '-': $ref"
  fi
}

validate_exact_sha() {
  local ref="$1"

  if ! [[ "$ref" =~ $EXACT_SHA_REGEX ]]; then
    fail "Backend contract ref must be an exact 40-character commit SHA for this path (got: $ref)."
  fi
}

input_ref="$(trim "${BACKEND_CONTRACT_REF_INPUT:-${BACKEND_CONTRACT_REF:-}}")"
pr_body="${PR_BODY:-}"
marker_ref=""
marker_count=0
marker_has_empty_value=0

while IFS= read -r line; do
  if [[ "$line" =~ ^[[:space:]]*${MARKER_NAME}:[[:space:]]*(.*)$ ]]; then
    marker_count=$((marker_count + 1))
    if (( marker_count > 1 )); then
      fail "Multiple ${MARKER_NAME} markers found. Keep exactly one explicit backend ref."
    fi

    marker_ref="$(trim "${BASH_REMATCH[1]}")"
    if [[ -z "$marker_ref" ]]; then
      marker_has_empty_value=1
    fi
  fi
done <<< "$pr_body"

if (( marker_has_empty_value )); then
  fail "${MARKER_NAME} marker value must not be empty."
fi

selected_ref="$DEFAULT_REF"
selected_source="default"

if [[ -n "$input_ref" && -n "$marker_ref" && "$input_ref" != "$marker_ref" ]]; then
  fail "Conflicting backend contract refs: workflow input '$input_ref' differs from PR marker '$marker_ref'."
elif [[ -n "$input_ref" ]]; then
  selected_ref="$input_ref"
  selected_source="workflow input"
elif [[ -n "$marker_ref" ]]; then
  selected_ref="$marker_ref"
  selected_source="PR body marker ${MARKER_NAME}"
fi

validate_ref "$selected_ref"

require_exact_sha="$(trim "${BACKEND_CONTRACT_REF_REQUIRE_EXACT_SHA:-false}")"
require_exact_sha="$(printf '%s' "$require_exact_sha" | tr '[:upper:]' '[:lower:]')"
if [[ "$require_exact_sha" == "true" ]]; then
  validate_exact_sha "$selected_ref"
fi

echo "Selected backend contract ref: $selected_ref"
echo "Backend contract ref source: $selected_source"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "ref=$selected_ref"
    echo "source=$selected_source"
    if [[ "$selected_ref" =~ $EXACT_SHA_REGEX ]]; then
      echo "sha=$selected_ref"
    fi
  } >> "$GITHUB_OUTPUT"
fi
