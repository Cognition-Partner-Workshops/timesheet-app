# Security Remediation Report

Automated remediation of CRITICAL and HIGH security findings in `timesheet-app`
(two npm projects: `backend/` — Node.js/Express, and `frontend/` — React + Vite + TypeScript).

Scan source: `npm audit` in each subdirectory. There were **0 CRITICAL** findings; all
severe findings were **HIGH**. This change also incidentally cleared all MODERATE and LOW
findings in both projects.

## Summary — `npm audit` severity counts (before → after)

| Project    | Critical | High     | Moderate | Low     | Total     |
|------------|----------|----------|----------|---------|-----------|
| `backend/` | 0 → **0** | 10 → **0** | 8 → **0** | 3 → **0** | 21 → **0** |
| `frontend/`| 0 → **0** | 9 → **0**  | 6 → **0** | 1 → **0** | 16 → **0** |

Verification command (run in each directory): `npm audit --json`
Result after remediation: `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}` in both.

All dependency versions selected were published at least 7 days before the remediation date,
and all version specifiers are pinned caret ranges (no floating `latest`/`*`/unbounded `>=`).

---

## Backend findings (`backend/`)

The backend HIGH findings were dominated by a single transitive build-toolchain chain pulled in
by `sqlite3` 5.x (`tar` → `node-gyp` → `cacache`/`make-fetch-happen` → `minimatch`/`picomatch`),
plus `jsonwebtoken`'s `jws` dependency, `express`'s `path-to-regexp`, and `form-data` (via
`supertest`).

| Package | Before | After | Advisory / CVE | Severity | Resolution |
|---------|--------|-------|----------------|----------|------------|
| `sqlite3` | 5.1.6 | **6.0.1** | GHSA-34x7-hfp2-rc4v (arbitrary file write via `tar`; CVSS 8.8) | HIGH | Direct dep bump — 6.x uses a modern `node-gyp`/`tar` build chain, resolving the whole `tar`/`node-gyp`/`cacache`/`make-fetch-happen`/`minimatch`/`picomatch` chain |
| `tar` | ≤7.5.15 | **7.5.20** | node-tar arbitrary file create/overwrite & symlink poisoning (path traversal) | HIGH | Transitively resolved by `sqlite3@6.0.1` |
| `node-gyp` | ≤10.3.1 | **12.4.0** | via `make-fetch-happen` / `tar` | HIGH | Transitively resolved by `sqlite3@6.0.1` |
| `cacache` / `make-fetch-happen` | vulnerable | fixed | via `tar` / `http-proxy-agent` | HIGH | Transitively resolved by `sqlite3@6.0.1` |
| `minimatch` | ≤3.1.3 | fixed | ReDoS (repeated wildcards / GLOBSTAR / extglob) | HIGH | Transitively resolved by `sqlite3@6.0.1` |
| `picomatch` | ≤2.3.1 | fixed | ReDoS / method injection in POSIX classes | HIGH | Transitively resolved by `sqlite3@6.0.1` |
| `jws` | 3.2.2 | **3.2.3** | GHSA-869p-cjfg-cm3x (improper HMAC signature verification; CVSS 7.5) | HIGH | `jsonwebtoken` bumped to `^9.0.3`; `jws` pinned to `^3.2.3` via `overrides` |
| `jsonwebtoken` | 9.0.2 | **9.0.3** | pulls fixed `jws` | HIGH | Direct dep bump |
| `express` | 4.18.2 | **4.22.2** | GHSA-37ch-88jc-xwx2 (`path-to-regexp` ReDoS; CVSS 7.5) | HIGH | Direct dep bump (stays on 4.x to avoid Express 5 breaking changes) |
| `form-data` | 4.0.5 | **4.0.6** | GHSA-hmw2-7cc7-3qxx (CRLF injection via unescaped multipart field names; CVSS 7.5) | HIGH | Pulled by `supertest`; pinned to `^4.0.6` via `overrides` |

