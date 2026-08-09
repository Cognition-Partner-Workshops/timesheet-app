# k6 load tests

This directory contains the phase-1 load harness and baseline artifacts for the
Express/SQLite backend. The runner starts a fresh in-memory database, disables
the application rate limiter for the duration of the run, seeds 20 clients with
150 entries each, runs one scenario, and shuts the backend down.

## Prerequisites

Install k6 and make it available as `k6` (or set `K6_BIN`). The repository's
backend dependencies must already be installed.

## Run

```bash
./load-tests/runner.sh workflow
./load-tests/runner.sh ramp
./load-tests/runner.sh breaking
```

Override `SEED_CLIENTS`, `SEED_ENTRIES_PER_CLIENT`, `USER_EMAIL`, `PORT`, or
`RUN_ID` as needed. Each run writes JSON and text summaries plus a backend log
to `load-tests/results/`.

The SLO thresholds are p95 HTTP latency under 500 ms and HTTP failure rate
under 1%. The breaking-point run aborts when either threshold fails for the
configured evaluation delay. Endpoint-specific trends (`endpoint_login`,
`endpoint_createClient`, `endpoint_listClients`, `endpoint_createEntry`,
`endpoint_listEntries`, and `endpoint_report`) are included in each summary.

The backend retains the default 15-minute/100-request-per-IP limiter unless
`RATE_LIMIT_WINDOW_MS` or `RATE_LIMIT_MAX` are set. `RATE_LIMIT_MAX=0` disables
it, which is necessary because all k6 VUs share one source IP.

Set `PROFILE_WRAPPER=1` to collect an in-process V8 profile. The wrapper writes
the ignored `.cpuprofile` when the runner stops the server:

```bash
PROFILE_WRAPPER=1 PROFILE_DURATION_MS=120000 DURATION=60s \
  RUN_ID=profile-w50 ./load-tests/runner.sh workflow
```

Set `BREAKING_PROFILE=extended` for the staged 25-to-500-VU breaking run.
API ETags are disabled by default by the runner; set `ETAG_ENABLED=1` for the
comparison/control behavior.
