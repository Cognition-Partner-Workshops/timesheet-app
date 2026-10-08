# PII / GDPR Compliance Report — timesheet-app

Scope: full repository (`backend/`, `frontend/`, `docker/`, `.github/workflows/`, config files).
Method: manual code review of every place personal data is collected, stored, processed, transmitted, logged or exported, plus a live smoke test of the backend.

Status legend: **FIXED** = remediated in this change · **OPEN** = recommendation, not yet implemented.

---

## 1. Personal data inventory

| Data element | Data subject | Where collected | Where stored | GDPR category |
|---|---|---|---|---|
| User email (`users.email`, primary key) | App user | `POST /api/auth/login`, `x-user-email` header on every request | SQLite `users`, and as FK `user_email` in `clients` and `work_entries`; browser `localStorage.userEmail` | Direct identifier |
| Client contact email (`clients.email`) | Third party (client contact) | `POST/PUT /api/clients` | SQLite `clients` | Direct identifier |
| Client name / department (`clients.name`, `clients.department`) | Third party (often an individual or org unit) | `POST/PUT /api/clients` | SQLite `clients`; report file names | Identifier / quasi-identifier |
| Work-entry descriptions + dates + hours | App user (work activity) | `POST/PUT /api/work-entries` | SQLite `work_entries`; CSV/PDF exports | Behavioural / employment data (free text may contain any PII) |
| IP address, user-agent, referrer | App user | Every HTTP request | Server stdout via `morgan` | Online identifiers |
| Timestamps (`created_at`, `updated_at`) | App user | Automatic | SQLite | Metadata linked to identifier |

Passwords: **none**. Authentication is email-only (see C-1), so there is no password storage and therefore nothing to hash. The real gap is the absence of any credential at all.

---

## 2. Data flow map

```
                          ┌──────────────────────────── Browser (React SPA) ─────────────────────────────┐
                          │ LoginPage ──email──► AuthContext ──► localStorage.userEmail (plaintext)      │
                          │                                   │                                          │
                          │ api/client.ts interceptor: adds header  x-user-email: <email>  to EVERY call │
                          │ TanStack Query cache: clients, work entries, reports (in memory)             │
                          │ console.error(...)  ── previously dumped full Axios error incl. headers  [F] │
                          └───────────────────────────────┬──────────────────────────────────────────────┘
                                                          │  HTTP (no TLS enforced, HSTS disabled in docker)
                                                          │  JSON bodies: email, client name/email/department,
                                                          │  work-entry descriptions
                                                          ▼
┌──────────────────────────────────────────── Express backend (server.js) ───────────────────────────────────────────┐
│ helmet ─► cors ─► rate-limit ─► morgan access log ──► stdout  (was: full IP + UA + referrer; now truncated IP) [F] │
│                                                                                                                      │
│ middleware/auth.js  — trusts x-user-email, AUTO-CREATES user row for any well-formed email                          │
│ routes/auth.js      — /login, /me, /me/export (new, Art.15/20) [F], DELETE /me (new, Art.17) [F]                    │
│ routes/clients.js   — CRUD client name/description/department/email                                                 │
│ routes/workEntries.js — CRUD hours/description/date                                                                 │
│ routes/reports.js   — JSON report, CSV (temp file on disk ../../temp/<client>_report_*.csv), PDF (streamed)          │
│ errorHandler.js     — logged raw err object (incl. Joi `_original` request body) + echoed 5xx messages  [F]          │
│ console.error in every route — logged raw err objects  [F]                                                          │
└──────────────────────────────────────┬─────────────────────────────────────────────────────────┬───────────────────┘
                                       │ parameterized SQL                                       │ downloads
                                       ▼                                                         ▼
          ┌─────────────────── SQLite ───────────────────┐                     CSV / PDF report files on the
          │ dev:    :memory:                              │                     user's machine (client name in
          │ docker: /app/data/timesheet.db (plaintext     │                     file name, descriptions in body)
          │         file, no encryption at rest)          │
          │ users(email PK) ─┬─ clients(user_email FK)    │
          │                  └─ work_entries(user_email)  │
          │ FK cascades were NOT enforced in dev  [F]     │
          └───────────────────────────────────────────────┘

Out-of-band: backend/src/config/production.js contained a hard-coded production Postgres URL with
credentials (direct access to all PII) [F]; .github/workflows/deploy.yml contains hard-coded cloud/SaaS keys [OPEN].
```

`[F]` = fixed in this change.

---

## 3. Compliance gaps (by severity)

### Critical

