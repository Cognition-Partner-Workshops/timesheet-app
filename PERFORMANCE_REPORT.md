# Timesheet App Performance Report

## Executive summary

The corrected 50-VU baseline is **81.35–94.89 ms p95, 0.00% HTTP
failures, and 640.77–671.43 requests/s**. The cache-enabled build measured
**96.81–97.42 ms p95, 0.00% failures, and 675.62–677.14 requests/s**. The
canonical workflow result is therefore flat to worse on latency; the
attribution runs were directionally positive but do not establish a reliable
scenario-level gain.

The extended breaking test restores a real threshold-defined answer. With the
common workload and abort-on-failure enabled, the baseline crossed the
500-ms p95 threshold at approximately **306–313 active VUs** across two runs.
The cache-enabled build crossed it at approximately **319–326 active VUs**.
Both versions failed by latency, not an HTTP error storm: aggregate HTTP
failure rate was **0.00%** in all four runs. The observed ranges overlap
enough that this is a noisy capacity difference, not evidence that the cache
raises the production capacity ceiling.

The deployment-critical finding is separate: the shipped default global
limiter allows **100 requests per 15 minutes per IP**. Shared-egress users can
receive 429 responses at roughly 100 requests, long before backend concurrency
is reached. Load runs disabled that limiter with `RATE_LIMIT_MAX=0`.

The bounded authentication cache is retained as a correct, bounded,
behavior-preserving optimization, but the recommendation is **not to claim it
as a proven canonical performance fix**. The profile shows meaningful SQLite
binding/trace activity overall, but cannot isolate the `users` lookup, and the
canonical 50-VU p95 is flat to worse. Treat the cache as optional and harmless
until a workload specifically dominated by repeated authentication lookups
shows a stable gain.

## Methodology and environment

- 8 CPU cores, 31 GB RAM, k6 v2.1.0.
- Express, single-process Node, and in-memory SQLite with a serialized
  connection.
- k6 and the backend were co-located; results are not projections for a
  separately provisioned production topology.
- Each run started a fresh database with 20 clients and 3,000 work entries.
- Every measured iteration used login, create entry, list entries, list
  clients, report, and a 0.2-second pause.
- Baseline-equivalent runs used `AUTH_CACHE_ENABLED=0`,
  `RATE_LIMIT_MAX=0`, and combined Morgan logging. Fixed runs enabled the
  cache. No candidate index or SQL aggregation change was active.
- Thresholds were p95 HTTP duration under 500 ms and HTTP failure rate under
  1%.
- Raw logs, CPU samples, and `.cpuprofile` files are ignored. Small JSON/TXT
  summaries are committed.

## Corrected repeated measurements

### Workflow: 50 VUs for 3 minutes

| Version | Throughput (req/s) | p95 | p99 | Errors |
|---|---:|---:|---:|---:|
| Baseline 1 | 640.77 | 94.89 ms | 132.97 ms | 0.00% |
| Baseline 2 | 671.43 | 81.35 ms | 107.73 ms | 0.00% |
| Fixed 1 | 677.14 | 96.81 ms | 143.24 ms | 0.00% |
| Fixed 2 | 675.62 | 97.42 ms | 141.00 ms | 0.00% |

### Ramp: short 1→100 VUs

| Version | Throughput (req/s) | p95 range | p99 range | Errors |
|---|---:|---:|---:|---:|
| Baseline | 752.87–766.19 | 112.42–133.24 ms | 142.89–177.43 ms | 0.00% |
| Fixed | 814.68–820.72 | 98.60–105.64 ms | 128.49–143.19 ms | 0.00% |

### Extended breaking: 25→500 VUs, abort on threshold

| Version | Break estimate | Aggregate p95 | Aggregate p99 | Errors |
|---|---:|---:|---:|---:|
| Baseline 1 | ~306 VUs | 500.19 ms | 739.05 ms | 0.00% |
| Baseline 2 | ~313 VUs | 519.27 ms | 777.18 ms | 0.00% |
| Fixed 1 | ~326 VUs | 503.18 ms | 658.85 ms | 0.00% |
| Fixed 2 | ~319 VUs | 511.98 ms | 879.54 ms | 0.00% |

