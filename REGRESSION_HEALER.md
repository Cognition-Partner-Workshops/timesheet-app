# Regression Healer Architecture

Automated test failure detection, reporting, and remediation via GitHub Actions and the Devin API.

## Event-Driven Flow

```
push (any branch)
  │
  ▼
┌─────────────────────────┐
│  Actor filter            │  ── devin-ai-integration[bot] ──► SKIP (prevent loops)
│  (github.actor check)   │
└──────────┬──────────────┘
           │ human / other bot
           ▼
┌─────────────────────────┐
│  run-tests              │
│  (npm run test:ci)      │──── all pass ──► DONE (no action)
└──────────┬──────────────┘
           │ failures detected
           ▼
┌─────────────────────────┐
│  report-and-heal        │
│                         │
│  1. Find open PR        │──── no PR ──► SKIP (nothing to comment on)
│  2. Circuit breaker     │
│  3. Post PR comment     │
│  4. Decide next action  │
└──────┬──────────┬───────┘
       │          │
  CB not tripped  CB tripped (≥3)
       │          │
       ▼          ▼
  Trigger Devin   Create GitHub Issue
  auto-fix        for human review
```

## Trigger Conditions

| Condition | Behavior |
|-----------|----------|
| Push to any branch | Workflow runs |
| Push by `devin-ai-integration[bot]` | Workflow skipped (loop prevention) |
| All tests pass | Workflow completes, no downstream jobs |
| Tests fail, open PR exists | PR comment posted, healing attempted |
| Tests fail, no open PR | Workflow completes, no comment posted |
| Circuit breaker tripped | GitHub Issue created, Devin NOT triggered |

## Jobs

### `run-tests`

Runs the backend Jest test suite (`npm run test:ci`) with JSON output. Parses the Jest results to extract:

- **Failed test names** — full path including `describe` ancestry (e.g. `Auth Routes > POST /api/auth/login > should return 400 for invalid email`)
- **Failure summary** — assertion error messages from `expect()` matchers
- **Error log** — full stack traces for debugging

Outputs are passed to the next job via `GITHUB_OUTPUT`.

### `report-and-heal`

Orchestrates failure reporting and remediation:

1. **Find PR** — queries the GitHub API for an open PR matching the pushed branch.
2. **Circuit breaker** — inspects previous Regression Healer comments on the PR (identified by `REGRESSION_HEALER_DATA` markers) to count consecutive failures per test.
3. **Post PR comment** — summarizes which tests failed, includes error details and stack traces, and records structured failure data for future circuit breaker checks.
4. **Escalate or heal** — either creates a GitHub Issue (circuit breaker) or triggers a Devin session (auto-fix).

## Circuit Breaker

### Purpose

Prevents infinite remediation loops where Devin repeatedly fails to fix the same test.

### Mechanism

Each PR comment posted by the Regression Healer embeds a hidden data payload:

```html
<!-- REGRESSION_HEALER_DATA:["test name 1","test name 2"]-->
```

When a new failure occurs, the workflow:

1. Fetches all previous Regression Healer comments on the PR
2. For each currently failing test, walks backward through historical comments
3. Counts consecutive appearances (stops counting when the test is absent from a comment)
4. Adds 1 for the current failure

### Threshold

**3 consecutive failures** of the same test triggers escalation.

### Escalation

When the circuit breaker trips:

- A **GitHub Issue** is created with:
  - Title: `[Regression Healer] Circuit breaker tripped on PR #<number>`
  - Labels: `regression`, `needs-human-review`
  - Body: table of repeatedly failing tests, error output, recommended actions
- The PR comment notes the circuit breaker status
- **Devin is NOT triggered** — automated remediation is suspended for this branch

### Recovery

Push a new commit to the branch to reset the cycle. The circuit breaker counts consecutive failures, so a passing run (or a run without that specific test failing) resets the counter.

## Escalation Policy

| Consecutive Failures | Action |
|---------------------|--------|
| 1 | Post PR comment, trigger Devin auto-fix |
| 2 | Post PR comment, trigger Devin auto-fix |
| 3+ | Post PR comment, create GitHub Issue, suspend auto-fix |

## Concurrency

The `report-and-heal` job uses a concurrency group keyed on `regression-healer-${{ github.ref }}` with `cancel-in-progress: true`. This ensures only the latest push on a branch is processed, avoiding stale comments from superseded commits.

## Permissions

| Permission | Scope | Purpose |
|------------|-------|---------|
| `contents: read` | Repository | Checkout code, read files |
| `pull-requests: write` | Repository | Post PR comments |
| `issues: write` | Repository | Create escalation issues |

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `DEVIN_API_KEY` | Authenticate with the Devin v3 API |
| `DEVIN_ORG_ID` | Devin organization identifier |
| `DEVIN_CREATE_AS_USER_ID` | User ID for Devin session creation |

## Relationship to Other Workflows

| Workflow | Trigger | Focus |
|----------|---------|-------|
| `pr-checks.yml` | PR opened/synced to main | Security audit (npm), test coverage gate, CVE auto-fix |
| `sast-scan.yml` | SonarCloud check_run | SAST vulnerability auto-fix |
| `test-regression-healer.yml` | Push to any branch | Test failure detection, reporting, and auto-fix with circuit breaker |

The Regression Healer complements `pr-checks.yml` by catching test regressions on _any_ push (not just PRs to main) and adding automated remediation with escalation safeguards.
