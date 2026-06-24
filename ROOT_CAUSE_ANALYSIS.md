# Root Cause Analysis: Timezone-Dependent Date Display Bug

## Bug Summary

Work entry dates display **one day behind** for users in negative UTC offset timezones (e.g., EST, PST). A work entry logged on June 24 appears as June 23 for users in the Americas.

## Impact

- **Severity**: High
- **Scope**: Every date displayed in the application is affected — Work Entries page, Reports page, Dashboard, and CSV/PDF exports
- **Users affected**: All users in UTC-negative timezones (Americas, Pacific islands)

## Root Cause

The bug originates in the backend validation layer (`backend/src/validation/schemas.js`).

### The chain of events:

1. **Joi `date().iso()` converts strings to Date objects**: When the frontend submits a date like `"2026-06-24"`, Joi's `date().iso()` validator parses it into a JavaScript `Date` object representing `2026-06-24T00:00:00.000Z` (midnight UTC).

2. **SQLite stores the Date object as a Unix timestamp**: When this `Date` object is passed to SQLite via the `sqlite3` driver, it is coerced to its numeric value (`Date.valueOf()`), storing `1782259200000` instead of the string `"2026-06-24"`.

3. **Frontend interprets the timestamp in local time**: When the frontend receives `1782259200000` and calls `new Date(1782259200000).toLocaleDateString()`, the date is converted to the user's local timezone. For UTC-negative timezones, midnight UTC falls on the **previous calendar day** in local time:
   - UTC: `Wed Jun 24 2026 00:00:00` (correct)
   - EST (UTC-5): `Tue Jun 23 2026 19:00:00` (wrong day!)
   - PST (UTC-8): `Tue Jun 23 2026 16:00:00` (wrong day!)

### Reproduction

Set the browser timezone to `America/New_York` and observe that dates for all work entries are shifted back by one day.

```javascript
// Proof of the bug
const timestamp = 1782259200000; // Stored value for "2026-06-24"
new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'UTC' });           // "6/24/2026" (correct)
new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York' }); // "6/23/2026" (WRONG)
```

## Fix

### Backend (`backend/src/validation/schemas.js`)

Changed the Joi validation for the `date` field from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`.

**Before:**
```javascript
date: Joi.date().iso().required()
```

**After:**
```javascript
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
  'string.pattern.base': '"date" must be a valid ISO date (YYYY-MM-DD)'
})
```

This ensures dates are stored in SQLite as ISO date strings (`"2026-06-24"`) rather than being converted to timestamps.

### Frontend (date display utilities)

Created `frontend/src/utils/dateUtils.ts` with two functions:

- **`formatDate()`**: Parses `YYYY-MM-DD` strings by extracting year/month/day components directly, avoiding UTC-to-local conversion.
- **`parseDateString()`**: Creates local `Date` objects from date strings for the date picker, using explicit year/month/day construction instead of `new Date(dateStr)`.

Updated all pages (`WorkEntriesPage`, `DashboardPage`, `ReportsPage`) to use these utilities instead of `new Date(entry.date).toLocaleDateString()`.

Also fixed the date submission in `WorkEntriesPage` to format dates using local date components (`getFullYear`/`getMonth`/`getDate`) instead of `toISOString().split('T')[0]`, which could cause the same off-by-one issue in reverse for users in UTC-positive timezones.

## Other Bugs Found During Exploration

1. **Missing `PRAGMA foreign_keys = ON`**: SQLite does not enforce foreign key constraints by default. Without this pragma, `ON DELETE CASCADE` on `work_entries.client_id` does not work — deleting a client leaves orphaned work entries hidden by the JOIN query.

2. **Health endpoint not proxied**: The `ApiClient.healthCheck()` method calls `/health`, but the Vite proxy only forwards `/api` requests to the backend. This would cause a 404 in development.
