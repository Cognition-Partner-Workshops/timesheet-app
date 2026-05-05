# CI/CD Pipeline Security Audit Plan — `app_timesheet`

> **Audit Date:** 2026-05-05  
> **Repo:** `Cognition-Partner-Workshops/app_timesheet`  
> **Stack:** Node.js/Express backend, React/Vite frontend, SQLite, Docker, GitHub Actions  
> **Existing CI:** `pr-checks.yml` (CVE audit + coverage gate), `sast-scan.yml` (SonarCloud → Devin auto-fix)  
> **Existing CD:** None — no deployment pipeline exists

---

## Executive Summary

This audit reviewed all workflow files (`.github/workflows/pr-checks.yml`, `.github/workflows/sast-scan.yml`), the Dockerfile (`docker/Dockerfile`), application source code, and repository configuration for security gaps across build-time, scan-time, and deployment-time controls.

**Key findings:**
- **5 CRITICAL gaps** — including bot PRs that bypass all security gates, unpinned action versions, and missing backend dependency scanning
- **10 HIGH gaps** — including no container image scanning, no CD pipeline, no secret scanning, and suppressed security step failures
- **8 MEDIUM gaps** — including missing `.dockerignore`, no lockfile integrity check, and no secret rotation

---

## Gap Summary Table

| # | Severity | Gate Type | Problem | Impact |
|---|----------|-----------|---------|--------|
| 1 | **CRITICAL** | CI — Scan Bypass | Bot PRs (Devin) skip ALL security checks via `if: "!contains(…, 'devin')"` | Automated remediation PRs merge without any security/quality validation |
| 2 | **CRITICAL** | CI — Action Pinning | `actions/checkout@v4` and `actions/setup-node@v4` pinned to mutable tags, not full SHA | Supply chain attack via tag mutation (compromised action runs in your CI) |
| 3 | **CRITICAL** | CI — Scan Coverage | `npm audit` only runs on `frontend/` — backend (Express, SQLite, JWT, pdfkit) is completely unscanned | Backend CVEs go undetected; high-risk packages like `jsonwebtoken`, `sqlite3`, `express` are invisible to CI |
| 4 | **CRITICAL** | CI — Dependency Review | No `github/dependency-review-action` configured | Newly introduced vulnerable dependencies are not caught per-PR; only discovered in scheduled scans or after merge |
| 5 | **CRITICAL** | CI — Failure Suppression | Security audit step uses `continue-on-error: true` (pr-checks.yml:41) | npm audit failures are suppressed — the job continues even when critical CVEs are found; downstream "Fail if vulnerabilities" step attempts recovery but the step outcome is ambiguous |
| 6 | **HIGH** | CI — Container Security | No container image scanning (Trivy, Grype, Snyk Container) before any deployment | Vulnerable OS packages and transitive dependencies in the Docker image go undetected |
| 7 | **HIGH** | CI — SBOM | No Software Bill of Materials (SBOM) generated for container images or application dependencies | No supply chain transparency; non-compliant with EO 14028, NTIA minimum elements, and enterprise audit requirements |
| 8 | **HIGH** | CI — IaC Scanning | Dockerfile not scanned by Hadolint, Checkov, or similar | Dockerfile misconfigurations (insecure directives, missing best practices) are not caught automatically |
| 9 | **HIGH** | CI — Secret Scanning | No gitleaks, trufflehog, or equivalent secret scanning in CI | Accidentally committed secrets (API keys, tokens, credentials) are not detected in PRs |
| 10 | **HIGH** | CI — Pre-commit Hooks | No `.pre-commit-config.yaml` — no local security hooks | Developers can commit secrets, debug code, and unvalidated changes without any local guard |
| 11 | **HIGH** | CI — Quality Gate | Test coverage step uses `continue-on-error: true` (pr-checks.yml:131); coverage failures only produce a warning comment, never block merge | Low-coverage code merges freely; quality gate is advisory-only |
| 12 | **HIGH** | CD — Pipeline Missing | No CD workflow exists — no automated build/push/deploy pipeline | Deployments are manual, unauditable, and error-prone; no environment promotion or gating |
| 13 | **HIGH** | CD — Environment Protection | No GitHub Environments with protection rules (required reviewers, wait timers, branch restrictions) | No gating on production deployments; any branch can trigger a release |
| 14 | **HIGH** | CD — Artifact Signing | No cosign/Sigstore signing of container images | No guarantee deployed artifacts haven't been tampered with; no image verification before deployment |
| 15 | **HIGH** | CD — OIDC Auth | `sast-scan.yml` uses long-lived `DEVIN_API_KEY` secret; no OIDC-based auth for any cloud service | Long-lived credentials increase blast radius if compromised; no short-lived token rotation |
| 16 | **MEDIUM** | CI — Docker Build | No `.dockerignore` file in repo root | Entire repo (including `.env`, `.git/`, `node_modules/`) is sent as Docker build context — risk of leaking secrets into image layers |
| 17 | **MEDIUM** | CI — Lockfile Integrity | No explicit lockfile integrity verification step in CI | Modified lockfiles could introduce compromised packages undetected |
| 18 | **MEDIUM** | Docker — CSP | Production server override allows `'unsafe-inline'` in `scriptSrc` CSP directive | XSS attacks can execute inline scripts in production |
| 19 | **MEDIUM** | CD — Rollback | No automated rollback capability, no canary/blue-green deployment strategy | Failed deployments require manual intervention with extended downtime |
| 20 | **MEDIUM** | CD — Runtime Security | No network policies, read-only filesystem enforcement, or seccomp profiles for containers | Compromised containers have unrestricted network access and filesystem writes |
| 21 | **MEDIUM** | CD — Audit Trail | No deployment logging, no immutable audit trail for releases | No forensic capability for deployment incidents; no compliance evidence |
| 22 | **MEDIUM** | CD — Secret Rotation | No automated rotation for JWT_SECRET or other runtime secrets | Long-lived secrets increase exposure window; rotation requires manual deployment |
| 23 | **MEDIUM** | CD — SLSA Provenance | No SLSA provenance attestation generated for build artifacts | Cannot verify build integrity end-to-end in the software supply chain |

