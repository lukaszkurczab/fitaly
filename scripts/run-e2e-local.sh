#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  set +u
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/.env"
  set -u
  set +a
fi

if [[ "$#" -gt 0 ]]; then
  FLOW_PATHS=("$@")
else
  FLOW_PATHS=("e2e/maestro")
fi
PLATFORM="${E2E_PLATFORM:-ios}"
EXPO_PORT="${E2E_EXPO_PORT:-8081}"
EXPO_HOST="${E2E_EXPO_HOST:-lan}"
RESULTS_PATH="${E2E_RESULTS_PATH:-/tmp/maestro-${PLATFORM}-results.xml}"
RESULTS_DIR="${E2E_RESULTS_DIR:-}"
TEST_OUTPUT_DIR="${E2E_TEST_OUTPUT_DIR:-}"
DEBUG_OUTPUT_DIR="${E2E_DEBUG_OUTPUT_DIR:-}"
TEST_SUITE_NAME="${E2E_SUITE_NAME:-}"
UDID="${E2E_UDID:-}"
API_BASE_URL="${E2E_API_BASE_URL:-${EXPO_PUBLIC_API_BASE_URL:-https://fitaly-backend-smoke.up.railway.app}}"
EXPO_URL="${E2E_EXPO_URL:-}"
E2E_EMAIL="${E2E_EMAIL:-${SMOKE_EXPORT_TEST_EMAIL:-e2e@example.com}}"
E2E_PASSWORD="${E2E_PASSWORD:-${SMOKE_EXPORT_TEST_PASSWORD:-Test@1234}}"
E2E_ALT_EMAIL="${E2E_ALT_EMAIL:-e2e-alt@example.com}"
E2E_ALT_PASSWORD="${E2E_ALT_PASSWORD:-Test@1234}"
E2E_CONFLICT_USERNAME="${E2E_CONFLICT_USERNAME:-e2e}"
E2E_REGISTER_EMAIL="${E2E_REGISTER_EMAIL:-e2e-conflict-username@example.com}"
E2E_REGISTER_PASSWORD="${E2E_REGISTER_PASSWORD:-Test1234.}"
E2E_RUN_ID="${E2E_RUN_ID:-$(date +%s)-$$}"
E2E_DISPOSABLE_EMAIL="${E2E_DISPOSABLE_EMAIL:-fitaly-e2e-${E2E_RUN_ID}@example.com}"
E2E_DISPOSABLE_USERNAME="${E2E_DISPOSABLE_USERNAME:-e2e${E2E_RUN_ID//[^A-Za-z0-9]/}}"
E2E_DISPOSABLE_PASSWORD="${E2E_DISPOSABLE_PASSWORD:-Test1234.}"

EXPO_LOG="/tmp/expo-e2e.log"
EXPO_PID=""
SCRIPT_STARTED_EXPO=0
CLEANING_UP=0

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

sanitize_result_name() {
  printf "%s" "$1" | sed -E 's#^e2e/maestro/##; s#/#-#g; s#[^A-Za-z0-9._-]#-#g; s#\.yaml$##'
}

resolve_flow_path() {
  local flow_path="$1"
  local flow_relative
  local flow_basename

  flow_relative="${flow_path#e2e/maestro/}"
  if [[ "${flow_path}" == "e2e/maestro" ]]; then
    printf "%s\n" "${FLOW_WORKDIR}"
  elif [[ -f "${FLOW_WORKDIR}/${flow_relative}" ]]; then
    printf "%s\n" "${FLOW_WORKDIR}/${flow_relative}"
  elif [[ -d "${FLOW_WORKDIR}/${flow_relative}" ]]; then
    printf "%s\n" "${FLOW_WORKDIR}/${flow_relative}"
  else
    flow_basename="$(basename "${flow_path}")"
    if [[ -f "${FLOW_WORKDIR}/${flow_basename}" ]]; then
      printf "%s\n" "${FLOW_WORKDIR}/${flow_basename}"
    else
      echo "[e2e] Flow path not found: ${flow_path}" >&2
      return 1
    fi
  fi
}

