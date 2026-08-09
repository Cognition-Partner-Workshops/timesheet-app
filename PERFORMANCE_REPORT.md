# Timesheet App Performance Report

## Executive summary

The fixed code removes the repeated authenticated-user lookup for known users
with a bounded, per-database in-process cache. In the short isolated
attribution run, p95 fell from 15.29 ms to 9.60 ms and throughput rose from
1,083.13 to 1,140.74 requests/s. The other three candidate changes did not
show a measurable gain in their isolated runs and were not retained as
performance fixes.

The full fixed breaking run reached approximately 185 active VUs before the
latency threshold aborted it, versus approximately 169 VUs in the baseline.
The failure mode remained latency-threshold failure, not an HTTP error storm:
the HTTP failure rate at the break was 0.00%.

## Methodology and environment

- Machine: 8 CPU cores and 31 GB RAM.
- Backend: Express, single-process Node.js, in-memory SQLite database.
- Load generator: k6 v2.1.0.
- The k6 process and backend were co-located on the same machine, so their
  resource use competes; these are not isolated server-capacity measurements.
- Each run started a fresh backend and seeded 20 clients with 150 work entries
  per client (3,000 entries).
- Load runs set `RATE_LIMIT_MAX=0`. The application default remains 100
  requests per 15 minutes per IP.
- SLO thresholds were p95 HTTP duration under 500 ms and HTTP failure rate
  under 1%. The breaking scenario aborts when the latency threshold fails.
- Baseline values below are read from the saved `baseline-*.json` summaries.
  Fixed values are read from the saved `phase2-fixed-*.json` summaries; no
  baseline scenario was rerun.

The harness now measures `listClients()` inside every measured iteration.
The earlier breaking baseline called it only during setup, so its
`endpoint_list_clients` value is not apples-to-apples with the fixed run.
The earlier ramp also called it conditionally. The workflow baseline already
included the call in each iteration.

## Baseline and fixed scenario results

| Scenario | HTTP requests | Throughput (req/s) | p95 (ms) | p99 (ms) | HTTP failure rate |
|---|---:|---:|---:|---:|---:|
| Baseline workflow, 50 VUs / 3 min | 121,472 | 673.16 | 82.81 | 103.15 | 0.00% |
| Fixed workflow, 50 VUs / 3 min | 132,022 | 731.86 | 77.55 | 104.84 | 0.00% |
| Baseline ramp, 1→100 VUs / 5 min | 133,713 | 444.36 | 264.82 | 334.47 | 0.00% |
| Fixed ramp, 1→100 VUs / 5 min | 147,077 | 488.20 | 277.08 | 421.55 | 0.00% |
| Baseline breaking | 127,512 | 439.61 | 504.02 | 658.02 | 0.00% |
| Fixed breaking | 167,794 | 517.82 | 503.99 | 718.10 | 0.00% |

The workflow and ramp runs are time-based, so request totals and throughput
are directly reported measurements but are affected by normal run-to-run
variation. The fixed ramp's p95 is slightly higher than the baseline despite
higher throughput; this is not presented as a universal improvement.

## Endpoint latency

Values are p95 milliseconds from the saved summaries.

| Endpoint | Baseline workflow | Fixed workflow | Baseline ramp | Fixed ramp | Baseline breaking | Fixed breaking |
|---|---:|---:|---:|---:|---:|---:|
| Login | 44.60 | 55.67 | 175.01 | 306.35 | 304.15 | 543.17 |
| Create entry | 100.15 | 101.48 | 317.77 | 298.01 | 609.72 | 509.56 |
| List clients | 64.04 | 58.05 | 223.35 | 241.68 | 1.11* | 382.25 |
| List entries | 71.03 | 58.29 | 240.06 | 285.19 | 444.38 | 582.60 |
| Report | 83.54 | 84.15 | 273.68 | 186.94† | 520.49 | 419.27 |

