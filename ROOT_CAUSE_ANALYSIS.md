# Root Cause Analysis: Date Stored as Epoch Number Instead of ISO String

## Bug Summary

Work entry dates are stored in SQLite as epoch millisecond numbers (e.g., `1775520000000`) instead of ISO date strings (e.g., `"2026-04-07"`). This causes dates to appear as raw numbers in CSV/PDF exports and can produce incorrect date displays in the frontend depending on the user's timezone.

## Affected Areas

| Area | Impact |
|------|--------|
| **CSV Export** | Date column shows `1775520000000` instead of `2026-04-07` |
| **PDF Export** | Date column shows epoch numbers instead of readable dates |
| **Report API** | `date` field returns number instead of string |
| **Work Entries API** | `date` field returns number instead of string |
| **Frontend date display** | May show wrong date in non-UTC timezones (off-by-one day) |
| **Work entry editing** | DatePicker may fail to parse epoch number correctly |

## Root Cause

The bug is in `backend/src/validation/schemas.js`. The Joi validation schemas used `Joi.date().iso()` for the date field:

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

`Joi.date().iso()` does two things:
1. Validates the input is a valid ISO date string
2. **Converts the string to a JavaScript `Date` object**

When this `Date` object is passed to SQLite via the parameterized query:

```javascript
db.run(
  'INSERT INTO work_entries (..., date) VALUES (..., ?)',
  [..., date]  // date is now a Date object, not a string
);
```

SQLite's `better-sqlite3` / `sqlite3` driver serializes the JavaScript `Date` object as its numeric epoch value (milliseconds since Unix epoch). The database column is defined as `DATE` but SQLite uses dynamic typing, so it accepts the number without error.

### Why it appeared to work in the UI

On machines running in UTC, `new Date(1775520000000).toLocaleDateString()` happens to produce the correct date. But for users in negative UTC offsets (e.g., US timezones), the epoch value `1775520000000` (which represents `2026-04-07T00:00:00.000Z`) would display as `4/6/2026` (the previous day) because the UTC midnight falls on the previous calendar day in their local timezone.

## Fix

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`:

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': '"date" must be a valid ISO date string (YYYY-MM-DD)' })
});
```

This ensures:
1. The date is validated as a properly formatted `YYYY-MM-DD` string
2. The date is **not** converted to a `Date` object
3. SQLite stores the value as a `TEXT` string, preserving the original format
4. All downstream consumers (API responses, CSV export, PDF export, frontend) receive a human-readable date string

## Verification

### Before Fix
```
GET /api/work-entries response:
  "date": 1775520000000

CSV Export:
  Date,Hours,Description,Created At
  1775520000000,4.5,Marketing campaign design,2026-04-07 05:59:40
```

### After Fix
```
GET /api/work-entries response:
  "date": "2026-04-07"

CSV Export:
  Date,Hours,Description,Created At
  2026-04-07,4.5,Marketing campaign design,2026-04-07 06:01:34
```

## Test Results

All 161 existing backend tests pass after the fix (8 test suites, 0 failures).

## Other Bugs Noted During Exploration

1. **Missing `PRAGMA foreign_keys = ON`**: SQLite foreign key constraints (including `ON DELETE CASCADE`) are not enforced because `PRAGMA foreign_keys` is not enabled in `database/init.js`. Deleting a client leaves orphaned work entries that silently disappear from listings (due to INNER JOIN) but remain in the database.

2. **No JWT token generation**: The login endpoint and auth middleware use `x-user-email` header for authentication, but the README describes JWT-based authentication. No JWT tokens are actually generated or validated.

3. **`DELETE /api/clients` (no ID)**: A route exists to delete ALL clients for a user with a single API call. While it has a frontend confirmation dialog, accidental invocation could cause significant data loss.