result_path_for_flow() {
  local flow_path="$1"
  local result_name

  if [[ "${#FLOW_PATHS[@]}" -eq 1 && -z "${RESULTS_DIR}" ]]; then
    printf "%s\n" "${RESULTS_PATH}"
    return
  fi

  if [[ -z "${RESULTS_DIR}" ]]; then
    RESULTS_DIR="${RESULTS_PATH%.xml}"
  fi
  mkdir -p "${RESULTS_DIR}"
  result_name="$(sanitize_result_name "${flow_path}")"
  printf "%s/%s.xml\n" "${RESULTS_DIR}" "${result_name}"
}

port_pids() {
  if command_exists lsof; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
  fi
}

port_is_busy() {
  if command_exists lsof; then
    [[ -n "$(port_pids "$1")" ]]
  else
    curl -fsS --max-time 2 "http://localhost:$1/status" >/dev/null 2>&1
  fi
}

print_port_diagnostics() {
  local port="$1"

  if command_exists lsof; then
    echo "[e2e] Process information for port ${port}:"
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
  else
    echo "[e2e] lsof is not available; cannot print process information for port ${port}."
  fi
}

child_pids() {
  local parent_pid="$1"

  if command_exists pgrep; then
    pgrep -P "${parent_pid}" 2>/dev/null || true
  fi
}

process_tree_pids() {
  local root_pid="$1"
  local child_pid

  if ! kill -0 "${root_pid}" >/dev/null 2>&1; then
    return
  fi

  printf "%s\n" "${root_pid}"
  for child_pid in $(child_pids "${root_pid}"); do
    process_tree_pids "${child_pid}"
  done
}

wait_for_processes_to_exit() {
  local attempts="$1"
  shift
  local pid
  local all_exited

  while [[ "${attempts}" -gt 0 ]]; do
    all_exited=1
    for pid in "$@"; do
      if kill -0 "${pid}" >/dev/null 2>&1; then
        all_exited=0
        break
      fi
    done

    if [[ "${all_exited}" -eq 1 ]]; then
      return 0
    fi

    attempts=$((attempts - 1))
    sleep 1
  done

  return 1
}

stop_owned_expo() {
  local pids

  if [[ "${SCRIPT_STARTED_EXPO}" -ne 1 || -z "${EXPO_PID}" ]]; then
    return
  fi

  pids="$(process_tree_pids "${EXPO_PID}" | sort -rn | tr '\n' ' ')"
  if [[ -z "${pids}" ]]; then
    return
  fi

  echo "[e2e] Stopping Expo/Metro process tree: ${pids}"
  # shellcheck disable=SC2086
  kill ${pids} >/dev/null 2>&1 || true

  # shellcheck disable=SC2086
  if ! wait_for_processes_to_exit 8 ${pids}; then
    echo "[e2e] Expo/Metro did not stop gracefully; sending SIGKILL to owned process tree."
    # shellcheck disable=SC2086
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi

  wait "${EXPO_PID}" >/dev/null 2>&1 || true
}

force_kill_port_if_requested() {
  local port="$1"
  local pids

  if [[ "${E2E_FORCE_KILL_PORT:-}" != "1" ]]; then
    return
  fi

  pids="$(port_pids "${port}" | tr '\n' ' ')"
  if [[ -z "${pids}" ]]; then
    return
  fi

  echo "[e2e] E2E_FORCE_KILL_PORT=1; killing remaining process(es) on port ${port}: ${pids}"
  # shellcheck disable=SC2086
  kill ${pids} >/dev/null 2>&1 || true
  # shellcheck disable=SC2086
  if ! wait_for_processes_to_exit 5 ${pids}; then
    echo "[e2e] Remaining port owner did not stop gracefully; sending SIGKILL because E2E_FORCE_KILL_PORT=1."
    # shellcheck disable=SC2086
    kill -9 ${pids} >/dev/null 2>&1 || true
  fi
}