\* The breaking baseline list-clients call was setup-only and is not
comparable.
† The ramp scenario calls the report conditionally, so endpoint counts and
mix differ from the fixed breaking/workflow scenarios.

The corrected fixed summaries contain real endpoint request counts through
dedicated Counter metrics. For example, the fixed workflow recorded 26,404
create-entry calls, 26,405 list-client calls, 26,404 list-entry calls, 26,405
login calls, and 26,404 report calls. Trend metrics themselves do not expose a
sample count in k6's summary `values` object; the old writer incorrectly read
`values.count`, which produced zero.

## Breaking point and evidence

The baseline breaking run aborted while ramping from 150 toward 175 VUs,
around 169 active VUs, at p95 504.02 ms. The fixed run continued through the
175-VU stage and aborted later at approximately 185 active VUs, at p95
503.99 ms. In both runs, the HTTP failure rate was 0.00%; this was a
latency-threshold failure, not an error storm, timeout storm, connection-reset
storm, or 5xx storm.

The baseline 30-second CPU sampling run recorded 36 backend samples, averaging
73.4% CPU and reaching 90.3%. This indicates the single Node process was
approaching one fully utilized core. No usable Node `.cpuprofile` was
captured: the `--cpu-prof` attempt did not emit one on the signal shutdown
path. The bottleneck assessment therefore rests on endpoint latency,
response-size, and CPU-utilization evidence, not a CPU profile.

The saved summaries report substantial response traffic. For example, the
baseline workflow received approximately 42.7 MB/s, or about 7.7 GB across
121,472 requests; the fixed workflow received approximately 49.6 MB/s, or
about 8.9 GB across 132,022 requests. Large unpaginated list/report payloads
remain an important part of the measured cost.

## Candidate attribution

Each candidate was measured in isolation in a short 30-second, 50-VU workflow
run against the same seeded volume. These attribution runs are shorter and
more sensitive to noise than the canonical scenario runs, so they establish
direction and attribution rather than a production capacity projection.

| Run | Change isolated | Requests | Throughput (req/s) | p95 (ms) | Result |
|---|---|---:|---:|---:|---|
| `phase2-control` | All candidates disabled; combined logging | 32,782 | 1,083.13 | 15.29 | Control |
| `phase2-index` | Composite `(user_email, client_id, date, created_at)` index | 32,702 | 1,081.00 | 15.64 | Discarded; no gain |
| `phase2-sql-total` | SQL window aggregation for report total | 30,932 | 1,022.24 | 21.83 | Discarded; slower |
| `phase2-auth-cache` | Bounded known-email cache | 34,482 | 1,140.74 | 9.60 | **Retained** |
| `phase2-logging-off` | Morgan logging disabled | 32,987 | 1,089.39 | 17.86 | Discarded; no measurable gain |

Candidate A's composite index was removed after the isolated run did not
improve p95 or throughput; the existing single-column indexes remain.
Candidate B's window expression made this workload slower, so the existing
response shape and JavaScript reduction remain. Candidate D's configurable
Morgan format is retained as an operational option, with `combined` still the
default, but disabling logging was not retained as a claimed performance
fix. Candidate C is retained: it uses a maximum size of 1,000 entries, scopes
the cache to the database object, and only caches users confirmed by a
successful database lookup. Unknown users still follow the existing insert
path.

## Areas not fixed

The following remain recommendations for a future capacity project:

- Replace in-memory SQLite for durable or multi-process deployments and
  address its single serialized SQLite connection.
- Consider a single-process Node deployment with clustering or multiple
  workers.
- Add pagination or another bounded response strategy for the large report
  and work-entry list payloads (not done here because it changes the API
  contract).
- Avoid writing a temporary CSV file before `res.download`.
- Revisit the default global rate limit of 100 requests per 15 minutes per IP.
  A real 50-user deployment would hit this shared-IP limit first unless the
  limit is redesigned or configured appropriately.

These results are measurements on the co-located 8-core/31-GB test machine,
not projections for a different deployment topology.
