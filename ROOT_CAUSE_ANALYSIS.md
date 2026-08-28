# Root Cause Analysis: Work Entry Dates Stored as Unix Timestamps

## Bug Summary

Work entry dates are stored in the SQLite database as Unix timestamps (milliseconds) instead of ISO date strings (e.g., `2026-04-07`). This causes **CSV and PDF exports to display raw numeric timestamps** instead of human-readable dates, rendering exported reports unusable.

## Symptoms

- **CSV exports** show dates as `1775520000000` instead of `2026-04-07`
- **PDF exports** contain numeric timestamps instead of formatted dates
- **API responses** return `"date": 1775520000000` instead of `"date": "2026-04-07"`
- The bug is masked in the browser UI because `new Date(1775520000000)` still renders correctly via `toLocaleDateString()`

## Root Cause

The issue originates in **`backend/src/validation/schemas.js`**, specifically in the Joi validation schemas for work entries:

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

**What happens:**

1. The frontend sends a date as an ISO string: `"2026-04-07"`
2. `Joi.date().iso()` validates the format but **converts the string into a JavaScript `Date` object**
3. When this `Date` object is passed to SQLite via the `sqlite3` driver, it is stored as its numeric `.getTime()` value (milliseconds since Unix epoch): `1775520000000`
4. All subsequent reads from the database return this numeric timestamp
5. CSV/PDF export code writes the raw database value directly, producing unreadable timestamps

## Impact

- **High**: All CSV and PDF report exports are broken — dates appear as meaningless 13-digit numbers
- **Medium**: API consumers receive timestamps instead of date strings, requiring client-side conversion
- **Low**: Browser UI is unaffected because `new Date(timestamp)` still works for display, but the underlying data format is incorrect

## Fix

Changed the Joi validation in `backend/src/validation/schemas.js` to use `Joi.string().pattern()` instead of `Joi.date().iso()`:

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': 'Date must be in YYYY-MM-DD format'
  })
});
```

This ensures:
- The date format is still validated (must be `YYYY-MM-DD`)
- The date is stored as a **string** in SQLite, preserving the human-readable format
- CSV/PDF exports display proper dates
- API responses return date strings as expected

The same fix was applied to `updateWorkEntrySchema` for the optional date field.

## Verification

- All 161 existing backend tests pass after the fix
- CSV export now shows `2026-04-07` instead of `1775520000000`
- API responses return `"date": "2026-04-07"` as expected
- Frontend lint passes cleanly

## Other Bugs Found During Exploration

During the application exploration, several additional issues were identified (not fixed in this PR):

1. **Missing `PRAGMA foreign_keys = ON`** — SQLite does not enforce foreign key constraints by default. Without this pragma, `ON DELETE CASCADE` on the `work_entries` table is silently ignored, leaving orphaned work entries when a client is deleted.

2. **Cannot clear optional client fields** — When editing a client, the frontend sends `undefined` for cleared optional fields (description, department, email) via `|| undefined`, which causes the backend to skip updating those fields. Once set, optional fields can never be removed.

3. **`DELETE /api/clients` deletes ALL clients** — The bulk delete endpoint has no confirmation or safeguard beyond a browser `confirm()` dialog, and doesn't cascade to work entries (see #1).
