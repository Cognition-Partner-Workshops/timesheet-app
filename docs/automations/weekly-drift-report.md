# Automation 1 — Weekly drift report

One report per week covering three repositories, plus a ranked and sized
remediation queue that a Track 2 fan-out consumes item by item.

- **Scope:** `petclinic-microservices`, `timesheet-app`, `timesheet-infra`
- **Prompt:** [`prompts/weekly-drift-report.md`](prompts/weekly-drift-report.md)
- **Delivery:** a single GitHub issue in `timesheet-app`, labeled `drift-report`

## Trigger

Schedule — **every Monday at 06:00 UTC** (`FREQ=WEEKLY;BYDAY=MO;BYHOUR=6;BYMINUTE=0`),
one run at a time. Monday morning means the queue exists before the week is planned;
serializing runs means a slow scan can never overlap the next one and produce two
competing reports.

There is no push or PR trigger: drift is a function of *upstream* releases, not of
this week's commits, so scanning on commit would add noise without adding findings.

## What is collected

| Repository | Scanner | Sources |
| --- | --- | --- |
| `timesheet-app` | `scripts/drift_scan.py` | `npm outdated` for `backend/` and `frontend/`, `npm audit` for advisories |
| `petclinic-microservices` | `scripts/drift_scan.py` | `mvn dependency:list` (falls back to parsing every `pom.xml`), Maven Central `maven-metadata.xml`, OSV.dev for advisories, `<java.version>` vs. newest Java LTS |
| `timesheet-infra` | `scripts/drift_scan.py` | `required_providers` and `.terraform.lock.hcl` in every root under `terraform/`, registry modules, `required_version`, Terraform Registry + HashiCorp releases API |

Each scanner is read-only and self-contained: no installs, no `terraform init`, no
plugin that rewrites versions, no state access.

## Normalized scanner output

All three scanners emit the same document, validated against
[`remediation-queue.schema.json`](remediation-queue.schema.json). That is what makes
one report out of three ecosystems possible, and it is the contract the fan-out reads.

Per item: `component`, `ecosystem`, `kind`, `location`, `current`, `latest`,
`exposure`, `gap` (major/minor/patch), `advisories` (id, severity, summary, url),
`advisory_count`, `rank_score`, `size`. Terraform items add `constraint`,
`constraint_allows_latest` and `pinned_by_lockfile`.

### Ranking

`rank_score` = worst advisory severity (CRITICAL 50 / HIGH 30 / MODERATE 12 / LOW 4)
\+ advisory volume (5 per extra advisory, capped at 15)
\+ staleness (8 per major behind capped at 24, minor behind capped at 6-8, +2 for patch)
\+ exposure (runtime and provider weigh more than dev/test/plugin).

The report sorts across all three repositories by this score, so a CRITICAL advisory
in a Terraform provider outranks a cosmetic major bump in a dev dependency without
anyone arbitrating by hand.

### Sizing

| Size | Meaning | Rough effort |
| --- | --- | --- |
| `XS` | lockfile-only or patch bump | minutes, no review risk |
| `S` | one manifest bump inside the same major | one short session |
| `M` | breaking major in a single component | one session, needs tests read |
| `L` | high blast radius: Spring Boot parent, Spring Cloud BOM, React/Vite/TypeScript, `hashicorp/aws`, Java or Terraform itself | multiple sessions, needs a plan first |

## Report layout

The issue body contains, in order:

1. **Scan health** — per repository: scanner exit state and every entry from `errors`.
   A run with errors is published as *partial*, never as clean.
2. **Summary** — counts by severity, by repository, and by size.
3. **Advisories** — every item with `advisory_count > 0`, highest severity first.
4. **Version drift** — dependency and plugin items, grouped by repository.
5. **Terraform** — providers and modules per root under `timesheet-infra/terraform/`,
   flagging where the constraint (`~> 5.0`) itself blocks the newest release and where
   no `.terraform.lock.hcl` pins the version.
6. **Remediation queue** — the fan-out input (below).

## Remediation queue — Track 2 fan-out contract

The queue is a table of the top items, each row carrying everything a fan-out worker
needs to start without re-deriving anything:

`rank` · `repo` · `component` · `location` · `current` → `target` · `advisories`
· `severity` · `size` · `blast radius` · `evidence`

Rules that keep the queue machine-consumable:

- One row is one unit of work in one repository — never "upgrade all Spring".
- `target` is always a concrete released version. Never `latest`, never an unbounded
  range, never a prerelease.
- Rows are ordered by `rank_score` and are stable: a row that reappears next week keeps
  the same component/location identity so progress is visible across reports.
- The raw JSON for all three repositories is attached to the issue as a fenced block or
  gist link, so a worker can consume the queue programmatically instead of parsing prose.

## Guardrails

- **Read-only.** No dependency, lockfile, `pom.xml`, `package.json`, `.tf` or source
  edits during a drift run.
- **No autonomous remediation.** The automation never opens upgrade PRs and never
  starts the fan-out. It publishes one issue and stops.
- **No silent green.** Every failed registry/advisory lookup is reported in *Scan
  health*; an unreachable API is a partial scan, not an absence of findings.
- **Evidence required.** Every queue row cites location, current version, target
  version, advisory IDs and severity — no unsourced claims.
- **No `latest`, no unbounded ranges** as a recommendation.
- **One issue per run.** Reuse the label `drift-report`; do not spam per-finding issues.
- **No secrets.** Scanner output is version metadata only; tokens, state files and
  `.tfvars` values never appear in the issue.
- **Bounded runtime.** If a scanner cannot finish, report the partial result rather
  than retrying indefinitely.

## Human checkpoint

**The queue is a proposal.** The automation stops at the published issue; a maintainer
decides which rows are picked up, in what order, and whether any `L` row needs a design
discussion first. Nothing is upgraded — and no Track 2 fan-out is started — until a
maintainer says so on the issue.