### Backend package.json changes
- `dependencies`: `express ^4.18.2 → ^4.22.2`, `jsonwebtoken ^9.0.2 → ^9.0.3`, `sqlite3 ^5.1.6 → ^6.0.1`
- added `overrides`: `form-data ^4.0.6`, `jws ^3.2.3`

---

## Frontend findings (`frontend/`)

| Package | Before | After | Advisory / CVE | Severity | Resolution |
|---------|--------|-------|----------------|----------|------------|
| `axios` | 1.13.2 | **1.18.1** | Multiple: SSRF via NO_PROXY bypass, prototype-pollution gadgets, CRLF injection, credential leakage (CVSS up to 8.7) | HIGH | Direct dep bump (latest 1.x) |
| `react-router` | 7.10.0 | **7.18.1** | GHSA-2w69-qvjg-hvjx (XSS/open-redirect), GHSA-49rj-9fvp-4h2h (RCE via turbo-stream), + others (CVSS 8.2) | HIGH | Transitively resolved by `react-router-dom` bump |
| `react-router-dom` | 7.10.0 | **7.18.1** | via `react-router` | HIGH | Direct dep bump (stays on 7.x to avoid v8 major breaking changes) |
| `vite` | 7.2.6 | **7.3.6** | GHSA-4w7w-66w2-5vf9 (path traversal in optimized deps `.map`), `server.fs.deny` bypasses | HIGH | Direct dep bump (stays on 7.x; v8 was <7 days old at remediation time) |
| `rollup` | 4.53.3 | **4.62.2** | GHSA-mw96-cpmx-2vgc (arbitrary file write via path traversal) | HIGH | Pinned to `^4.62.2` via `overrides` (transitive of `vite`) |
| `flatted` | ≤3.4.1 | **3.4.2** | unbounded-recursion DoS in `parse()` + prototype pollution | HIGH | Pinned to `^3.4.2` via `overrides` |
| `form-data` | 4.0.x | **4.0.6** | GHSA-hmw2-7cc7-3qxx (CRLF injection) | HIGH | Pinned to `^4.0.6` via `overrides` |
| `minimatch` / `picomatch` | vulnerable | fixed | ReDoS | HIGH | Resolved transitively by the `vite`/`rollup` bumps |

### Frontend package.json changes
- `dependencies`: `axios ^1.13.2 → ^1.18.1`, `react-router-dom ^7.10.0 → ^7.18.1`
- `devDependencies`: `vite ^7.2.4 → ^7.3.6`
- added `overrides`: `rollup ^4.62.2`, `flatted ^3.4.2`, `form-data ^4.0.6`

---

## ESLint

- **Frontend**: already had a flat ESLint config and reported 0 violations before and after
  the upgrades. `npx eslint .` runs clean.
- **Backend**: had **no** ESLint config, so lint could not run. Added a minimal flat config
  (`backend/eslint.config.js`, CommonJS / Node env) built on `@eslint/js` recommended rules plus
  security-focused rules (`no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`,
  `no-buffer-constructor`). Installed `eslint`, `@eslint/js`, and `globals` as backend devDependencies.
  `npx eslint .` now runs clean (0 errors, 0 warnings). No security-relevant violations were surfaced;
  a few trivial unused-import/variable cleanups were applied to keep the output clean. No behavioral
  refactor was performed.

## Verification

| Check | Result |
|-------|--------|
| `cd backend && npm audit` | 0 high / 0 critical (0 total) |
| `cd frontend && npm audit` | 0 high / 0 critical (0 total) |
| `cd backend && npx eslint .` | clean (exit 0) |
| `cd frontend && npx eslint .` | clean (exit 0) |
| `cd backend && npm test` | 161 passed / 161 total (8 suites) |
| `cd frontend && npm run build` | success (`tsc -b && vite build`) |

## Findings that could NOT be resolved

None. All CRITICAL (none present) and HIGH findings in both projects were resolved, and all
MODERATE and LOW findings were incidentally cleared as well. The app was not broken by the
upgrades: backend tests pass and the frontend builds. No major upgrade required an API migration
(`react-router` and `vite` were kept on their current major versions to avoid breaking changes).
