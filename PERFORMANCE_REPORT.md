# Timesheet App Performance Report

## Executive summary

The corrected 50-VU baseline is **81.35–94.89 ms p95, 0.00% HTTP
failures, and 640.77–671.43 requests/s**. The shipped build, with ETag
generation disabled and the retained bounded auth cache enabled, measured
**77.41–77.70 ms p95, 0.00% failures, and 685.09–687.26 requests/s** in
repeated canonical runs. The isolated ETag attribution was a small but
consistent gain in this workload; the auth cache remains a correctness and
round-trip optimization rather than a separately proven canonical gain.

The extended breaking test restores a real threshold-defined answer. With the
common workload and abort-on-failure enabled, the baseline crossed the
500-ms p95 threshold at approximately **306–313 active VUs** across two runs.
The shipped build crossed it at approximately **333–339 active VUs**.
Both versions failed by latency, not an HTTP error storm: aggregate HTTP
failure rate was **0.00%** in all runs. The shipped range overlaps the prior
baseline range and does not establish a capacity increase.

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
  `RATE_LIMIT_MAX=0`, `ETAG_ENABLED=1`, and combined Morgan logging. Fixed
  runs enabled the cache and used `ETAG_ENABLED=0`. No candidate index or SQL
  aggregation change was active.
- Thresholds were p95 HTTP duration under 500 ms and HTTP failure rate under
  1%.
- Raw logs, CPU samples, and `.cpuprofile` files are ignored. Small JSON/TXT
  summaries were generated during the runs; only selected human-readable TXT
  summaries are committed.

After these measurements, the harness received a static-analysis-driven
refactor: client selection changed from random selection to deterministic
round-robin selection using `(__VU + __ITER) % n`, and the shared iteration
body was extracted into `runIteration`. The call mix and seed volumes stayed
the same, but the results were not regenerated against the refactored
scripts, so the reported numbers came from the pre-refactor harness.

## Corrected repeated measurements

### Workflow: 50 VUs for 3 minutes

| Version | Throughput (req/s) | p95 | p99 | Errors |
|---|---:|---:|---:|---:|
| Baseline 1 | 640.77 | 94.89 ms | 132.97 ms | 0.00% |
| Baseline 2 | 671.43 | 81.35 ms | 107.73 ms | 0.00% |
| Shipped 1 | 687.26 | 77.70 ms | 98.90 ms | 0.00% |
| Shipped 2 | 685.09 | 77.41 ms | 98.86 ms | 0.00% |

### Ramp: short 1→100 VUs

| Version | Throughput (req/s) | p95 range | p99 range | Errors |
|---|---:|---:|---:|---:|
| Baseline | 752.87–766.19 | 112.42–133.24 ms | 142.89–177.43 ms | 0.00% |
| Shipped | 855.41–858.18 | 94.71–95.75 ms | 127.20–127.43 ms | 0.00% |

### Extended breaking: 25→500 VUs, abort on threshold

| Version | Break estimate | Aggregate p95 | Aggregate p99 | Errors |
|---|---:|---:|---:|---:|
| Baseline 1 | ~306 VUs | 500.19 ms | 739.05 ms | 0.00% |
| Baseline 2 | ~313 VUs | 519.27 ms | 777.18 ms | 0.00% |
| Shipped 1 | ~333 VUs | 516.63 ms | 681.08 ms | 0.00% |
| Shipped 2 | ~339 VUs | 511.69 ms | 696.02 ms | 0.00% |

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

The crypto attribution is specific: the `node:internal/crypto/hash` `update`
and `digest` frames have `entitytag` as their caller at
`backend/node_modules/etag/index.js:39`. They are Express's ETag generation,
not Helmet or an unrelated dependency. Searches of frontend source, backend
source, and backend tests found no `If-None-Match`, `If-Modified-Since`, ETag,
or `304` handling. Axios and React Query provide client-side caching, not HTTP
conditional revalidation.

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
| Workflow | Shipped | 54.54–56.24 | 95.60–96.07 | 56.72–57.62 | 58.00–58.54 | 80.44–81.67 |
| Breaking extended | Baseline | 521.24–541.65 | 280.37–290.12 | 391.17–419.23 | 732.47–767.75 | 374.21–384.41 |
| Breaking extended | Shipped | 562.38–571.69 | 491.08–517.73 | 375.00–382.27 | 611.08–620.02 | 414.77–444.14 |

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

### ETag attribution A/B

These were fresh-seed, isolated 50-VU, 30-second repeats with the same
workload. ETag control was enabled; the candidate disabled it.

| Variant | p95 range | p99 range | Throughput range | Errors |
|---|---:|---:|---:|---:|
| ETag enabled | 13.72–14.21 ms | 20.54–23.58 ms | 1,097.48–1,100.22 req/s | 0.00% |
| ETag disabled | 12.63–13.88 ms | 19.56–25.32 ms | 1,104.69–1,116.69 req/s | 0.00% |

The p95 control and candidate bands were separated in these repeats, while
p99 overlapped. This supports retaining the change as a modest p95/throughput
gain, not as a guaranteed quarter-CPU reduction. ETag generation is disabled
by default (`ETAG_ENABLED`); set `ETAG_ENABLED=1` to restore Express's
conditional-response behavior. Disabling it removes automatic ETag-based
conditional GET/304 responses, which is the documented trade-off.

## Areas not fixed

- Replace in-memory SQLite and its single serialized connection for durable or
  multi-process deployments.
- Consider clustering or multiple Node workers; the app remains
  single-process.
- Bound large unpaginated list and report payloads. Pagination was not added
  because it changes the API contract.
- The profile shows this workload is CPU-bound in response serialization and
  the sqlite3 binding inside one Node process, rather than primarily blocked
  on a missing index or an N+1 query. The highest-leverage next steps are
  reducing payload size (pagination or field selection for report and
  work-entry list responses) and process-level scaling; neither was
  implemented because each is outside this task's API/deployment scope.
- Avoid writing a temporary CSV file to disk before `res.download`.
- Revisit the default global 100-requests/15-minutes-per-IP limiter, which is
  the practical shared-egress limit in deployment.
