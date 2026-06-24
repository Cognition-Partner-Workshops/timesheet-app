# Root Cause Analysis: Timezone-Dependent Date Display Bug

## Bug Summary

Work entry dates display **one day behind** for users in negative UTC offset timezones (e.g., EST, PST). A work entry logged on June 24 appears as June 23 for users in the Americas.

## Impact

- **Severity**: High — every date in the app is affected (Work Entries, Reports, Dashboard, CSV/PDF exports)
- **Users affected**: All users in UTC-negative timezones (Americas, Pacific islands)

## Root Cause

Joi's `date().iso()` validator in `backend/src/validation/schemas.js` converts ISO date strings into JavaScript `Date` objects (midnight UTC). SQLite stores these via `Date.valueOf()` as Unix timestamps (e.g., `1782259200000` instead of `"2026-06-24"`). The frontend then calls `new Date(timestamp).toLocaleDateString()`, which converts to local time — and midnight UTC falls on the previous calendar day for UTC-negative timezones.

### Reproduction

Set the browser timezone to `America/New_York` and observe that work entry dates are shifted back by one day.

## Fix

**Backend**: Replaced `Joi.date().iso()` with a reusable `isoDateString()` helper that validates the `YYYY-MM-DD` pattern as a string, keeping dates as strings through to SQLite storage.

**Frontend**: Added `dateUtils.ts` with `parseDateString()` that splits `YYYY-MM-DD` into components and constructs a local Date directly, and `formatDate()` that delegates to it. Updated all pages to use these instead of `new Date(entry.date)`. Also fixed date submission to use `getFullYear()/getMonth()/getDate()` instead of `toISOString().split('T')[0]`.

## Other Bugs Found

1. **Missing `PRAGMA foreign_keys = ON`**: SQLite doesn't enforce foreign keys by default, so `ON DELETE CASCADE` on `work_entries.client_id` doesn't work — deleting a client leaves orphaned work entries.

2. **Health endpoint not proxied**: `ApiClient.healthCheck()` calls `/health`, but the Vite proxy only forwards `/api` requests.