cleanup() {
  if [[ "${CLEANING_UP}" -eq 1 ]]; then
    return
  fi
  CLEANING_UP=1

  stop_owned_expo

  if [[ "${SCRIPT_STARTED_EXPO}" -eq 1 ]]; then
    if port_is_busy "${EXPO_PORT}"; then
      echo "[e2e] Expo port ${EXPO_PORT} is still busy after cleanup."
      print_port_diagnostics "${EXPO_PORT}"
      force_kill_port_if_requested "${EXPO_PORT}"
      if port_is_busy "${EXPO_PORT}"; then
        echo "[e2e] Expo port ${EXPO_PORT} remains busy."
      else
        echo "[e2e] Expo port ${EXPO_PORT} is free after forced cleanup."
      fi
    else
      echo "[e2e] Expo port ${EXPO_PORT} is free after cleanup."
    fi
  fi

  if [[ -n "${FLOW_WORKDIR:-}" ]]; then
    rm -rf "${FLOW_WORKDIR}"
  fi
}

handle_interrupt() {
  cleanup
  trap - INT
  exit 130
}

handle_termination() {
  cleanup
  trap - TERM
  exit 143
}

trap cleanup EXIT
trap handle_interrupt INT
trap handle_termination TERM

if [[ -z "${EXPO_URL}" && -z "${E2E_EXPO_PORT:-}" ]]; then
  while port_is_busy "${EXPO_PORT}"; do
    echo "[e2e] Expo port ${EXPO_PORT} is already in use; trying $((EXPO_PORT + 1))..."
    EXPO_PORT=$((EXPO_PORT + 1))
  done
fi

if [[ -z "${EXPO_URL}" ]]; then
  if port_is_busy "${EXPO_PORT}"; then
    echo "[e2e] Expo port ${EXPO_PORT} is already in use."
    print_port_diagnostics "${EXPO_PORT}"
    echo "[e2e] Set E2E_EXPO_PORT to another port, pass E2E_EXPO_URL for a pre-running server, or use E2E_FORCE_KILL_PORT=1 to force cleanup of the selected port on exit."
    exit 1
  fi

  if [[ "${PLATFORM}" == "android" ]]; then
    EXPO_URL="exp+fitaly://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A${EXPO_PORT}"
  else
    EXPO_URL="exp+fitaly://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${EXPO_PORT}"
  fi
fi

if [[ "${E2E_SKIP_API_HEALTH:-}" != "1" ]]; then
  API_HEALTH_URL="${API_BASE_URL%/}/api/v1/health"
  echo "[e2e] Checking API health at ${API_HEALTH_URL}..."
  API_READY=0
  for _ in $(seq 1 "${E2E_API_HEALTH_RETRIES:-6}"); do
    if curl -fsS --max-time 5 "${API_HEALTH_URL}" >/dev/null 2>&1; then
      API_READY=1
      break
    fi
    sleep "${E2E_API_HEALTH_DELAY:-5}"
  done

  if [[ "${API_READY}" -ne 1 ]]; then
    echo "[e2e] API health check failed for ${API_HEALTH_URL}."
    echo "[e2e] Set E2E_SKIP_API_HEALTH=1 to bypass this preflight when testing a deliberately unavailable backend."
    exit 1
  fi
fi