| ID | Gap | Location | GDPR article | Status |
|---|---|---|---|---|
| C-1 | **No authentication.** Any caller can read, modify, export or delete any user's personal data by setting `x-user-email: <victim>`. Users are auto-created for any email. | `backend/src/middleware/auth.js`, `frontend/src/api/client.ts` | Art. 5(1)(f), Art. 32 (security of processing) | **OPEN** — design decision (login page states the app intentionally has no password). Recommended: magic-link / OIDC login issuing a signed, short-lived session token (JWT via the already-installed `jsonwebtoken`, `JWT_SECRET` from env) in an `HttpOnly; Secure; SameSite` cookie; stop trusting `x-user-email`. If passwords are introduced, hash with `bcrypt`/`argon2id`. |
| C-2 | **Hard-coded production DB credentials** (`postgres://tsapp_admin:...@db.internal...`) plus JWT secret and SendGrid key committed to source. Gives direct access to every record. | `backend/src/config/production.js` | Art. 32 | **FIXED** — values now read from `DATABASE_URL`, `JWT_SECRET`, `SENDGRID_API_KEY`. **Credentials remain in git history and must be rotated.** |

### High

| ID | Gap | Location | GDPR article | Status |
|---|---|---|---|---|
| H-1 | **PII in server logs.** Every route logged the raw error object (`console.error('Database error:', err)`); `errorHandler` logged the full Joi error including `_original` (the entire request body: emails, client contact data, descriptions). | `backend/src/routes/*.js`, `middleware/auth.js`, `middleware/errorHandler.js` | Art. 5(1)(c) minimisation, Art. 32 | **FIXED** — new `backend/src/utils/logger.js` (`logError`/`sanitizeError`) logs only `name`, `code`, `status` and an email-redacted `message`. |
| H-2 | **IP address, user-agent and referrer logged for every request** (`morgan('combined')`). IPs are personal data. | `backend/src/server.js`, `docker/overrides/server.js` | Art. 5(1)(c) | **FIXED** — custom morgan format with truncated IP (`203.0.113.0`, IPv6 /48) and no UA/referrer. |
| H-3 | **No right of access / portability.** No way for a user to obtain their data. | — | Art. 15, Art. 20 | **FIXED** — `GET /api/auth/me/export` returns user, clients and work entries as a JSON download; "Download My Data" in the sidebar. |
| H-4 | **No right to erasure; cascades broken.** No account deletion. In dev `PRAGMA foreign_keys` was never enabled, so `ON DELETE CASCADE` did nothing and deleting a client orphaned its work entries. | `backend/src/database/init.js` | Art. 17 | **FIXED** — `DELETE /api/auth/me` explicitly deletes work entries → clients → user; `PRAGMA foreign_keys = ON` in dev init (docker init already had it); "Delete My Account" with confirmation dialog. Caveat: because of C-1, any later request with that email re-creates an empty user row. |
| H-5 | **Insecure transmission.** No TLS enforcement; docker build explicitly disables HSTS; the identity (email) travels in a header on every request. | `docker/overrides/server.js` | Art. 32 | **OPEN** — terminate TLS at a reverse proxy/load balancer, re-enable `strictTransportSecurity`, set `app.set('trust proxy', 1)` and redirect HTTP→HTTPS. |
| H-6 | **No encryption at rest.** Production SQLite file `/app/data/timesheet.db` stores emails, client contact data and descriptions in plaintext. | `docker/Dockerfile`, `docker/overrides/database/init.js` | Art. 32 | **OPEN** — use an encrypted volume (e.g. EBS/KMS) at minimum; consider SQLCipher or application-level field encryption (AES-256-GCM, key from KMS) for `clients.email`. |
| H-7 | **Hard-coded cloud/SaaS secrets in CI** (AWS, Slack, GitHub PAT, Stripe live key). Not PII themselves but provide infrastructure access. | `.github/workflows/deploy.yml` | Art. 32 | **OPEN** — move to `${{ secrets.* }}` and rotate all keys. Left unchanged here to avoid altering the deploy pipeline without the required repository secrets being configured. |

### Medium