---

## Detailed Gap Analysis & Recommended Remediation

### CRITICAL Gaps

---

#### GAP 1 — Bot PRs Skip All Security Checks

**File:** `.github/workflows/pr-checks.yml` lines 16, 108  
**Current state:**
```yaml
if: "!contains(github.event.pull_request.user.login, 'devin')"
```
Both the `security-audit` and `test-coverage` jobs are entirely skipped for any PR authored by a user whose login contains "devin".

**Risk:** Devin's auto-remediation PRs (triggered by `sast-scan.yml` and `trigger-devin-cve-fix`) bypass all security and quality gates. If the remediation introduces a new vulnerability, breaks tests, or drops coverage, it will merge undetected.

**Recommended fix:**  
Remove the bot exclusion condition entirely. All PRs — regardless of author — must pass security audit and coverage checks. If Devin PRs cause infinite loops (fix triggers re-scan triggers re-fix), add a concurrency guard or a max-attempts label check instead of skipping gates.

```yaml
# REMOVE this line from both jobs:
# if: "!contains(github.event.pull_request.user.login, 'devin')"
```

---

#### GAP 2 — Third-Party Actions Pinned to Mutable Tags

**File:** `.github/workflows/pr-checks.yml` lines 27, 30, 117, 120  
**Current state:**
```yaml
uses: actions/checkout@v4
uses: actions/setup-node@v4
```

**Risk:** Tags like `v4` are mutable — the action maintainer (or a compromised account) can update what `v4` points to. This is the #1 supply chain attack vector for GitHub Actions ([GitHub Security Guide](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)).

**Recommended fix:**  
Pin all actions to their full commit SHA:
```yaml
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
```

---

#### GAP 3 — Backend Dependencies Completely Unscanned

**File:** `.github/workflows/pr-checks.yml` lines 34–36  
**Current state:** `npm ci` and `npm audit` run only in `frontend/`. The backend (`backend/package.json`) contains security-critical packages — `express@^4.18.2`, `jsonwebtoken@^9.0.2`, `sqlite3@^5.1.6`, `pdfkit@^0.13.0` — none of which are scanned in CI.

**Risk:** Critical and high CVEs in backend dependencies (the most attack-surface-heavy part of the app) are invisible to the pipeline.

**Recommended fix:**  
Add a parallel backend audit job or extend the existing `security-audit` job to scan both `frontend/` and `backend/`:
```yaml
- name: Install backend dependencies
  working-directory: backend
  run: npm ci

- name: Run backend npm audit
  working-directory: backend
  run: |
    npm audit --audit-level=high
```

---

#### GAP 4 — Missing `dependency-review-action`

**Current state:** No `github/dependency-review-action` step in any workflow.

**Risk:** The `npm audit` approach only catches known CVEs at scan time. `dependency-review-action` compares the PR's dependency diff against the GitHub Advisory Database, catching newly introduced vulnerabilities that `npm audit` might miss due to timing or registry lag.

