# OWASP Top 10 Security Code Review — app_timesheet

**Date:** 2026-04-16
**Scope:** Full-stack review of backend (Node.js/Express/SQLite) and frontend (React/TypeScript)

---

## Executive Summary

This review identified **9 security findings** across the OWASP Top 10 categories. The most critical issue is **completely broken authentication** — the application uses email-only auth via a custom HTTP header with no passwords, no tokens, and no session management, allowing trivial user impersonation. Three critical fixes have been implemented as part of this review.

---

## Findings

### Finding 1: Broken Authentication — No Password, No JWT Tokens
**OWASP Category:** A07:2021 — Identification and Authentication Failures
**Severity:** CRITICAL
**Files:** `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/src/api/client.ts`

**Vulnerability:**
Authentication relies solely on an `x-user-email` HTTP header. Any client can set this header to any email address to impersonate any user. The `jsonwebtoken` package is installed as a dependency but is **never used**. The login endpoint simply confirms the email exists (or auto-creates the user) without any credential verification.

- No passwords are required or stored
- No JWT tokens are generated or verified
- Auto-creation of users on first "login" means any email address grants access
- The `x-user-email` header can be trivially spoofed by any HTTP client

**Impact:** Complete authentication bypass. Any attacker can access, modify, or delete any user's data by setting the email header.

**Recommended Fix:** Implement proper JWT-based authentication with bcrypt password hashing. Generate signed JWT tokens on login, verify them in middleware, and require password credentials.

**Status:** FIXED in this PR.

---

### Finding 2: Hardcoded Default JWT Secret
**OWASP Category:** A02:2021 — Cryptographic Failures
**Severity:** HIGH
**Files:** `backend/.env`, `backend/.env.example`

**Vulnerability:**
The `.env` file contains a hardcoded default JWT secret:
```
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
```
This value is predictable and publicly visible in the repository. If JWT were implemented with this secret, any attacker could forge valid tokens.

**Impact:** Token forgery, complete authentication bypass if JWT is used with the default secret.

**Recommended Fix:** Validate JWT_SECRET at startup — reject default/weak values. Auto-generate a cryptographically secure secret in development mode. Require a strong secret in production.

**Status:** FIXED in this PR.

---

### Finding 3: Missing Auth-Specific Rate Limiting
**OWASP Category:** A07:2021 — Identification and Authentication Failures
**Severity:** HIGH
**Files:** `backend/src/server.js`

**Vulnerability:**
The README claims "Rate limiting on authentication endpoints (5 attempts per 15 minutes)" but this is **not implemented**. Only a global rate limiter (100 requests/15 minutes) exists, which applies equally to all endpoints. This makes brute-force attacks against the login endpoint feasible.

**Impact:** Credential stuffing and brute-force attacks against the login endpoint are not adequately protected.

**Recommended Fix:** Add a dedicated, stricter rate limiter specifically for authentication endpoints (e.g., 5 attempts per 15 minutes per IP).

**Status:** FIXED in this PR.

---

### Finding 4: No CSRF Protection
**OWASP Category:** A01:2021 — Broken Access Control
**Severity:** MEDIUM
**Files:** `backend/src/server.js`

**Vulnerability:**
The application has no explicit CSRF protection mechanism. While the CORS configuration restricts requests to the frontend origin and the use of custom headers (`x-user-email`) triggers preflight checks that provide implicit protection, this is not a defense-in-depth approach.

With the JWT fix (Finding 1), the `Authorization: Bearer <token>` header provides stronger implicit CSRF protection since:
- Custom headers cannot be set by HTML forms
- Browser preflight (OPTIONS) requests are required for custom headers
- The JWT token itself acts as an anti-CSRF token

**Impact:** Before fix: Medium risk of cross-site state changes. After JWT fix: Low residual risk.

