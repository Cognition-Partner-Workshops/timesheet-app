# Security

This document describes the security measures implemented in app_timesheet and known limitations.

## Authentication

The application uses email-based authentication via the `x-user-email` HTTP header. This is an intentional design choice for simplicity — there is no password, JWT, or session cookie.

**Mitigations in place:**
- Email header is sanitized: trimmed, lowercased, and validated against a 254-character max length
- Email format is validated via regex before any database lookup
- Type checking ensures the header value is a string
- Auth endpoints have dedicated rate limiting (20 requests per 15 minutes per IP) to slow email enumeration

**Known limitations:**
- Any client that knows a user's email can set the header and access their data
- No session expiry or logout invalidation
- Email is stored in plaintext in `localStorage` on the frontend

## Multi-Tenancy & Data Isolation

All data is scoped per-user via a `user_email` column on every table. Every SQL query filters by `req.userEmail`, ensuring complete tenant isolation. Foreign key constraints with `ON DELETE CASCADE` are enforced via `PRAGMA foreign_keys = ON`.

## Security Headers

[Helmet](https://helmetjs.github.io/) is configured with an explicit Content-Security-Policy:

| Directive | Value |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'` |
| `style-src` | `'self'` `'unsafe-inline'` |
| `img-src` | `'self'` `data:` |
| `connect-src` | `'self'` |
| `font-src` | `'self'` |
| `object-src` | `'none'` |
| `frame-ancestors` | `'none'` |

Additional headers set by Helmet include `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, and `X-XSS-Protection`.

## CORS

CORS is configured with an origin whitelist validator. Allowed origins are read from the `FRONTEND_URL` environment variable (comma-separated for multiple origins, defaults to `http://localhost:5173`).

- Only `GET`, `POST`, `PUT`, `DELETE` methods are allowed
- Only `Content-Type` and `x-user-email` headers are permitted
- Requests without an `Origin` header (e.g., curl, server-to-server) are allowed through
- Unrecognized origins receive a 403 Forbidden response

## Rate Limiting

Two tiers of rate limiting are applied via `express-rate-limit`:

| Scope | Limit | Window | Applied to |
|---|---|---|---|
| General | 100 requests per IP | 15 minutes | All endpoints |
| Auth | 20 requests per IP | 15 minutes | `/api/auth/*` |

Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are included in responses via the `standardHeaders` option.

## Input Validation

- All request bodies are validated with [Joi](https://joi.dev/) schemas before reaching route handlers. Unknown fields are stripped by default.
- JSON body size is limited to 100 KB to prevent memory exhaustion.
- All SQL queries use parameterized statements (`?` placeholders) — the application is not vulnerable to SQL injection.
- Dynamic UPDATE queries construct column names from hardcoded field checks (not user input), with values always parameterized.

## Error Handling

Error responses are sanitized to prevent information leakage:

| Error Type | Client Response | Internal Logging |
|---|---|---|
| Joi validation | 400 with field-level details | `err.message` |
| CORS rejection | 403 `"Forbidden"` | `err.message` |
| SQLite errors | 500 generic message | `err.message` |
| Other 4xx errors | Status code + error message | `err.message` |
| Other 5xx errors | 500 `"Internal server error"` | `err.message` |

Internal error details, stack traces, and database-specific messages are never sent to the client.

## XSS Protection

- The React frontend auto-escapes all rendered values via JSX. No instances of `dangerouslySetInnerHTML` or `eval()` exist.
- Content-Security-Policy restricts script sources to `'self'`.

## CSRF Protection

Traditional CSRF is partially mitigated because authentication uses a custom `x-user-email` header rather than cookies. Browsers do not automatically attach custom headers in cross-origin requests. However, no explicit CSRF tokens are used.

## Dependency Management

Dependencies are audited with `npm audit`. As of the last audit:

| Target | Vulnerabilities | Notes |
|---|---|---|
| Frontend | 0 | All resolved via `npm audit fix` |
| Backend | 7 (build-time only) | In `sqlite3` native build chain (`tar`, `node-gyp`). Not exploitable at runtime. Fixing requires a breaking `sqlite3@5→6` major upgrade. |

## Database

- SQLite with in-memory storage (`:memory:`) — data does not persist across restarts
- Foreign key enforcement enabled via `PRAGMA foreign_keys = ON`
- All tables use `ON DELETE CASCADE` on foreign keys
- Indexes on `user_email` and common lookup columns for performance

## Reporting a Vulnerability

If you discover a security vulnerability in this application, please report it responsibly by contacting the maintainers directly rather than opening a public issue.
