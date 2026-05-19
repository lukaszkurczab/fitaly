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

FLOW_PATH="${1:-e2e/maestro}"
PLATFORM="${E2E_PLATFORM:-ios}"
EXPO_PORT="${E2E_EXPO_PORT:-8081}"
EXPO_HOST="${E2E_EXPO_HOST:-lan}"
RESULTS_PATH="${E2E_RESULTS_PATH:-/tmp/maestro-${PLATFORM}-results.xml}"
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

cleanup() {
  if [[ -n "${EXPO_PID:-}" ]]; then
    kill "${EXPO_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FLOW_WORKDIR:-}" ]]; then
    rm -rf "${FLOW_WORKDIR}"
  fi
}

trap cleanup EXIT

if [[ -z "${E2E_EXPO_PORT:-}" ]]; then
  while curl -fsS "http://localhost:${EXPO_PORT}/status" >/dev/null 2>&1; do
    echo "[e2e] Expo port ${EXPO_PORT} is already in use; trying $((EXPO_PORT + 1))..."
    EXPO_PORT=$((EXPO_PORT + 1))
  done
fi

if [[ -z "${EXPO_URL}" ]]; then
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

echo "[e2e] Starting Expo dev server (host ${EXPO_HOST}, port ${EXPO_PORT})..."
(
  cd "${ROOT_DIR}"
  CI=1 E2E=true EXPO_PUBLIC_API_BASE_URL="${API_BASE_URL}" \
    E2E_MOCK_CHAT_REPLY="E2E_MOCK_CHAT_REPLY: Keep hydration and protein consistent every day." \
    npx expo start --dev-client --host "${EXPO_HOST}" --port "${EXPO_PORT}"
) >"${EXPO_LOG}" 2>&1 &
EXPO_PID=$!

echo "[e2e] Runtime: platform=${PLATFORM} host=${EXPO_HOST} api=${API_BASE_URL} expo=${EXPO_URL} results=${RESULTS_PATH}"

echo "[e2e] Waiting for Metro to be ready..."
READY=0
for _ in $(seq 1 90); do
  STATUS="$(curl -fsS "http://localhost:${EXPO_PORT}/status" 2>/dev/null || true)"
  if printf "%s" "${STATUS}" | rg -q "packager-status:running"; then
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

if [[ "${PLATFORM}" == "ios" ]]; then
  echo "[e2e] Priming iOS dev client with ${EXPO_URL} ..."
  xcrun simctl openurl booted "${EXPO_URL}" >/dev/null 2>&1 || true
  sleep 4
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

FLOW_RELATIVE="${FLOW_PATH#e2e/maestro/}"
if [[ "${FLOW_PATH}" == "e2e/maestro" ]]; then
  MAESTRO_FLOW_PATH="${FLOW_WORKDIR}"
elif [[ -f "${FLOW_WORKDIR}/${FLOW_RELATIVE}" ]]; then
  MAESTRO_FLOW_PATH="${FLOW_WORKDIR}/${FLOW_RELATIVE}"
elif [[ -d "${FLOW_WORKDIR}/${FLOW_RELATIVE}" ]]; then
  MAESTRO_FLOW_PATH="${FLOW_WORKDIR}/${FLOW_RELATIVE}"
else
  FLOW_BASENAME="$(basename "${FLOW_PATH}")"
  if [[ -f "${FLOW_WORKDIR}/${FLOW_BASENAME}" ]]; then
    MAESTRO_FLOW_PATH="${FLOW_WORKDIR}/${FLOW_BASENAME}"
  else
    MAESTRO_FLOW_PATH="${FLOW_WORKDIR}"
  fi
fi

MAESTRO_CMD=(maestro test "${MAESTRO_FLOW_PATH}" -p "${PLATFORM}" --format junit --output "${RESULTS_PATH}")
if [[ -n "${UDID}" ]]; then
  MAESTRO_CMD+=(--udid "${UDID}")
fi

echo "[e2e] Running: ${MAESTRO_CMD[*]}"
(
  cd "${ROOT_DIR}"
  "${MAESTRO_CMD[@]}"
)