**Recommended Fix:** The JWT Bearer token implementation (Fix #1) mitigates this. For additional defense-in-depth, consider adding SameSite cookie attributes if cookies are used in the future, or implement explicit CSRF tokens.

---

### Finding 5: Information Disclosure in Error Handling
**OWASP Category:** A09:2021 — Security Logging and Monitoring Failures
**Severity:** MEDIUM
**Files:** `backend/src/middleware/errorHandler.js`

**Vulnerability:**
The default error handler passes `err.message` directly to the client response (line 22):
```js
res.status(err.status || 500).json({
  error: err.message || 'Internal server error'
});
```
Internal error messages may reveal implementation details, stack traces, or sensitive information about the server environment.

**Impact:** Information leakage that aids attackers in understanding the application's internals.

**Recommended Fix:** In production, always return a generic error message. Log detailed errors server-side only.

---

### Finding 6: Excessive JSON Body Size Limit
**OWASP Category:** A05:2021 — Security Misconfiguration
**Severity:** LOW
**Files:** `backend/src/server.js` (line 36)

**Vulnerability:**
```js
app.use(express.json({ limit: '10mb' }));
```
A 10MB JSON body limit is excessive for a timesheet application where payloads should rarely exceed a few KB. This could be exploited for denial-of-service attacks.

**Impact:** Memory exhaustion and DoS potential.

**Recommended Fix:** Reduce the limit to 100KB or less, appropriate for the application's actual payload sizes.

---

### Finding 7: XSS Vulnerabilities
**OWASP Category:** A03:2021 — Injection
**Severity:** LOW (Well Mitigated)
**Files:** All frontend `.tsx` files

**Assessment:**
The React frontend is well-protected against XSS:
- React's JSX automatically escapes interpolated values (`{variable}`)
- No usage of `dangerouslySetInnerHTML` anywhere in the codebase
- Material UI components handle rendering safely
- All user inputs go through controlled components

**Residual Risk:** Authentication credentials stored in `localStorage` are accessible if XSS is introduced in the future. JWT tokens in `localStorage` carry the same risk but are time-limited.

**Recommended Fix:** Consider using `httpOnly` cookies for token storage in production to eliminate localStorage exposure to potential XSS.

---

### Finding 8: SQL Injection
**OWASP Category:** A03:2021 — Injection
**Severity:** LOW (Well Mitigated)
**Files:** All backend route files

**Assessment:**
All SQL queries use parameterized queries with `?` placeholders:
```js
db.get('SELECT email FROM users WHERE email = ?', [userEmail], callback);
```
The dynamic query builders in `clients.js` (line 157) and `workEntries.js` (line 223) correctly use parameterized values — column names are hardcoded strings, only values use parameters.

**Recommended Fix:** No immediate action required. Continue using parameterized queries for all future database operations.

---

### Finding 9: Missing Content Security Policy
**OWASP Category:** A05:2021 — Security Misconfiguration
**Severity:** LOW
**Files:** `backend/src/server.js`

**Vulnerability:**
While Helmet is used (providing default security headers), no explicit Content Security Policy (CSP) is configured. Helmet's defaults are reasonable but a tailored CSP would provide better protection.

**Recommended Fix:** Configure an explicit CSP via Helmet that restricts script sources, style sources, and connection endpoints to known origins.

---

## Summary Table

| # | Finding | OWASP Category | Severity | Status |
|---|---------|---------------|----------|--------|
| 1 | Broken Authentication (no password/JWT) | A07:2021 | CRITICAL | **FIXED** |
| 2 | Hardcoded Default JWT Secret | A02:2021 | HIGH | **FIXED** |
| 3 | Missing Auth Rate Limiting | A07:2021 | HIGH | **FIXED** |
| 4 | No CSRF Protection | A01:2021 | MEDIUM | Mitigated by Fix #1 |
| 5 | Information Disclosure in Errors | A09:2021 | MEDIUM | Noted |
| 6 | Excessive JSON Body Size | A05:2021 | LOW | Noted |
| 7 | XSS Vulnerabilities | A03:2021 | LOW | Well Mitigated |
| 8 | SQL Injection | A03:2021 | LOW | Well Mitigated |
| 9 | Missing Content Security Policy | A05:2021 | LOW | Noted |

---

## Changes Implemented

### Fix 1: JWT Token Authentication + Password Hashing
- Added `bcryptjs` for secure password hashing (cost factor 12)
- Modified `users` table to include `password_hash` column
- Login endpoint now requires email + password, returns signed JWT token
- Added `/api/auth/register` endpoint for new user registration
- Auth middleware now verifies JWT tokens from `Authorization: Bearer <token>` header
- Frontend updated to store JWT token and send it in Authorization header
- Frontend login page updated with password field and register/login toggle

### Fix 2: JWT Secret Hardening
- Server validates JWT_SECRET at startup
- Rejects known default/weak secrets in production mode
- Auto-generates cryptographically secure secret for development if none provided
- Logs warnings when using auto-generated secrets

### Fix 3: Auth-Specific Rate Limiting
- Added dedicated rate limiter for `/api/auth` routes: 5 attempts per 15 minutes per IP
- Kept general rate limiter (100/15min) for other endpoints
- Returns `429 Too Many Requests` with clear error message when limit exceeded