| ID | Gap | Location | GDPR article | Status |
|---|---|---|---|---|
| M-1 | **Internal error messages echoed to clients.** Default branch of `errorHandler` returned `err.message` for 5xx errors (could include data values). | `backend/src/middleware/errorHandler.js` | Art. 32 | **FIXED** — 5xx responses return `Internal server error`; only 4xx messages are passed through. |
| M-2 | **PII in browser console.** `console.error(..., error)` dumped full Axios errors, whose `config` contains the `x-user-email` header and request body. | `frontend/src/contexts/AuthContext.tsx`, `frontend/src/pages/ReportsPage.tsx` | Art. 5(1)(f) | **FIXED** — new `frontend/src/utils/describeError.ts` logs only `HTTP <status>`. |
| M-3 | **Cached personal data survives logout.** TanStack Query cache was not cleared on logout, so the next user of a shared browser could briefly see the previous user's clients/entries. | `frontend/src/contexts/AuthContext.tsx` | Art. 5(1)(f) | **FIXED** — `queryClient.clear()` on logout. |
| M-4 | **No transparency notice / consent.** Users are not told what is collected or why; accounts are created silently. | `frontend/src/pages/LoginPage.tsx`, `middleware/auth.js` | Art. 12–13 (information), Art. 6/7 (lawful basis / consent) | **PARTIAL** — privacy notice added to login page. OPEN: link a full privacy policy, document lawful basis (likely contract/legitimate interest for timesheets), and record notice/consent version + timestamp per user (e.g. `users.privacy_accepted_at`). |
| M-5 | **No retention policy.** Data is kept indefinitely. | DB schema | Art. 5(1)(e) storage limitation | **OPEN** — define retention period (e.g. N years after last activity for billing records), add a scheduled purge job and `last_active_at` column. |
| M-6 | **Third-party (client contact) data with no notice path.** `clients.email`/`department` describe people who never interact with the app. | `routes/clients.js` | Art. 14 | **OPEN** — document purpose in privacy policy; make the field optional-by-default (it is) and consider removing `email` if not needed for billing. |
| M-7 | **Email used as primary/foreign key** in every table, spreading the identifier across the schema and into every query and index; makes pseudonymisation and email change hard. | `backend/src/database/init.js` | Art. 25 (privacy by design), Art. 32 pseudonymisation | **OPEN** — introduce surrogate `users.id` (UUID) and reference it from `clients`/`work_entries`. |

### Low

| ID | Gap | Location | Status |
|---|---|---|---|
| L-1 | Email kept in `localStorage` (readable by any XSS). | `frontend/src/api/client.ts`, `AuthContext.tsx` | OPEN — resolved by C-1 fix (HttpOnly session cookie). |
| L-2 | Account enumeration: `/login` returns 200 for existing vs 201 for new users. | `backend/src/routes/auth.js` | OPEN — return a uniform response. |
| L-3 | CSV export writes a temp file containing work-entry data to `backend/temp/`; client name in file name. | `backend/src/routes/reports.js` | OPEN — stream CSV directly to the response (as PDF already does). |
| L-4 | Docker DB schema drift: `docker/overrides/database/init.js` lacks `clients.department`/`clients.email`, so the production schema differs from dev. | `docker/overrides/database/init.js` | OPEN — single source of truth for schema/migrations. |
| L-5 | `express.json({ limit: '10mb' })` allows very large free-text payloads, increasing the chance of unexpected PII ingestion. | `backend/src/server.js` | OPEN — reduce to ~100kb. |

---

## 4. Changes implemented in this PR

| File | Change |
|---|---|
| `backend/src/utils/logger.js` (new) | `redactPII`, `sanitizeError`, `logError`, `anonymizeIp`, `registerPrivacyLogFormat` |
| `backend/src/routes/*.js`, `backend/src/middleware/auth.js` | All `console.error(..., err)` → `logError(..., err)` |
| `backend/src/middleware/errorHandler.js` | Sanitized logging; no 5xx message echo |
| `backend/src/server.js`, `docker/overrides/server.js` | Privacy-preserving morgan format |
| `backend/src/database/init.js` | `PRAGMA foreign_keys = ON` |
| `backend/src/routes/auth.js` | `GET /api/auth/me/export`, `DELETE /api/auth/me` |
| `backend/src/config/production.js` | Secrets from environment variables |
| `frontend/src/utils/describeError.ts` (new), `AuthContext.tsx`, `ReportsPage.tsx` | PII-free console logging; clear query cache on logout |
| `frontend/src/api/client.ts`, `frontend/src/components/Layout.tsx` | "Download My Data" / "Delete My Account" (with confirmation) |
| `frontend/src/pages/LoginPage.tsx` | Privacy notice |
| Tests | `__tests__/utils/logger.test.js` (new), export/erasure tests in `routes/auth.test.js`, updated `errorHandler.test.js` |

## 5. Required follow-up (outside code)

1. **Rotate** the Postgres password, JWT secret and SendGrid key from `config/production.js`, and all keys in `deploy.yml` — they remain in git history.
2. Decide on an authentication approach for C-1 (largest remaining risk).
3. Provide TLS termination and encrypted storage for the production deployment (H-5, H-6).
4. Publish a privacy policy and retention schedule (M-4, M-5).
