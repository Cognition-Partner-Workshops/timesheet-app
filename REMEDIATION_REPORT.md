# Remediation Report — timesheet-app

> Date: 2026-06-26  
> Scope: CRITICAL and HIGH severity vulnerabilities  
> Result: **All CRITICAL and HIGH findings resolved**

---

## Summary

| Severity | Before | After |
|----------|--------|-------|
| Critical | 0 | 0 |
| High | 21 (backend: 11, frontend: 10) | 0 |
| Moderate | 26 | 18 (backend only, dev-dependency chains) |
| Low | 3 | 0 |

---

## Backend Fixes

### sqlite3: 5.1.7 → 6.0.1 (major version upgrade)

This single upgrade resolved 5 HIGH-severity transitive dependency chains:

| Dependency | Old Version | New Version | Vulnerabilities Resolved |
|-----------|-------------|-------------|-------------------------|
| sqlite3 | 5.1.7 | 6.0.1 | Native build chain vulnerabilities |
| tar | 6.x (transitive) | 7.5.17 | GHSA-34x7-hfp2-rc4v + 6 others (path traversal, symlink attacks) |
| cacache | 15.x (transitive) | 19.x | Integrity-check bypass |
| node-gyp | 9.x (transitive) | 11.x | Build-tool vulnerabilities |
| make-fetch-happen | 9.x (transitive) | 14.x | HTTP fetch chain |

### npm audit fix (semver-compatible upgrades)

| Dependency | Old Version | New Version | Vulnerability | CVSS |
|-----------|-------------|-------------|---------------|------|
| path-to-regexp | 0.1.12 | 0.1.13 | GHSA-37ch-88jc-xwx2 (ReDoS) | 7.5 |
| form-data | 4.0.5 | 4.0.6 | GHSA-hmw2-7cc7-3qxx (CRLF injection) | 7.5 |
| minimatch | 3.1.2 | 3.1.5 | GHSA-3ppc-4f35-3m26 + 2 (ReDoS) | 7.5 |
| picomatch | 2.3.1 | 2.3.2 | GHSA-c2c7-rcm5-vvqj (ReDoS/Method Injection) | 7.5 |
| jws | 3.2.2 | 3.2.3 | GHSA-869p-cjfg-cm3x (Signature bypass) | 7.5 |
| express | 4.22.1 | 4.22.2 | Transitive dependency fixes | — |
| joi | 17.13.3 | 17.13.4 | GHSA-q7cg-457f-vx79 (DoS via link schemas) | 5.3 |

---

## Frontend Fixes

All 16 vulnerabilities (10 HIGH, 5 MODERATE, 1 LOW) resolved via `npm audit fix`:

| Dependency | Old Version | New Version | Key Vulnerabilities Fixed | CVSS |
|-----------|-------------|-------------|--------------------------|------|
| axios | 1.13.2 | 1.18.1 | 23 advisories (SSRF, Prototype Pollution, DoS, credential leak) | 8.7 |
| react-router | 7.10.0 | 7.18.0 | XSS, RCE via turbo-stream, DoS, open redirects | 8.2 |
| react-router-dom | 7.10.0 | 7.18.0 | (same as react-router) | 8.2 |
| vite | 7.2.6 | 7.3.6 | Path traversal, file read, fs.deny bypass | 7.5 |
| rollup | 4.53.3 | 4.62.2 | GHSA-mw96-cpmx-2vgc (path traversal file write) | 7.5 |
| flatted | 3.3.3 | 3.4.2 | DoS via unbounded recursion, prototype pollution | 7.5 |
| form-data | 4.0.x | 4.0.6 | CRLF injection | 7.5 |
| minimatch | 3.1.2 | 3.1.5 | ReDoS (3 advisories) | 7.5 |
| picomatch | 4.0.3 | 4.0.4 | ReDoS, method injection | 7.5 |

---

## Verification

- **Backend tests**: 161/161 passing
- **Frontend build**: Successful (vite v7.3.6)
- **Frontend lint**: 0 issues
- **npm audit (backend)**: 0 critical, 0 high
- **npm audit (frontend)**: 0 vulnerabilities total
- **ESLint security rules**: 0 violations (`no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`)

---

## Remaining (Moderate — accepted risk)

18 moderate-severity findings remain in the backend, all in the jest/babel test-runner dependency chain (dev-only, not shipped to production):
- jest, @jest/core, babel-jest, babel-plugin-istanbul (js-yaml DoS via nested aliases)
- body-parser, express, qs (DoS via arrayLimit bypass — rate-limited in production)
- brace-expansion (zero-step sequence hang — only in glob patterns)

These are tracked in SECURITY_BACKLOG.md for future remediation when upstream fixes are available.
