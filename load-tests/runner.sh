#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K6="${K6_BIN:-k6}"
SCENARIO="${1:?usage: ./runner.sh workflow|ramp|breaking}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
PORT="${PORT:-3001}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
RESULTS_DIR="${ROOT}/load-tests/results"
mkdir -p "${RESULTS_DIR}"

case "${SCENARIO}" in
  workflow) SCRIPT="${ROOT}/load-tests/workflow.js" ;;
  ramp) SCRIPT="${ROOT}/load-tests/ramp.js" ;;
  breaking) SCRIPT="${ROOT}/load-tests/breaking.js" ;;
  *) echo "unknown scenario: ${SCENARIO}" >&2; exit 2 ;;
esac

if curl -fsS --max-time 1 "${BASE_URL}/health" 2>/dev/null | grep -q '"status":"OK"'; then
  echo "${BASE_URL} is already serving; stop the existing backend before running." >&2
  exit 1
fi

cd "${ROOT}/backend"
NODE_ARGS=()
if [[ "${PROFILE_WRAPPER:-0}" == "1" ]]; then
  NODE_ARGS+=("${ROOT}/load-tests/profile-server.js")
elif [[ "${CPU_PROFILE:-0}" == "1" ]]; then
  NODE_ARGS+=(--cpu-prof --cpu-prof-dir="${RESULTS_DIR}" "${ROOT}/backend/src/server.js")
else
  NODE_ARGS+=("${ROOT}/backend/src/server.js")
fi
PORT="${PORT}" RATE_LIMIT_MAX=0 RATE_LIMIT_WINDOW_MS=900000 \
AUTH_CACHE_ENABLED="${AUTH_CACHE_ENABLED:-1}" \
MORGAN_FORMAT="${MORGAN_FORMAT:-combined}" \
ETAG_ENABLED="${ETAG_ENABLED:-0}" \
PROFILE_OUTPUT="${PROFILE_OUTPUT:-${RESULTS_DIR}/${RUN_ID}.cpuprofile}" \
PROFILE_DURATION_MS="${PROFILE_DURATION_MS:-180000}" \
node "${NODE_ARGS[@]}" >"${RESULTS_DIR}/${RUN_ID}-backend.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  if [[ "${CPU_PROFILE:-0}" == "1" ]]; then
    kill -INT "${SERVER_PID}" 2>/dev/null || true
  else
    kill "${SERVER_PID}" 2>/dev/null || true
  fi
  wait "${SERVER_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for attempt in $(seq 1 60); do
  if curl -fsS "${BASE_URL}/health" 2>/dev/null | grep -q '"status":"OK"'; then break; fi
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    cat "${RESULTS_DIR}/${RUN_ID}-backend.log" >&2
    exit 1
  fi
  sleep 1
done
curl -fsS "${BASE_URL}/health" 2>/dev/null | grep -q '"status":"OK"'

cd "${ROOT}"
export BASE_URL USER_EMAIL="${USER_EMAIL:-load-heavy@example.com}" RUN_ID SCENARIO
"${K6}" run "${ROOT}/load-tests/seed.js"
"${K6}" run "${SCRIPT}"
