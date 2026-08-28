# Security Remediation Report

This report documents dependency vulnerability scanning and remediation performed
on the timesheet-app codebase using **`npm audit`** and **Trivy**. All **critical**
and **high** severity findings have been remediated and verified by re-running both
scanners.

## Summary

| Scanner | Scope | Before (critical / high) | After (critical / high) |
|---|---|---|---|
| `npm audit` | `backend/` | 0 / 9 | **0 / 0** |
| `npm audit` | `frontend/` | 0 / 7 | **0 / 0** |
| Trivy (`fs`) | `backend/package-lock.json` | 0 / 11 | **0 / 0** |
| Trivy (`fs`) | `frontend/package-lock.json` | 0 / 18 | **0 / 0** |

- **0 critical** findings existed in either project.
- **16 high** findings reported by `npm audit` (9 backend + 7 frontend) — all remediated.
- **29 high** findings reported by Trivy (11 backend + 18 frontend; Trivy's DB carries
  additional/newer advisories than `npm audit`) — all remediated.
- Trivy also scanned for **secrets** and **misconfigurations**: **0** critical/high findings.
- All moderate/low findings were also cleared to **0** as a side effect of the upgrades.

Tools used:
- `npm audit` (npm 10.8.3 / Node v22.12.0)
- Trivy v0.71.0 (filesystem scan: `vuln`, `secret`, `misconfig`)

## What changed

Remediation was achieved with dependency upgrades only — no application source code changes.

| Project | Change | Reason |
|---|---|---|
| `backend` | `sqlite3` `^5.1.6` → `^6.0.1` (in `package.json` + lockfile) | Pulls in patched `node-gyp`/`tar`/`cacache`/`make-fetch-happen` chain (path traversal / arbitrary file write in `tar`). This is the current `latest` release of `sqlite3`. |
| `backend` | `npm audit fix` (lockfile-only) | Patched transitive `jws`, `minimatch`, `path-to-regexp`, `picomatch`, etc. |
| `frontend` | `npm audit fix` (lockfile-only) | Bumped `axios` (1.13.2 → 1.17.0), `react-router(-dom)` (7.x → 7.17.0), `vite` (→ 7.3.5), `rollup`, `flatted`, `minimatch`, and other transitives within existing semver ranges. |

Key resulting versions: `sqlite3@6.0.1`, `axios@1.17.0`, `react-router-dom@7.17.0`, `vite@7.3.5`.

## High-severity findings remediated

### backend (`npm audit`)

| Package | Vulnerable range | Advisory |
|---|---|---|
| `jws` | `<3.2.3` | Improperly Verifies HMAC Signature (GHSA-869p-cjfg-cm3x) |
| `minimatch` | `<=3.1.3` | ReDoS via repeated wildcards / GLOBSTAR backtracking |
| `path-to-regexp` | `<0.1.13` | ReDoS via multiple route parameters (GHSA-37ch-88jc-xwx2) |
| `picomatch` | `<=2.3.1` | Method injection / ReDoS in glob matching |
| `tar` | `<=7.5.10` | Arbitrary file create/overwrite via hardlink/symlink path traversal |
| `cacache` | `14.0.0 - 18.0.4` | Depends on vulnerable `tar` |
| `node-gyp` | `<=10.3.1` | Depends on vulnerable `make-fetch-happen`/`tar` |
| `make-fetch-happen` | `7.1.1 - 14.0.0` | Depends on vulnerable `cacache`/`http-proxy-agent` |
| `sqlite3` | `5.0.0 - 5.1.7` | Pulls vulnerable `node-gyp`/`tar` chain |

### frontend (`npm audit`)

| Package | Vulnerable range | Advisory |
|---|---|---|
| `axios` | `1.0.0 - 1.15.2` | SSRF (NO_PROXY bypass), prototype-pollution gadgets, credential leakage, ReDoS, DoS |
| `react-router` | `7.0.0 - 7.14.2` | XSS via open redirects / RSC redirect handling, DoS |
| `vite` | `7.0.0 - 7.3.1` | Path traversal / arbitrary file read via dev server |
| `rollup` | `4.0.0 - 4.58.0` | Arbitrary file write via path traversal (GHSA-mw96-cpmx-2vgc) |
| `flatted` | `<=3.4.1` | Unbounded recursion DoS / prototype pollution in `parse()` |
| `minimatch` | `<=3.1.3 \|\| 9.0.0 - 9.0.6` | ReDoS |
| `picomatch` | `4.0.0 - 4.0.3` | ReDoS via extglob quantifiers |

Trivy reported the same packages (plus additional newer advisories for `axios`/`react-router`/`tar`), all resolved by the same upgrades.

## Commands run

```bash
# --- Baseline scans ---
cd backend  && npm ci && npm audit            # 16 vulns (9 high)
cd frontend && npm ci && npm audit            # 13 vulns (7 high)
trivy fs --scanners vuln,secret,misconfig --severity CRITICAL,HIGH .   # 29 HIGH

# --- Remediation ---
cd backend  && npm audit fix                  # patch non-breaking transitives
cd backend  && npm install sqlite3@^6.0.1     # clear sqlite3 -> node-gyp -> tar chain
cd frontend && npm audit fix                  # bump axios / react-router / vite / rollup / ...

# --- Verification ---
cd backend  && npm audit                      # found 0 vulnerabilities
cd frontend && npm audit                      # found 0 vulnerabilities
trivy fs --scanners vuln,secret,misconfig --severity CRITICAL,HIGH .   # 0 findings
cd backend  && npm test                       # 161 passed
cd frontend && npm run build                  # build OK
cd frontend && npm run lint                   # lint OK
```

## Before / after evidence

### `npm audit` — backend

Before:
```
16 vulnerabilities (2 low, 5 moderate, 9 high)
```
After:
```
found 0 vulnerabilities
```

### `npm audit` — frontend

Before:
```
13 vulnerabilities (6 moderate, 7 high)
```
After:
```
found 0 vulnerabilities
```

### Trivy filesystem scan (CRITICAL/HIGH)

Before:
```
backend/package-lock.json  (npm)  HIGH: 11   [jws, minimatch, path-to-regexp, tar]
frontend/package-lock.json (npm)  HIGH: 18   [axios, react-router]
secrets: 0   misconfigurations: 0
TOTAL CRITICAL/HIGH: 29
```
After:
```
TOTAL CRITICAL/HIGH findings: 0
```

## Verification of application integrity

The upgrades — including the `sqlite3` major-version bump — were validated to ensure no regressions:

- **Backend:** `npm test` → **161 passed, 8 suites** (auth, clients, work entries, reports, validation, middleware, database).
- **Frontend:** `npm run build` → succeeded (`tsc -b && vite build`, 12,071 modules).
- **Frontend:** `npm run lint` → clean.

## Residual risk / notes

- `npm audit` and Trivy both report **0** critical/high vulnerabilities after remediation.
- Vulnerability databases evolve; re-run `npm audit` and Trivy periodically (ideally in CI) to catch newly disclosed advisories.
- Unrelated to dependency CVEs, the README documents intentional design trade-offs
  (email-only auth, in-memory SQLite). Those are application-design decisions and were
  out of scope for this dependency-vulnerability remediation.
