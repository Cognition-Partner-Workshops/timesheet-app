# SAST Auto-Remediation Architecture

This document describes the automated security-scanning and AI-assisted remediation pipelines in the **timesheet-app** repository.

---

## Overview

The repository ships three GitHub Actions workflows that form a layered security gate:

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| **PR Quality Checks** | `pr-checks.yml` | `pull_request` | npm audit + test coverage gate with Devin CVE auto-fix |
| **SAST Scan (SonarCloud)** | `sast-scan.yml` | `check_run` | Triggers Devin when SonarCloud quality gate fails |
| **SAST Auto-Remediate** | `sast-auto-remediate.yml` | `pull_request` | npm audit + Trivy container scan with Devin remediation and re-scan verification |

---

## SAST Auto-Remediate Pipeline (`sast-auto-remediate.yml`)

### Trigger

```
pull_request: [opened, reopened, synchronize]
branches: [main]
```

The workflow runs on every PR targeting `main` that is **not** authored by `devin-ai-integration[bot]`. This prevents infinite loops where a Devin-created PR re-triggers itself.

### Job Graph

```
┌─────────────────────────────┐
│          scan                │  Runs on every qualifying event
│  npm audit  +  Trivy image  │
└──────────┬──────────────────┘
           │ outputs: has_findings, totals, details
           ├──────────────────────────────────┐
           ▼                                  ▼
┌──────────────────────┐           ┌─────────────────────┐
│     remediate        │           │       verify         │
│ (opened / reopened)  │           │   (synchronize)      │
│                      │           │                      │
│ 1. Guard: skip if    │           │ 1. Guard: skip if no │
│    Devin already     │           │    prior remediation │
│    triggered         │           │    comment           │
│ 2. Post findings     │           │ 2. Post verification │
│    comment on PR     │           │    comment:          │
│ 3. Invoke Devin v3   │           │    ✓ resolved        │
│    API to remediate  │           │    ✗ still failing   │
└──────────────────────┘           └─────────────────────┘
```

### 1. `scan` Job

Runs on **every** qualifying PR event (opened, reopened, synchronize).

| Step | Tool | Description |
|------|------|-------------|
| Checkout | `actions/checkout@v4` | Fetch PR branch |
| Setup Node.js | `actions/setup-node@v4` | Node 20 for `npm audit` |
| npm audit | `npm audit --json` | Scans **both** `frontend/` and `backend/` dependencies. Counts HIGH + CRITICAL vulnerabilities. |
| Build Docker image | `docker build` | Builds from `docker/Dockerfile` (multi-stage: frontend builder → backend builder → production) |
| Trivy container scan | `aquasecurity/trivy-action` | Scans the built image for OS package and library CVEs at HIGH/CRITICAL severity |
| Summarize | Shell | Aggregates counts and details into structured outputs (`has_findings`, `total_severe`, markdown summary) |

**Outputs** (passed to downstream jobs):

- `has_findings` — `"true"` / `"false"`
- `total_severe` — integer count of HIGH + CRITICAL across both tools
- `npm_high`, `npm_critical`, `npm_details` — npm audit breakdown
- `trivy_high`, `trivy_critical`, `trivy_details` — Trivy breakdown
- `findings_summary` — pre-built markdown table for comments

### 2. `remediate` Job

Runs only when `scan.has_findings == 'true'`.

**Guard:** checks PR comments for a prior `SAST Auto-Remediate` comment. If one exists the job exits early (max one Devin attempt per PR).

**Comment:** posts a structured findings summary on the PR so the author has immediate visibility.

**Devin API call:**

```
POST https://api.devin.ai/v3/organizations/{org}/sessions
```

Payload includes:
- A detailed prompt listing every npm audit CVE and Trivy finding.
- Instructions to fix packages / Dockerfile and run tests.
- The PR branch so Devin pushes directly to it.
- Tags: `sast-fix`, `npm-audit`, `trivy`, `security`, `automated`.

