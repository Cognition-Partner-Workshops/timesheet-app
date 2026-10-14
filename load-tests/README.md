# k6 Load Tests for Employee Time Tracking App

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- Backend server running on `http://localhost:3001`

## Test Scripts

| Script | Description | VUs | Duration |
|---|---|---|---|
| `baseline-test.js` | Constant 50-user load for baseline metrics | 50 | 2 min |
| `ramp-up-test.js` | Gradual ramp from 1 → 100 users | 1–100 | 5 min |
| `breakpoint-test.js` | Ramp to 300 users; auto-aborts on failure | 1–300 | 10 min |

## Running

```bash
# Start the backend first
cd backend && npm run dev

# Baseline (50 constant users)
k6 run load-tests/baseline-test.js

# Ramp-up (1 → 100 users over 5 min)
k6 run load-tests/ramp-up-test.js

# Breakpoint (find the limit)
k6 run load-tests/breakpoint-test.js

# Override base URL
k6 run -e BASE_URL=http://your-server:3001 load-tests/baseline-test.js
```

## Workflow per Virtual User

Each iteration simulates a complete user workflow:

1. **Login** — `POST /api/auth/login`
2. **Create client** — `POST /api/clients`
3. **Create work entries** — `POST /api/work-entries` (2–3 entries)
4. **List clients** — `GET /api/clients`
5. **List work entries** — `GET /api/work-entries?clientId=...`
6. **View report** — `GET /api/reports/client/:id`

## Key Metrics

- **http_req_duration (p95)** — 95th percentile response time
- **http_req_failed** — Percentage of non-2xx responses
- **iterations** — Total completed workflows (throughput)
- **workflow_duration** — End-to-end time for a full user workflow