**Recommended fix:**  
Add to `pr-checks.yml`:
```yaml
dependency-review:
  name: Dependency Review
  runs-on: ubuntu-latest
  permissions:
    contents: read
    pull-requests: write
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
    - uses: actions/dependency-review-action@da24556b548a50705dd671f47852072ea4c105d7  # v4.7.1
      with:
        fail-on-severity: high
        comment-summary-in-pr: always
```

---

#### GAP 5 — Security Audit Step Uses `continue-on-error: true`

**File:** `.github/workflows/pr-checks.yml` line 41  
**Current state:**
```yaml
- name: Run npm audit
  id: audit
  continue-on-error: true
```

**Risk:** When `npm audit` finds critical CVEs and exits non-zero, the step is marked as "success" due to `continue-on-error`. Although a downstream step ("Fail if vulnerabilities found") attempts to fail the job, the `continue-on-error` on the scan step itself creates ambiguity and can mask failures in edge cases (e.g., jq parsing errors).

**Recommended fix:**  
Remove `continue-on-error: true`. Use `set +e` within the run script to control exit behavior explicitly, then exit with the appropriate code at the end:
```yaml
- name: Run npm audit
  id: audit
  # REMOVED: continue-on-error: true
  run: |
    set +e
    # ... existing audit logic ...
    if [ "$TOTAL_SEVERE" -gt 0 ]; then
      exit 1
    fi
```

---

### HIGH Gaps

---

#### GAP 6 — No Container Image Scanning

**Current state:** `docker/Dockerfile` builds a multi-stage image but no workflow scans the resulting image for OS-level or library vulnerabilities.

**Recommended fix:**  
Add a Trivy container scan step to a CI/CD workflow:
```yaml
- name: Scan container image
  uses: aquasecurity/trivy-action@<sha>  # pin to SHA
  with:
    image-ref: 'app-timesheet:${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

---

#### GAP 7 — No SBOM Generation

**Recommended fix:**  
Generate SBOM using Syft or Trivy during the Docker build step:
```yaml
- name: Generate SBOM
  uses: anchore/sbom-action@<sha>
  with:
    image: 'app-timesheet:${{ github.sha }}'
    format: spdx-json
    output-file: sbom.spdx.json
```

---

#### GAP 8 — No IaC (Dockerfile) Scanning

**Current state:** `docker/Dockerfile` is never linted or scanned.

**Recommended fix:**  
Add Hadolint to CI:
```yaml
- name: Lint Dockerfile
  uses: hadolint/hadolint-action@<sha>
  with:
    dockerfile: docker/Dockerfile
    failure-threshold: warning
```

---

#### GAP 9 — No Secret Scanning in CI

**Recommended fix:**  
Add gitleaks to the PR workflow:
```yaml
- name: Secret scanning
  uses: gitleaks/gitleaks-action@<sha>
  with:
    args: detect --source . --verbose
```
Also note: `frontend/.env` is committed to git (contains `VITE_API_URL=http://localhost:3001`). While not currently sensitive, `.env` files should not be tracked — they should be in `.gitignore`.

---

#### GAP 10 — No Pre-commit Security Hooks

**Recommended fix:**  
Create `.pre-commit-config.yaml` with:
- `gitleaks` — secret detection
- `hadolint` — Dockerfile linting
- `eslint` — code quality
- `detect-private-key` — private key detection
- `check-added-large-files` — prevent accidental large file commits

---

#### GAP 11 — Test Coverage Gate is Advisory-Only

**File:** `.github/workflows/pr-checks.yml` line 131  
**Current state:** `continue-on-error: true` on the coverage step; failures produce a PR comment but never block the merge.

**Recommended fix:**  
Remove `continue-on-error: true`. Make the coverage check a required status check in branch protection rules. This ensures the merge is blocked when coverage drops below the configured threshold.

---

#### GAP 12 — No CD Pipeline Exists

**Current state:** No deployment workflow. The Dockerfile exists but there is no automated build/push/deploy process.

**Recommended fix:**  
Create a CD workflow (`cd.yml`) with:
1. Build and tag Docker image on merge to `main`
2. Push to a container registry (ECR, GHCR, etc.)
3. Deploy to staging with automated smoke tests
4. Gated promotion to production with manual approval
5. Post-deployment health checks

---

#### GAP 13 — No GitHub Environment Protection Rules

**Recommended fix:**  
Define `staging` and `production` environments in the repository settings with:
- Required reviewers for production
- Wait timer (e.g., 5 minutes) for production
- Branch restriction (only `main` can deploy to production)
- Deployment branch policies