Required secrets:
- `DEVIN_API_KEY` — Devin API bearer token
- `DEVIN_ORG_ID` — organization identifier
- `DEVIN_CREATE_AS_USER_ID` — user identity for session creation

### 3. `verify` Job (Re-Scan)

Runs only on `synchronize` events (new pushes to the PR branch).

**Guard:** checks for a prior `SAST Auto-Remediate` comment. If none exists the job exits early — verification is only relevant after a Devin remediation attempt.

**Verification:** uses the `scan` job outputs (which re-ran on this synchronize event) to determine whether findings are resolved:

- **Resolved:** posts a success comment confirming all HIGH/CRITICAL findings are gone.
- **Still failing:** posts a warning with the remaining findings summary, indicating manual intervention may be needed.

This creates a closed feedback loop:

```
PR opened  →  scan  →  findings  →  Devin fix  →  push  →  re-scan  →  verify
```

---

## Existing Workflows

### `sast-scan.yml` — SonarCloud Remediation

Triggers on `check_run` completion when:
1. The check is from `sonarqubecloud`.
2. The conclusion is `failure`.
3. The check is associated with an open PR.

Invokes Devin with a prompt containing the SonarCloud dashboard link and specific instructions for SQL injection, command injection, code injection, and path traversal fixes.

### `pr-checks.yml` — PR Quality Checks

Contains two independent quality gates:
- **Security Audit:** runs `npm audit` on `frontend/`, posts findings, and triggers Devin CVE auto-fix if vulnerabilities are found.
- **Test Coverage:** runs frontend test coverage and posts a report if coverage falls below 80%.

Both gates skip PRs from Devin to avoid re-triggering loops.

---

## Secrets

All three workflows share the same GitHub Actions secrets:

| Secret | Purpose |
|--------|---------|
| `DEVIN_API_KEY` | Bearer token for the Devin v3 API |
| `DEVIN_ORG_ID` | Devin organization identifier |
| `DEVIN_CREATE_AS_USER_ID` | User identity for automated session creation |

---

## Concurrency & Safety

- **Concurrency groups** on `sast-remediate-{PR#}` and `sast-fix-{PR#}` cancel superseded runs, preventing multiple concurrent remediation sessions for the same PR.
- **One-time guard** comments prevent Devin from being triggered more than once per PR in each workflow.
- **Bot exclusion** (`devin-ai-integration[bot]` author check) prevents infinite trigger loops.

---

## Data Flow Diagram

```
┌───────────┐     pull_request      ┌──────────────────────────┐
│ Developer │ ───────────────────▶  │  sast-auto-remediate.yml │
│  opens PR │                       │                          │
└───────────┘                       │  ┌─────────────────────┐ │
                                    │  │ scan job             │ │
                                    │  │  npm audit (FE+BE)  │ │
                                    │  │  Trivy image scan   │ │
                                    │  └────────┬────────────┘ │
                                    │           │              │
                                    │     has_findings?        │
                                    │      ╱          ╲        │
                                    │    yes           no      │
                                    │    │             └─ done │
                                    │    ▼                     │
                                    │  ┌─────────────────────┐ │
                                    │  │ remediate job       │ │
                                    │  │  Post comment       │ │
                                    │  │  Call Devin API     │ │──────▶ Devin session
                                    │  └─────────────────────┘ │        pushes fix
                                    └──────────────────────────┘            │
                                                                           │
                                    ┌──────────────────────────┐           │
                                    │  sast-auto-remediate.yml │ ◀─────────┘
                                    │  (synchronize event)     │
                                    │                          │
                                    │  ┌─────────────────────┐ │
                                    │  │ scan job (re-scan)  │ │
                                    │  └────────┬────────────┘ │
                                    │           │              │
                                    │  ┌────────▼────────────┐ │
                                    │  │ verify job          │ │
                                    │  │  Post verification  │ │
                                    │  │  comment on PR      │ │
                                    │  └─────────────────────┘ │
                                    └──────────────────────────┘
```
