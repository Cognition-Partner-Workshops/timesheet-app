# Security Remediation Report

**Date:** 2026-06-26
**Scan Tools:** npm audit, Trivy v0.71.2

---

## Executive Summary

Security scans identified **53 npm audit vulnerabilities** (19 high) and **30 Trivy HIGH-severity findings** across the backend and frontend packages. All critical and high-severity vulnerabilities have been remediated. The remaining 18 moderate-severity issues are deep transitive dependencies in the Jest test framework that cannot be resolved without a breaking downgrade.

---

## Before Remediation

### npm audit

| Component | Critical | High | Moderate | Low | Total |
|-----------|----------|------|----------|-----|-------|
| Backend   | 0        | 10   | 24       | 3   | 37    |
| Frontend  | 0        | 9    | 6        | 1   | 16    |
| **Total** | **0**    | **19** | **30** | **4** | **53** |

### Trivy (HIGH/CRITICAL only)

| Component | Critical | High | Total |
|-----------|----------|------|-------|
| Backend   | 0        | 11   | 11    |
| Frontend  | 0        | 19   | 19    |
| **Total** | **0**    | **30** | **30** |

### High-Severity Findings Detail

#### Backend

| Package | Installed | Severity | CVEs / Advisories |
|---------|-----------|----------|-------------------|
| form-data | 4.0.5 | HIGH | GHSA-hmw2-7cc7-3qxx (CRLF injection) |
| jws | 3.2.2 | HIGH | GHSA-869p-cjfg-cm3x (HMAC signature verification bypass) |
| minimatch | 3.1.2 | HIGH | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS) |
| path-to-regexp | 0.1.12 | HIGH | GHSA-37ch-88jc-xwx2 (ReDoS) |
| picomatch | 2.3.1 | HIGH | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj (method injection, ReDoS) |
| tar | 6.2.1 | HIGH | GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w, GHSA-vmf3-w455-68vh (path traversal, symlink poisoning, file smuggling) |

#### Frontend

| Package | Installed | Severity | CVEs / Advisories |
|---------|-----------|----------|-------------------|
| axios | 1.13.2 | HIGH | 24 advisories including SSRF, prototype pollution, credential leaks, DoS, header injection |
| flatted | 3.4.1 | HIGH | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh (unbounded recursion DoS, prototype pollution) |
| form-data | 4.0.5 | HIGH | GHSA-hmw2-7cc7-3qxx (CRLF injection) |
| minimatch | 3.1.2 | HIGH | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS) |
| picomatch | 4.0.3 | HIGH | GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj (method injection, ReDoS) |
| react-router | 7.10.0 | HIGH | GHSA-2w69-qvjg-hvjx, GHSA-8v8x-cx79-35w7, GHSA-49rj-9fvp-4h2h, GHSA-2j2x-hqr9-3h42, GHSA-8646-j5j9-6r62, GHSA-f22v-gfqf-p8f3, GHSA-8x6r-g9mw-2r78, GHSA-rxv8-25v2-qmq8, GHSA-h5cw-625j-3rxh (XSS, open redirect, RCE, DoS, CSRF) |
| rollup | 4.x | HIGH | GHSA-mw96-cpmx-2vgc (arbitrary file write via path traversal) |
| vite | 7.x | HIGH | GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583, GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff (path traversal, fs.deny bypass, WebSocket file read) |

---

## Remediation Actions

### Backend

| Action | Details |
|--------|---------|
| `npm audit fix` | Resolved form-data, jws, minimatch, path-to-regexp, picomatch, brace-expansion, ip-address, joi, qs, express, body-parser, @babel/core |
| `npm install sqlite3@6.0.1` | Upgraded sqlite3 from 5.1.7 to 6.0.1, eliminating the node-gyp -> tar vulnerability chain (7 HIGH CVEs) |

### Frontend

| Action | Details |
|--------|---------|
| `npm audit fix` | Resolved all 16 vulnerabilities: axios (24 advisories), flatted, form-data, minimatch, picomatch, react-router (9 advisories), react-router-dom, rollup, vite (5 advisories), brace-expansion, follow-redirects, js-yaml, postcss, yaml, ajv, @babel/core |

---

## After Remediation

### npm audit

| Component | Critical | High | Moderate | Low | Total |
|-----------|----------|------|----------|-----|-------|
| Backend   | 0        | 0    | 18       | 0   | 18    |
| Frontend  | 0        | 0    | 0        | 0   | 0     |
| **Total** | **0**    | **0** | **18** | **0** | **18** |

### Trivy (HIGH/CRITICAL only)

| Component | Critical | High | Total |
|-----------|----------|------|-------|
| Backend   | 0        | 0    | 0     |
| Frontend  | 0        | 0    | 0     |
| **Total** | **0**    | **0** | **0** |

---

## Residual Findings

### Backend: 18 moderate-severity vulnerabilities (js-yaml via Jest)

All 18 remaining moderate vulnerabilities stem from `js-yaml <=4.1.1` (GHSA-h67p-54hq-rp68: quadratic-complexity DoS in merge key handling). This is a deep transitive dependency of Jest v29 via `@istanbuljs/load-nyc-config`. The only automated fix (`npm audit fix --force`) would downgrade Jest from v29 to v25, a breaking change that would require rewriting the test suite. Since these are:

- **Moderate severity** (not high or critical)
- **Dev-only dependencies** (not shipped to production)
- **Not exploitable at runtime** (Jest runs only during development/CI)

They are accepted as residual risk pending an upstream Jest release that updates its js-yaml dependency.

---

## Verification

All remediations were verified by:

1. Re-running `npm audit` on both backend and frontend
2. Re-running `trivy fs --severity HIGH,CRITICAL` on the full repository
3. Running the full backend test suite (161 tests, all passing)
4. Running the frontend production build (successful)

### Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| npm audit total | 53 | 18 | -66% |
| npm audit high/critical | 19 | 0 | -100% |
| Trivy HIGH/CRITICAL | 30 | 0 | -100% |
