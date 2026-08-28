#!/usr/bin/env bash
# Run all k6 load test scenarios and save results to JSON for analysis.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
mkdir -p "${RESULTS_DIR}"

BASE_URL="${BASE_URL:-http://localhost:3001}"
export BASE_URL

echo "=== k6 Load Tests for Timesheet App ==="
echo "Target: ${BASE_URL}"
echo "Results: ${RESULTS_DIR}"
echo ""

# Health check
echo "Checking application health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Application is not reachable at ${BASE_URL} (HTTP ${HTTP_CODE})"
  exit 1
fi
echo "Application is healthy."
echo ""

# 1. Workflow test (50 concurrent users)
echo "=== Scenario 1: 50 Concurrent Users Workflow ==="
k6 run \
  --out json="${RESULTS_DIR}/workflow.json" \
  --summary-export="${RESULTS_DIR}/workflow-summary.json" \
  -e BASE_URL="${BASE_URL}" \
  "${SCRIPT_DIR}/scenario-workflow.js" 2>&1 | tee "${RESULTS_DIR}/workflow.log"
echo ""

# 2. Ramp-up test (1 -> 100 users over 5 min)
echo "=== Scenario 2: Ramp-up 1 -> 100 Users ==="
k6 run \
  --out json="${RESULTS_DIR}/rampup.json" \
  --summary-export="${RESULTS_DIR}/rampup-summary.json" \
  -e BASE_URL="${BASE_URL}" \
  "${SCRIPT_DIR}/scenario-rampup.js" 2>&1 | tee "${RESULTS_DIR}/rampup.log"
echo ""

# 3. Breakpoint test
echo "=== Scenario 3: Breakpoint / Stress Test ==="
k6 run \
  --out json="${RESULTS_DIR}/breakpoint.json" \
  --summary-export="${RESULTS_DIR}/breakpoint-summary.json" \
  -e BASE_URL="${BASE_URL}" \
  "${SCRIPT_DIR}/scenario-breakpoint.js" 2>&1 | tee "${RESULTS_DIR}/breakpoint.log"
echo ""

echo "=== All scenarios complete. Results saved to ${RESULTS_DIR} ==="
