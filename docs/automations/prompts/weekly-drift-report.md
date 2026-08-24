# Prompt — Weekly drift report

This is the exact prompt run by the "Weekly Drift Report — 3 repos" automation
(schedule: Mondays 06:00 UTC). Keep this file and the automation in sync in one PR.
Design, ranking and guardrail rationale: [../weekly-drift-report.md](../weekly-drift-report.md).

---

Produce this week's dependency drift report across three repositories and publish it,
with a ranked and sized remediation queue, as a single GitHub issue.

Repositories (clone each with the built-in git tools if it is not already on the box):

- `Cognition-Partner-Workshops/timesheet-app`
- `Cognition-Partner-Workshops/petclinic-microservices`
- `Cognition-Partner-Workshops/timesheet-infra`

## 1. Scan

Run each repository's own read-only scanner on a clean checkout of `main` and keep the
JSON output:

- `timesheet-app`: `python3 scripts/drift_scan.py --out /tmp/drift-timesheet-app.json`
  (run `npm ci` in `backend/` and `frontend/` first so `npm outdated`/`npm audit` see an
  installed tree; if `npm ci` fails, record it as a scan error and continue)
- `petclinic-microservices`: `python3 scripts/drift_scan.py --out /tmp/drift-petclinic.json`
  (add `--skip-maven` if `./mvnw dependency:list` cannot resolve; that fallback parses the
  poms directly and is recorded in `errors`)
- `timesheet-infra`: `python3 scripts/drift_scan.py --out /tmp/drift-infra.json`

Do not modify anything: no installs that write to `package.json`, no lockfile updates, no
`pom.xml` edits, no `terraform init`/`plan`/`apply`, no `.tf` or `.terraform.lock.hcl`
edits, no source changes. Do not create branches or PRs in any of the three repositories.

If a scanner exits non-zero or its `errors` array is non-empty, the report is **partial**.
Say so explicitly and list every error. Never present an unreachable registry or advisory
API as "no findings".

## 2. Report

Open one issue in `Cognition-Partner-Workshops/timesheet-app`:

- Title: `Drift report — <YYYY-MM-DD>`
- Label: `drift-report` (create the label if it does not exist)

Body sections, in this order:

1. **Scan health** — per repository: scanner status, fallbacks used, and every `errors`
   entry verbatim. State plainly whether the report is complete or partial.
2. **Summary** — totals by severity, by repository, and by size (`XS`/`S`/`M`/`L`).
3. **Advisories** — every item with `advisory_count > 0`, worst severity first, with
   advisory IDs, links, affected component, location, current and target version.
4. **Version drift** — dependency/plugin items grouped by repository, `current → latest`
   with the major/minor/patch gap.
5. **Terraform** — for each root under `timesheet-infra/terraform/`: provider and module
   constraint, lock-file pin, newest release. Call out where the declared constraint
   itself blocks the newest release (`constraint_allows_latest: false`) and where no
   `.terraform.lock.hcl` pins the version.
6. **Remediation queue** — see below.
7. **Raw data** — the three JSON documents in fenced blocks (truncate the `advisories`
   arrays if the body would exceed GitHub's size limit, and say that you truncated).

## 3. Remediation queue (input to the Track 2 fan-out)

A single table, ordered by `rank_score` descending across all three repositories, with
these columns: `rank`, `repo`, `component`, `location`, `current → target`,
`advisories`, `max severity`, `size`, `blast radius`, `evidence`.

- One row = one unit of work in one repository. Never bundle ("upgrade all Spring").
- `target` is a concrete released version. Never `latest`, never an unbounded range,
  never a prerelease.
- `blast radius`: which modules/workspaces/Terraform roots the change touches.
- `evidence`: the scanner location plus advisory IDs — enough for a worker to verify the
  row without re-deriving it.
- Keep component/location identity stable week over week so recurring rows are traceable.
- Cap the table at the top 25 rows and state the total count of remaining rows.

## Guardrails

- Read-only across all three repositories. No PRs, no commits, no upgrades, and do not
  start the fan-out yourself.
- No secrets in the issue: version metadata only — no tokens, no `.tfvars` values, no
  state contents.
- Do not open per-finding issues; exactly one issue per run.
- If a scan cannot be completed, publish the partial report rather than retrying
  indefinitely or skipping the report.

## Human checkpoint

Stop after the issue is published. The queue is a proposal: a maintainer decides which
rows get picked up and whether a Track 2 fan-out starts. End your final message with the
issue link and the top three rows.