---

#### GAP 14 — No Artifact Signing

**Recommended fix:**  
Integrate cosign for keyless signing via GitHub OIDC:
```yaml
- name: Sign image
  uses: sigstore/cosign-installer@<sha>
- run: cosign sign --yes ${{ env.IMAGE_REF }}
```

---

#### GAP 15 — Long-Lived Credentials Instead of OIDC

**File:** `.github/workflows/sast-scan.yml` — uses `secrets.DEVIN_API_KEY`

**Recommended fix:**  
Where possible, use GitHub OIDC tokens for cloud provider authentication (AWS, Azure, GCP). For third-party APIs like Devin that don't support OIDC, ensure secrets are:
- Scoped to the minimum required permissions
- Rotated on a regular schedule
- Audited for usage

---

### MEDIUM Gaps

---

#### GAP 16 — Missing `.dockerignore`

**Recommended fix:**  
Create a `.dockerignore` at the repo root:
```
.git
.github
.env
.env.*
node_modules
coverage
*.md
*.log
.vscode
.idea
```

---

#### GAP 17 — No Lockfile Integrity Verification

**Recommended fix:**  
Add `npm ci --ignore-scripts` followed by `npm audit signatures` to verify package integrity:
```yaml
- name: Verify package integrity
  run: npm audit signatures
```

---

#### GAP 18 — CSP Allows `unsafe-inline` Scripts

**File:** `docker/overrides/server.js` line 25  
**Recommended fix:**  
Replace `'unsafe-inline'` with nonce-based or hash-based CSP for scripts. This requires coordination with the frontend build to inject nonces.

---

#### GAP 19 — No Automated Rollback

**Recommended fix:**  
In the CD pipeline, implement health-check-gated deployments with automatic rollback on failure. Use container orchestrator features (e.g., Kubernetes rolling update with `maxUnavailable`, ECS deployment circuit breaker).

---

#### GAP 20 — No Runtime Container Security

**Recommended fix:**  
Add to container deployment configuration:
- `readOnlyRootFilesystem: true` (with writable tmpfs for `/app/data` and `/tmp`)
- Drop all capabilities, add only required ones
- Network policies restricting egress
- Seccomp profile

---

#### GAP 21 — No Deployment Audit Trail

**Recommended fix:**  
Ensure the CD pipeline logs all deployments to an immutable store (GitHub deployment events, CloudWatch, or a dedicated audit service) with: who triggered, what artifact, which environment, timestamp, and outcome.

---

#### GAP 22 — No Secret Rotation Mechanism

**Recommended fix:**  
Implement automated secret rotation using a secrets manager (AWS Secrets Manager, HashiCorp Vault) with:
- Automatic rotation schedules
- Zero-downtime rotation (dual-read of old + new secrets during transition)
- Alerting on rotation failures

---

#### GAP 23 — No SLSA Provenance Attestation

**Recommended fix:**  
Add `slsa-github-generator` to the build workflow to generate SLSA Level 3 provenance:
```yaml
- uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@<sha>
```

---

## What's Already Done Well

| Area | Status |
|------|--------|
| Dockerfile multi-stage build | ✅ Clean 3-stage build (frontend-builder → backend-builder → production) |
| Non-root container user | ✅ `nodejs` user (UID 1001) created and active |
| Minimal base image | ✅ `node:20-alpine` |
| Process signal handling | ✅ `dumb-init` for proper PID 1 behavior |
| Container health check | ✅ `HEALTHCHECK` directive configured |
| No secrets in build args | ✅ No `ARG` with sensitive values |
| Workflow permissions | ✅ Least-privilege: `contents: read`, `pull-requests: write` |
| SonarCloud SAST integration | ✅ Automated scan with Devin auto-remediation |
| Parameterized SQL queries | ✅ All database queries use parameterized bindings |
| Security headers (Helmet) | ✅ Enabled with reasonable defaults |
| Rate limiting | ✅ Configured on all routes |
| Input validation (Joi) | ✅ Schema validation on all inputs |

---

## Prioritized Remediation Roadmap

### Phase 1 — Immediate (CRITICAL)
Fix gaps 1–5. These are the highest-impact, lowest-effort changes that close the most dangerous holes in the current CI pipeline.

### Phase 2 — Short-term (HIGH)
Fix gaps 6–15. These establish container security scanning, secret detection, and the foundation for a proper CD pipeline.

### Phase 3 — Medium-term (MEDIUM)
Fix gaps 16–23. These harden the deployment posture, add supply chain attestation, and implement operational security controls.
