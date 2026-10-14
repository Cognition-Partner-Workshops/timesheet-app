# Always-on automations

Two Devin Automations run against this repository. Both are defined in the Devin
Automations UI; this directory holds their reviewable source of truth: the design,
the guardrails, and the exact prompt each one runs.

| Automation | Trigger | Human checkpoint |
| --- | --- | --- |
| [Weekly drift report](weekly-drift-report.md) | Schedule — Mondays 06:00 UTC | Nobody may act on the queue until a maintainer picks items; the automation never opens remediation PRs |
| [Bug triage](bug-triage.md) | GitHub issue labeled `bug` in this repo | Anything above a trivial fix waits for an explicit "go ahead" comment on the issue |

Both automations run as their creator (creator permissions, visible to the creator
and org admins) and deliver everything to GitHub — no Slack, no email fan-out.

Prompts live in [`prompts/`](prompts/) and are the text pasted into each automation.
Change the prompt file and the automation together, in the same PR, so the repo never
disagrees with what actually runs.

## Scanners

Each repository in scope carries its own read-only scanner that emits the same
normalized JSON, so the weekly report is reproducible rather than hand-assembled:

- `timesheet-app` — [`scripts/drift_scan.py`](../../scripts/drift_scan.py) (npm workspaces, GitHub advisories via `npm audit`)
- `petclinic-microservices` — `scripts/drift_scan.py` (Maven coordinates, Maven Central, OSV.dev)
- `timesheet-infra` — `scripts/drift_scan.py` (Terraform providers, registry modules, `required_version`)

The shared item schema, ranking formula, and sizing rubric are documented in
[weekly-drift-report.md](weekly-drift-report.md#normalized-scanner-output).