if [[ -z "${E2E_EXPO_URL:-}" ]]; then
  echo "[e2e] Selected Expo port: ${EXPO_PORT}"
  echo "[e2e] Starting Expo dev server (host ${EXPO_HOST}, port ${EXPO_PORT})..."
  (
    cd "${ROOT_DIR}"
    export CI=1
    export E2E=true
    export EXPO_PUBLIC_API_BASE_URL="${API_BASE_URL}"
    export E2E_MOCK_CHAT_REPLY="E2E_MOCK_CHAT_REPLY: Keep hydration and protein consistent every day."
    exec npx expo start --dev-client --host "${EXPO_HOST}" --port "${EXPO_PORT}"
  ) >"${EXPO_LOG}" 2>&1 &
  EXPO_PID=$!
  SCRIPT_STARTED_EXPO=1
  echo "[e2e] Expo/Metro PID: ${EXPO_PID}"
else
  echo "[e2e] Using preconfigured Expo URL from E2E_EXPO_URL; this script will not start or stop Expo/Metro."
fi

echo "[e2e] Runtime: platform=${PLATFORM} host=${EXPO_HOST} api=${API_BASE_URL} expo=${EXPO_URL} results=${RESULTS_PATH}"
if [[ -n "${TEST_OUTPUT_DIR}" ]]; then
  mkdir -p "${TEST_OUTPUT_DIR}"
  echo "[e2e] Maestro test output: ${TEST_OUTPUT_DIR}"
fi
if [[ -n "${DEBUG_OUTPUT_DIR}" ]]; then
  mkdir -p "${DEBUG_OUTPUT_DIR}"
  echo "[e2e] Maestro debug output: ${DEBUG_OUTPUT_DIR}"
fi
if [[ "${#FLOW_PATHS[@]}" -gt 1 || -n "${RESULTS_DIR}" ]]; then
  echo "[e2e] Suite flow count: ${#FLOW_PATHS[@]}"
fi

if [[ "${SCRIPT_STARTED_EXPO}" -eq 1 ]]; then
  echo "[e2e] Waiting for Metro to be ready..."
  READY=0
  for _ in $(seq 1 90); do
    STATUS="$(curl -fsS --max-time 2 "http://localhost:${EXPO_PORT}/status" 2>/dev/null || true)"
    if printf "%s" "${STATUS}" | grep -q "packager-status:running"; then
      READY=1
      break
    fi
    sleep 1
  done

  if [[ "${READY}" -ne 1 ]]; then
    echo "[e2e] Metro did not start in time. Last Expo logs:"
    tail -n 80 "${EXPO_LOG}" || true
    exit 1
  fi
fi

if [[ "${PLATFORM}" == "ios" ]]; then
  for BUNDLE_ID in "com.lkurczab.fitaly" "com.lkurczab.foodscannerai"; do
    xcrun simctl spawn booted defaults write "${BUNDLE_ID}" EXDevMenuShowFloatingActionButton -bool false >/dev/null 2>&1 || true
    xcrun simctl spawn booted defaults write "${BUNDLE_ID}" EXDevMenuTouchGestureEnabled -bool false >/dev/null 2>&1 || true
    xcrun simctl spawn booted defaults write "${BUNDLE_ID}" EXDevMenuMotionGestureEnabled -bool false >/dev/null 2>&1 || true
    xcrun simctl spawn booted defaults write "${BUNDLE_ID}" EXDevMenuShowsAtLaunch -bool false >/dev/null 2>&1 || true
  done

  echo "[e2e] Priming iOS dev client with ${EXPO_URL} ..."
  xcrun simctl openurl booted "${EXPO_URL}" >/dev/null 2>&1 || true
  sleep 4

  DEV_MENU_DISMISS_FLOW="$(mktemp "${TMPDIR:-/tmp}/fitaly-close-dev-menu.XXXXXX")"
  cat >"${DEV_MENU_DISMISS_FLOW}" <<'YAML'
appId: com.lkurczab.fitaly
---
- tapOn: "Close"
YAML
  maestro test "${DEV_MENU_DISMISS_FLOW}" -p "${PLATFORM}" >/dev/null 2>&1 || true
  rm -f "${DEV_MENU_DISMISS_FLOW}"
fi

