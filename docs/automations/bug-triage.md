# Automation 2 — Ticket-triggered bug triage

Every new bug report in `timesheet-app` gets a reproduction attempt, a named code path
and a severity before a human reads it — and nothing above a trivial fix happens
without a human saying so.

- **Scope:** `timesheet-app` only (`backend/src/`, `frontend/src/`)
- **Prompt:** [`prompts/bug-triage.md`](prompts/bug-triage.md)
- **Delivery:** a comment on the triggering issue

## Trigger

GitHub issue event on `Cognition-Partner-Workshops/timesheet-app` where the issue
carries the label `bug`:

- `action = opened` with the `bug` label, or
- `action = labeled` with `label.name = bug` (so triage still fires when a maintainer
  triages an existing report into the bug queue).

Issues without the `bug` label are ignored; the label is the intake gate, which keeps
questions and feature requests out of the reproduction loop.

## Procedure

1. **Read the report.** Extract expected vs. actual behaviour, steps, environment and
   any error text. If the report has no observable symptom at all, say so and ask the
   reporter for the missing detail instead of guessing.
2. **Reproduce first.** Install, run `cd backend && npm test` and the relevant flows;
   start `backend` (port 3001) and `frontend` (port 5173) when the symptom is
   user-visible. Reproduction is attempted *before* any severity claim.
3. **Locate the responsible code path.** Follow the failing behaviour to specific files
   and line ranges under `backend/src/` or `frontend/src/`, then state the call chain
   (route → handler → query, or component → hook → API call) and the root cause.
4. **Assess severity** with the rubric below.
5. **Post findings** as one comment on the issue: reproduction result, code path,
   root cause, severity with justification, and a proposed fix with its size.
6. **Stop and ask** unless the fix is trivial (see below).

## Severity rubric

| Severity | Criteria |
| --- | --- |
| `S1 critical` | data loss or corruption, auth/authorization bypass, secret exposure, or the app unusable for all users |
| `S2 high` | a core timesheet flow (create/edit/submit/approve entries, login) broken with no workaround |
| `S3 medium` | a non-core flow broken, or a core flow degraded but with a workaround |
| `S4 low` | cosmetic, copy, or a rare edge case with no functional impact |
| `unreproducible` | the symptom did not occur — reported with exactly what was tried, never silently downgraded |

Severity is reported with the evidence that justifies it (failing test, HTTP status,
console error, screenshot), so the label is auditable rather than a feeling.

## Trivial vs. everything else

**Trivial** — may be fixed in the same run, in a PR, without waiting:

- a typo, a wrong string/label, a wrong constant or off-by-one in one expression
- a missing null/undefined guard in one function
- confined to a single file, under roughly 10 changed lines, no schema/API/auth change,
  and covered by existing tests that pass

**Everything else waits**: schema or migration changes, auth or permission logic,
API contract changes, shared component or state refactors, anything touching more than
one file or needing a new test to prove the fix, and anything the automation is not
certain about. Uncertainty counts as non-trivial.

## Guardrails

- **Reproduce before diagnosing.** No severity, no root cause and no fix without either
  a reproduction or an explicit statement that reproduction failed and why.
- **No fix above trivial without confirmation** — see the human checkpoint.
- **Never weaken tests.** No editing, skipping or loosening a test to make a failure go
  away; if a test looks wrong, say so and stop.
- **No production behaviour changes as a side effect** of triage: no dependency bumps,
  no refactors, no formatting sweeps, no unrelated file edits.
- **No secrets in comments.** No tokens, connection strings, `.env` contents or real
  user data; redact anything sensitive pulled from logs.
- **No destructive actions.** Never delete or force-push branches, never close or
  relabel the reporter's issue, never touch production or live infrastructure.
- **One comment per triage run,** so the issue stays readable.
- **Stay in `timesheet-app`.** A cause outside `backend/src/` or `frontend/src/`
  (infrastructure, upstream dependency) is reported, not fixed here.
- **Time-boxed.** If reproduction does not succeed within the run, post what was tried
  and what is missing rather than continuing to guess.

## Human checkpoint

**The confirmation gate on the issue.** For anything above trivial, the automation posts
its findings plus a proposed fix and size, then explicitly asks for confirmation and
stops. It resumes only when a maintainer replies on the issue with an explicit go-ahead.
Trivial fixes still land as a PR for review — nothing is merged by the automation.
