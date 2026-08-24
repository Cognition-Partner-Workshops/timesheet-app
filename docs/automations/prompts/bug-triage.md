# Prompt — Bug triage

This is the exact prompt run by the "Bug Triage — timesheet-app" automation (trigger:
GitHub issue labeled `bug` in `Cognition-Partner-Workshops/timesheet-app`). Keep this file
and the automation in sync in one PR. Design and rubric:
[../bug-triage.md](../bug-triage.md).

---

A bug was reported in `Cognition-Partner-Workshops/timesheet-app`. The triggering issue
(number, title, body, labels) is in the trigger event payload. Triage it, post your
findings on that issue, and do not fix anything above trivial without confirmation.

## 1. Understand the report

Read the issue with the built-in git tools, including existing comments. Extract expected
behaviour, actual behaviour, steps, environment and error text. If there is no observable
symptom to chase, post what is missing and ask the reporter — do not invent a repro.

## 2. Reproduce before you diagnose

Work on a clean checkout of `main`.

- Backend: `cd backend && npm ci && npm test`, then `npm run dev` (port 3001) and exercise
  the reported request path directly.
- Frontend: `cd frontend && npm ci && npm run lint && npm run build`, then `npm run dev`
  (port 5173) and drive the reported UI flow in the browser.
- Capture the evidence: failing test output, HTTP status and response body, console error,
  or a screenshot of the broken UI.

If you cannot reproduce it, say so explicitly, list exactly what you tried and what you
would need from the reporter. Never mark an unreproducible report as low severity by
default.

## 3. Locate the responsible code path

Trace the symptom to concrete files and line ranges under `backend/src/` or
`frontend/src/` and state the chain (route → handler → query, or component → hook → API
call) plus the root cause: which expression or missing condition produces the observed
behaviour. Cite `path:line` for every claim. If the cause is outside those two trees
(infrastructure, an upstream dependency), report that and stop there.

## 4. Assess severity

- `S1 critical` — data loss/corruption, auth or authorization bypass, secret exposure, or
  the app unusable for everyone
- `S2 high` — a core flow (create/edit/submit/approve timesheet entries, login) broken
  with no workaround
- `S3 medium` — a non-core flow broken, or a core flow degraded with a workaround
- `S4 low` — cosmetic/copy or a rare edge case with no functional impact
- `unreproducible` — symptom did not occur; report what was tried

Justify the severity with the evidence from step 2.

## 5. Post findings — one comment on the triggering issue

Include, in this order: reproduction result (with the command/flow used and its output),
the responsible code path with `path:line` references, the root cause, the severity with
its justification, and a proposed fix with its size and risk.

## 6. Fix only what is trivial

**Trivial** (fix it in this run, in a PR — do not merge it): a typo, wrong string, wrong
constant, off-by-one in a single expression, or a missing null/undefined guard — confined
to one file, roughly under 10 changed lines, no schema/API/auth change, with existing
tests passing afterwards. Run `cd frontend && npm run lint`, `cd backend && npm test` and
`cd frontend && npm run build` before opening it, and link the PR in your comment.

**Everything else**: do not change any code. Post the proposed fix, its size, its risk and
the files it would touch, then ask on the issue for explicit confirmation before
proceeding, and stop. This includes schema/migration changes, auth or permission logic,
API contract changes, shared component or state refactors, anything touching more than one
file, anything needing a new test to prove the fix, and anything you are unsure about —
uncertainty counts as non-trivial.

## Guardrails

- Never edit, skip or loosen a test to make a failure disappear. If a test looks wrong,
  say so and stop.
- No unrelated changes: no dependency bumps, no refactors, no formatting sweeps.
- No secrets or real user data in the comment; redact anything sensitive from logs.
- Do not close, relabel or edit the reporter's issue, do not force-push or delete
  branches, and never touch live infrastructure.
- Exactly one findings comment per run.
- Time-box the reproduction: post what you have with the gaps named rather than guessing
  indefinitely.

## Human checkpoint

For anything above trivial, the run ends at "here is the fix I propose — confirm and I'll
do it". Resume only on an explicit go-ahead from a maintainer on the issue.
