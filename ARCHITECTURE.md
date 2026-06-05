# SAST Auto-Remediation Architecture

This document describes the automated security scanning and AI-driven remediation pipeline implemented in this repository.

## Overview

The repository uses two complementary GitHub Actions workflows to detect and automatically fix security vulnerabilities:

| Workflow | Trigger | Scanner | Remediation Target |
|----------|---------|---------|-------------------|
| `sast-scan.yml` | SonarCloud check_run failure | SonarCloud (SAST) | Code-level security issues (SQLi, XSS, etc.) |
| `sast-auto-remediate.yml` | PR opened/synchronized | npm audit + Trivy | Dependency CVEs + container image vulnerabilities |

Both workflows follow the same pattern: **detect → summarize → trigger Devin → verify**.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Pull Request Opened                              │
│                    (by user ≠ devin-ai-integration[bot])                  │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
                          ▼
          ┌───────────────────────────────────┐
          │        Parallel Scan Jobs          │
          │                                    │
          │  ┌──────────────┐ ┌─────────────┐ │
          │  │  npm audit   │ │   Trivy     │ │
          │  │  (frontend + │ │  (container │ │
          │  │   backend)   │ │   image)    │ │
          │  └──────┬───────┘ └──────┬──────┘ │
          └─────────┼────────────────┼────────┘
                    │                │
                    ▼                ▼
          ┌───────────────────────────────────┐
          │    Findings? (HIGH or CRITICAL)    │
          └─────────┬─────────────┬───────────┘
                    │             │
              has findings    no findings
                    │             │
                    ▼             ▼
     ┌──────────────────┐   ┌──────────────────────┐
     │ trigger-          │   │ verify-fix           │
     │ remediation       │   │ (post-remediation    │
     │                   │   │  re-scan check)      │
     │ 1. Guard check    │   │                      │
     │ 2. PR comment     │   │ Posts "Verified ✅"   │
     │ 3. Devin API call │   │ if prior remediation │
     └────────┬──────────┘   │ session existed      │
              │               └──────────────────────┘
              ▼
     ┌──────────────────┐
     │  Devin Session   │
     │                  │
     │ • Checks out PR  │
     │   branch         │
     │ • Upgrades deps  │
     │ • Patches image  │
     │ • Runs tests     │
     │ • Pushes fix     │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │  Push triggers   │
     │  workflow again   │──── Re-scan (verify-fix job)
     │  (synchronize)   │
     └──────────────────┘
```

---

## Workflow: `sast-auto-remediate.yml`

### Trigger Conditions

- **Event:** `pull_request` (opened, synchronize, reopened) targeting `main`
- **Author filter:** Skips PRs authored by `devin-ai-integration[bot]` to prevent infinite loops
- **One-time guard:** Checks PR comments for prior remediation attempts — triggers at most once per PR

### Jobs

#### 1. `npm-audit` — Dependency CVE Scan

Installs dependencies in `frontend/` and `backend/`, runs `npm audit --json`, and parses results for HIGH/CRITICAL vulnerabilities.

**Outputs:** `has_findings`, `total_severe`, `high`, `critical`, `findings_summary`

#### 2. `trivy-scan` — Container Image Scan

Builds the Docker image from `docker/Dockerfile` and scans it with [Trivy](https://github.com/aquasecurity/trivy) for OS-level and library vulnerabilities at HIGH/CRITICAL severity.

**Outputs:** `has_findings`, `total_severe`, `findings_summary`

#### 3. `trigger-remediation` — Devin API Invocation

Runs only when findings exist. Steps:

1. **Guard check** — queries PR comments to ensure Devin hasn't already attempted remediation
2. **Post findings comment** — summarizes all findings on the PR for developer visibility
3. **Invoke Devin v3 API** — creates a session with a structured prompt containing:
   - The specific vulnerabilities found
   - Step-by-step remediation instructions
   - Constraints (minimal changes, tests must pass, one-time attempt)

#### 4. `verify-fix` — Re-scan Verification

Runs only when **no findings** are detected. Checks if a prior Devin remediation comment exists — if so, this is a post-fix re-scan and it posts a verification success comment on the PR.

### Loop Prevention

Multiple mechanisms prevent infinite remediation loops:

1. **Author filter:** PRs from `devin-ai-integration[bot]` skip all scan jobs entirely
2. **One-time guard:** The `trigger-remediation` job checks for existing "SAST Auto-Remediate" comments before invoking Devin
3. **Prompt constraint:** The Devin prompt explicitly states this is a one-time attempt

---

## Workflow: `sast-scan.yml` (Existing)

Listens for SonarCloud `check_run` completion events. When a SonarCloud quality gate fails on a PR:

1. Validates the PR is open and authored by an authorized user
2. Checks the one-time guard (no prior Devin SAST fix comments)
3. Invokes the Devin API with SonarCloud-specific remediation instructions
4. SonarCloud automatically re-analyzes when Devin pushes the fix

---

## Secrets Required

| Secret | Purpose |
|--------|---------|
| `DEVIN_API_KEY` | Bearer token for the Devin v3 API |
| `DEVIN_ORG_ID` | Organization identifier for Devin session creation |
| `DEVIN_CREATE_AS_USER_ID` | User ID under which Devin sessions are created |

These are configured as GitHub repository secrets.

---

## Devin API Integration

Both workflows use the same Devin v3 API pattern:

```bash
POST https://api.devin.ai/v3/organizations/{org_id}/sessions
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "prompt": "<structured remediation instructions>",
  "title": "<descriptive session title>",
  "repos": ["owner/repo"],
  "create_as_user_id": "<user_id>",
  "tags": ["sast-remediate", ...]
}
```

The API returns a session URL which is posted as a PR comment for traceability.

---

## Data Flow Summary

```
PR opened → npm audit + Trivy scan → findings aggregated
  → PR comment (findings summary)
  → Devin session (with remediation prompt)
  → Devin pushes fix to PR branch
  → Workflow re-triggers (synchronize event)
  → Re-scan passes → verification comment posted
```