The break estimate is the active-VU level reported when the p95 threshold
caused the run to abort. No run reached the 500-VU target. The four runs
returned no timeouts, connection resets, or 5xx storm: the failure mode was
pure latency threshold violation. The baseline range and fixed range overlap
in the context of run-to-run variability; the cache does not establish a
defensible breaking-point improvement.

## Profile-backed CPU evidence

An in-process Node `inspector.Session` wrapper started and stopped the V8
profiler explicitly and wrote `phase4-profile-w50b.cpuprofile`, avoiding the
signal-flush problem of the earlier attempt. The 60-second 50-VU profile had
61,374 total samples. Excluding V8 program/idle/GC frames, the largest
aggregated self-time categories were:

| Profile category | Samples | Share of non-idle samples |
|---|---:|---:|
| sqlite3 binding/trace | 4,868 | 18.9% |
| Express response `stringify` | 4,178 | 16.2% |
| Stream writes | 1,663 | 6.5% |
| Morgan logger | 1,418 | 5.5% |
| Crypto hash updates | 1,329 | 5.2% |

The profile supports a ranking led by SQLite binding/trace work and response
serialization, followed by output/logging overhead. It does **not** prove
that the `users` SELECT is a material share of CPU: the profile has no
query-level attribution, and the cache-enabled canonical workflow p95 was not
better. The honest conclusion is that the auth cache is a micro-optimization
under this workload, not a demonstrated bottleneck fix.

During the extended breaking runs, sampled process CPU reached **91.9–94.0%
for Node** and about **33% for k6**. During the profiled 50-VU run, Node
averaged about **82.5%** and reached **106%** of the `ps` CPU scale, while k6
averaged about **25.9%** and reached **27.6%**. The load generator was not
the limiting process; the co-located Node process approached one saturated
core at the break.

## Endpoint and candidate evidence

The corrected endpoint p95 ranges from the two canonical repeats were:

| Scenario | Version | Login | Create | Clients | Entries | Report |
|---|---|---:|---:|---:|---:|---:|
| Workflow | Baseline | 45.30–54.95 | 96.33–121.76 | 64.20–75.03 | 71.60–87.91 | 82.74–99.78 |
| Workflow | Fixed | 70.21–72.95 | 136.23–137.73 | 69.49–70.94 | 73.08–74.13 | 102.50–104.47 |
| Breaking extended | Baseline | 521.24–541.65 | 280.37–290.12 | 391.17–419.23 | 732.47–767.75 | 374.21–384.41 |
| Breaking extended | Fixed | 553.62–636.69 | 488.01–502.82 | 372.93–383.49 | 599.88–694.59 | 419.46–428.62 |

The login trend is `POST /api/auth/login`, which is not bypassed by the
authenticated-user middleware cache. Its variation tracks the heavily queued
breaking runs and does not demonstrate that the cache directly slows login.

Earlier isolated candidate measurements remain:

| Candidate | Result |
|---|---|
| Composite work-entry/report index | Discarded: 15.64 ms p95 and 1,081.00 req/s vs 15.29 ms and 1,083.13 req/s control |
| SQL report aggregation | Discarded: 21.83 ms p95 and 1,022.24 req/s; slower |
| Bounded auth cache | Retained as correct and harmless; isolated result was 9.60 ms p95 and 1,140.74 req/s, but canonical gain is unproven |
| Morgan disabled | Discarded as a performance claim: 17.86 ms p95 and 1,089.39 req/s |

## Areas not fixed

- Replace in-memory SQLite and its single serialized connection for durable or
  multi-process deployments.
- Consider clustering or multiple Node workers; the app remains
  single-process.
- Bound large unpaginated list and report payloads. Pagination was not added
  because it changes the API contract.
- Avoid writing a temporary CSV file to disk before `res.download`.
- Revisit the default global 100-requests/15-minutes-per-IP limiter, which is
  the practical shared-egress limit in deployment.
