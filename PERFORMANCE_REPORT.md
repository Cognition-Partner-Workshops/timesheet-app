# Timesheet App Performance Report

## Executive summary

The corrected-harness canonical baseline at 50 VUs was **p95 81.35–94.89 ms,
0.00% HTTP failures, and 640.77–671.43 requests/s** across two workflow
repeats. The fixed cache build measured **p95 96.81–97.42 ms, 0.00% failures,
and 675.62–677.14 requests/s**. The p95 change is therefore **-2.0% to
+19.8%** across repeats and is not a stable latency improvement; throughput
was **+0.6% to +5.4%**.

The short ramp profile stayed below the 500 ms threshold through 100 VUs in
all repeats. Its baseline p95 was **112.42–133.24 ms** and fixed p95 was
**98.60–105.64 ms**, an observed **5.9%–26.0% reduction**, with 0.00%
failures in every run. The short breaking profile completed its 200-VU stage
without an HTTP error storm in all four runs; aggregate p95 was
**254.87–283.08 ms baseline** versus **243.01–243.93 ms fixed**, an observed
**4.3%–14.2% reduction**. Because the short profile does not trigger the
canonical abort point, this does not establish a higher breaking concurrency.

The deployment-critical finding is independent of those capacity results:
the shipped default global limiter allows only **100 requests per 15 minutes
per IP**. In a shared-egress deployment, many users appear as one IP and
will receive 429 responses at roughly 100 requests, long before backend
concurrency becomes the limit. Load runs explicitly set `RATE_LIMIT_MAX=0`.

The retained change is the bounded per-database authentication cache. The
composite index, SQL report aggregation, and disabling Morgan logging did not
show a reliable isolated gain and were not retained as performance fixes.

## Methodology and environment

- 8 CPU cores and 31 GB RAM; k6 v2.1.0.
- Express/single-process Node backend with an in-memory SQLite database.
- k6 and the backend were co-located, so these are not isolated server
  capacity measurements or projections for another topology.
- Every run started a fresh database with 20 clients and 3,000 work entries.
- Every measured iteration used the same mix: login, create entry, list
  entries, list clients, and view report, followed by a 0.2-second pause.
- Workflow repeats ran 50 VUs for 3 minutes. Ramp and breaking repeats used
  explicitly marked short profiles (75 and 80 seconds respectively) to make
  repeat measurement practical. The default five-minute ramp and full
  breaking profiles remain available in the harness.
- Baseline-equivalent runs used `AUTH_CACHE_ENABLED=0`,
  `RATE_LIMIT_MAX=0`, and combined Morgan logging. Fixed runs enabled the
  cache. No candidate index or SQL aggregation change was active.
- Thresholds were p95 HTTP duration under 500 ms and HTTP failure rate under
  1%. All repeated runs reported 0.00% HTTP failures.
- Raw backend logs and CPU profiles remain ignored; only JSON/TXT summaries
  are committed.

## Corrected-harness repeated results

### Workflow: 50 VUs for 3 minutes

| Version | Requests | Throughput (req/s) | p95 (ms) | p99 (ms) | Error rate |
|---|---:|---:|---:|---:|---:|
| Baseline repeat 1 | 115,627 | 640.77 | 94.89 | 132.97 | 0.00% |
| Baseline repeat 2 | 121,137 | 671.43 | 81.35 | 107.73 | 0.00% |
| Fixed repeat 1 | 122,262 | 677.14 | 96.81 | 143.24 | 0.00% |
| Fixed repeat 2 | 122,007 | 675.62 | 97.42 | 141.00 | 0.00% |

### Ramp: short profile, 1→100 VUs

| Version | Requests | Throughput (req/s) | p95 (ms) | p99 (ms) | Error rate |
|---|---:|---:|---:|---:|---:|
| Baseline repeat 1 | 56,877 | 752.87 | 133.24 | 177.43 | 0.00% |
| Baseline repeat 2 | 57,952 | 766.19 | 112.42 | 142.89 | 0.00% |
| Fixed repeat 1 | 61,567 | 814.68 | 105.64 | 143.19 | 0.00% |
| Fixed repeat 2 | 62,012 | 820.72 | 98.60 | 128.49 | 0.00% |

### Breaking: short profile, 1→200 VUs

The short profile completed the staged run through 200 VUs in every repeat,
so no threshold-defined breaking concurrency was observed.

| Version | Requests | Throughput (req/s) | p95 (ms) | p99 (ms) | Error rate |
|---|---:|---:|---:|---:|---:|
| Baseline repeat 1 | 65,407 | 804.77 | 283.08 | 397.25 | 0.00% |
| Baseline repeat 2 | 65,997 | 812.47 | 254.87 | 376.84 | 0.00% |
| Fixed repeat 1 | 62,997 | 777.28 | 243.93 | 293.87 | 0.00% |
| Fixed repeat 2 | 62,382 | 770.51 | 243.01 | 310.79 | 0.00% |

