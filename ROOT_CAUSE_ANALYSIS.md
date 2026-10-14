# Root Cause Analysis: Work Entry Dates Stored as Numeric Timestamps

## Bug Summary

Work entry dates are stored in the SQLite database as millisecond timestamps (e.g., `1778544000000`) instead of ISO date strings (e.g., `"2026-05-12"`). This causes CSV and PDF exports to display raw numeric values instead of human-readable dates, and introduces potential timezone-related off-by-one day errors in the frontend.

## Impact

- **Critical**: CSV exports show `1778544000000` in the Date column instead of `2026-05-12`
- **Critical**: PDF exports render the same unreadable numeric timestamps
- **Moderate**: API responses return numeric timestamps, which the frontend displays correctly only because `new Date(timestamp)` works — but this masks the underlying data integrity issue
- **Moderate**: In timezones behind UTC, `new Date(1778544000000)` could render as the previous day (e.g., May 11 instead of May 12), causing off-by-one date display errors

## Root Cause

The bug originates in `backend/src/validation/schemas.js`. The Joi validation schemas for work entries used:

```js
date: Joi.date().iso().required()   // workEntrySchema
date: Joi.date().iso().optional()   // updateWorkEntrySchema
```

`Joi.date().iso()` validates that the input is a valid ISO date string, but **also converts the string into a JavaScript `Date` object** as part of validation. When this `Date` object is passed to SQLite via a parameterized query placeholder (`?`), the `node-sqlite3` library calls `.valueOf()` on the object, which returns the number of milliseconds since the Unix epoch.

### Data Flow (Before Fix)

1. Frontend sends `{ "date": "2026-05-12" }` (a string)
2. Joi validates and **converts** it to `new Date("2026-05-12")` (a Date object representing `2026-05-12T00:00:00.000Z`)
3. Route handler destructures `value.date` (now a Date object) and passes it to the SQL INSERT
4. `node-sqlite3` calls `.valueOf()` on the Date object, storing `1778544000000` (milliseconds) in the `date` column
5. Queries return the numeric value; CSV/PDF exports write it as-is

## Fix Applied

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`:

```js
// Before (converts string -> Date object -> stored as number)
date: Joi.date().iso().required()

// After (keeps the string as-is -> stored as "YYYY-MM-DD")
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This validates that the date is in `YYYY-MM-DD` format while preserving it as a string, so SQLite stores the readable date string directly.

### Data Flow (After Fix)

1. Frontend sends `{ "date": "2026-05-12" }` (a string)
2. Joi validates the format but **keeps it as a string**
3. Route handler passes `"2026-05-12"` (string) to the SQL INSERT
4. `node-sqlite3` stores `"2026-05-12"` as text in the `date` column
5. Queries return `"2026-05-12"`; CSV/PDF exports display it correctly

## Verification

**Before fix** — CSV export:
```
Date,Hours,Description,Created At
1778544000000,8,Backend API development,2026-05-12 15:02:03
```

**After fix** — CSV export:
```
Date,Hours,Description,Created At
2026-05-12,8,Backend API development,2026-05-12 15:04:37
```

## Files Changed

- `backend/src/validation/schemas.js` — Changed date validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`

## Lessons Learned

- `Joi.date()` silently coerces strings into Date objects, which can cause unexpected type changes when the downstream consumer (SQLite via node-sqlite3) serializes the value differently than expected.
- Integration testing of the full data path (validation -> storage -> retrieval -> export) would have caught this bug earlier.
- Dates should be stored as strings in `YYYY-MM-DD` format in SQLite for maximum portability and readability.