FLOW_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/fitaly-e2e-flows.XXXXXX")"
cp -R "${ROOT_DIR}/e2e/maestro/." "${FLOW_WORKDIR}/"
export E2E_EXPO_URL="${EXPO_URL}"
export E2E_EMAIL E2E_PASSWORD E2E_ALT_EMAIL E2E_ALT_PASSWORD
export E2E_CONFLICT_USERNAME E2E_REGISTER_EMAIL E2E_REGISTER_PASSWORD
export E2E_RUN_ID E2E_DISPOSABLE_EMAIL E2E_DISPOSABLE_USERNAME E2E_DISPOSABLE_PASSWORD
while IFS= read -r -d '' flow_file; do
  perl -0pi -e 's/__E2E_EXPO_URL__/$ENV{E2E_EXPO_URL}/g; s/\$\{(E2E_[A-Z0-9_]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/ge' "${flow_file}"
done < <(find "${FLOW_WORKDIR}" -type f -name '*.yaml' -print0)

FLOW_SUMMARY_NAMES=()
FLOW_SUMMARY_STATUSES=()
FAILED_COUNT=0

for FLOW_PATH in "${FLOW_PATHS[@]}"; do
  if ! MAESTRO_FLOW_PATH="$(resolve_flow_path "${FLOW_PATH}")"; then
    FLOW_SUMMARY_NAMES+=("${FLOW_PATH}")
    FLOW_SUMMARY_STATUSES+=("FAIL")
    FAILED_COUNT=$((FAILED_COUNT + 1))
    if [[ "${E2E_CONTINUE_ON_FAILURE:-}" != "1" ]]; then
      break
    fi
    continue
  fi

  FLOW_RESULTS_PATH="$(result_path_for_flow "${FLOW_PATH}")"
  MAESTRO_CMD=(maestro test "${MAESTRO_FLOW_PATH}" -p "${PLATFORM}" --format junit --output "${FLOW_RESULTS_PATH}")
  if [[ -n "${TEST_SUITE_NAME}" ]]; then
    MAESTRO_CMD+=(--test-suite-name "${TEST_SUITE_NAME}")
  fi
  if [[ -n "${TEST_OUTPUT_DIR}" ]]; then
    MAESTRO_CMD+=(--test-output-dir "${TEST_OUTPUT_DIR}")
  fi
  if [[ -n "${DEBUG_OUTPUT_DIR}" ]]; then
    MAESTRO_CMD+=(--debug-output "${DEBUG_OUTPUT_DIR}/$(sanitize_result_name "${FLOW_PATH}")")
  fi
  if [[ -n "${UDID}" ]]; then
    MAESTRO_CMD+=(--udid "${UDID}")
  fi

  echo "[e2e] Running flow: ${FLOW_PATH}"
  echo "[e2e] Running: ${MAESTRO_CMD[*]}"
  if (
    cd "${ROOT_DIR}"
    "${MAESTRO_CMD[@]}"
  ); then
    FLOW_SUMMARY_NAMES+=("${FLOW_PATH}")
    FLOW_SUMMARY_STATUSES+=("PASS")
    echo "[e2e] PASS ${FLOW_PATH}"
  else
    FLOW_SUMMARY_NAMES+=("${FLOW_PATH}")
    FLOW_SUMMARY_STATUSES+=("FAIL")
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "[e2e] FAIL ${FLOW_PATH}"
    if [[ "${E2E_CONTINUE_ON_FAILURE:-}" != "1" ]]; then
      break
    fi
  fi
done

echo "[e2e] Flow summary:"
for INDEX in "${!FLOW_SUMMARY_NAMES[@]}"; do
  echo "[e2e] ${FLOW_SUMMARY_STATUSES[${INDEX}]} ${FLOW_SUMMARY_NAMES[${INDEX}]}"
done

if [[ "${FAILED_COUNT}" -gt 0 ]]; then
  echo "[e2e] ${FAILED_COUNT} flow path(s) failed."
  exit 1
fi