The earlier full-profile result (approximately 169 VUs baseline versus 185
VUs fixed) is retired as a canonical comparison because it used the
pre-correction workload. The corrected short repeats do not support claiming
that the breaking-point shift is real; with these measurements, it is
**not distinguishable from run-to-run variance**.

## Endpoint p95 ranges

These are min–max ranges across the two corrected repeats for each version.

| Scenario | Version | Login | Create entry | List clients | List entries | Report |
|---|---|---:|---:|---:|---:|---:|
| Workflow | Baseline | 45.30–54.95 | 96.33–121.76 | 64.20–75.03 | 71.60–87.91 | 82.74–99.78 |
| Workflow | Fixed | 70.21–72.95 | 136.23–137.73 | 69.49–70.94 | 73.08–74.13 | 102.50–104.47 |
| Ramp short | Baseline | 76.12–81.34 | 136.27–169.99 | 87.64–107.81 | 113.86–118.66 | 111.87–138.99 |
| Ramp short | Fixed | 78.83–79.00 | 126.32–139.38 | 73.83–74.04 | 76.81–81.88 | 105.17–107.55 |
| Breaking short | Baseline | 213.15–235.77 | 248.38–257.01 | 217.69–247.37 | 359.76–388.93 | 246.39–256.38 |
| Breaking short | Fixed | 196.92–212.99 | 290.63–304.18 | 182.71–187.58 | 216.80–231.89 | 226.30–226.96 |

## Login regression analysis

The login trend measures `POST /api/auth/login`. It is not bypassed by the
authenticated-user middleware cache, which protects the other workflow
requests. In the corrected full workflow repeats, login p95 was 45.30–54.95
ms baseline and 70.21–72.95 ms fixed; in the short ramp it was 76.12–81.34 ms
baseline and 78.83–79.00 ms fixed; in short breaking it was 213.15–235.77 ms
baseline and 196.92–212.99 ms fixed.

The apparent regression from the old single-run table is therefore not
reproduced consistently by the corrected repeats. The cache increased
throughput in the workflow and ramp runs, changing queueing and the number of
concurrent requests observed by the uncached login route. The summaries
support queueing/workload interaction as a plausible explanation, not a
direct cache slowdown of `/api/auth/login`; they do not prove a causal
mechanism.

The dedicated 30-second attribution repeats show the cache effect clearly:

| Version | Throughput (req/s) | p95 (ms) | Login p95 (ms) | Error rate |
|---|---:|---:|---:|---:|
| Control repeat 1 | 752.54 | 63.24 | 37.90 | 0.00% |
| Control repeat 2 | 924.43 | 29.26 | 15.92 | 0.00% |
| Cache repeat 1 | 871.55 | 44.75 | 31.50 | 0.00% |
| Cache repeat 2 | 1,019.64 | 20.71 | 14.89 | 0.00% |

Across these repeats, cache p95 was 20.71–44.75 ms versus control
29.26–63.24 ms, and throughput was 871.55–1,019.64 versus 752.54–924.43
requests/s. The overlap means the short-run improvement should be reported as
a range, not a single guaranteed percentage.

## Candidate attribution

The prior isolated candidate summaries remain saved and document the
discarded options:

| Candidate | Result |
|---|---|
| Composite `(user_email, client_id, date, created_at)` index | Discarded; 15.64 ms p95 and 1,081.00 req/s versus 15.29 ms and 1,083.13 req/s control |
| SQL report total aggregation | Discarded; slower at 21.83 ms p95 and 1,022.24 req/s |
| Bounded known-email auth cache | Retained; 9.60 ms p95 and 1,140.74 req/s in the original isolated attribution run |
| Morgan logging disabled | Discarded as a performance claim; 17.86 ms p95 and 1,089.39 req/s |

The cache is bounded at 1,000 entries per database object. Cache-enabled
logic is centralized in one helper, and newly inserted users are remembered
after successful insertion. Unknown-user creation and response shapes remain
unchanged. Morgan remains configurable, with `combined` as the default.

## Breaking-point evidence and limitations

The canonical full breaking run previously failed by crossing the p95
500 ms threshold, not through an HTTP error storm; the fixed run's HTTP
failure rate at that point was 0.00%. That old pair is not used for the
corrected before/after claim above. The corrected short profile completed
200 VUs with 0.00% failures, so its result is a bounded repeatability check,
not a replacement for a full canonical breaking-point run.

The earlier CPU sample captured 36 backend samples, averaging 73.4% and
peaking at 90.3% CPU. No usable Node `.cpuprofile` was captured after the
signal-based shutdown. Bottleneck ranking therefore rests on endpoint
latencies, response sizes, and CPU sampling rather than a CPU profile.

## Areas not fixed

- Replace in-memory SQLite and its single serialized connection for durable or
  multi-process deployments.
- Consider clustering or multiple Node workers; the app remains single-process.
- Bound the large unpaginated list and report payloads. Pagination was not
  added because it changes the API contract.
- Avoid writing a temporary CSV file to disk before `res.download`.
- Revisit the default global 100-requests/15-minutes-per-IP limiter, which is
  the practical shared-egress limit in deployment.
