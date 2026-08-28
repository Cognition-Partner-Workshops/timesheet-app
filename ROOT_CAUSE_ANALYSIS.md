# Root Cause Analysis: Date Serialization Bug

## Bug Summary

Work entry dates are stored as numeric Unix timestamps in SQLite instead of ISO date strings, causing corrupted date values in API responses, CSV exports, and PDF exports.

## Symptoms

- **CSV Export**: The `Date` column displays raw Unix timestamps (e.g., `1775520000000`) instead of formatted dates like `2026-04-07`
- **API Responses**: All endpoints returning work entries (`GET /api/work-entries`, `GET /api/reports/client/:id`) return `date` as a number instead of a string
- **PDF Export**: Dates rendered as timestamps in generated PDF reports
- **UI**: The frontend happened to mask the bug because `new Date(1775520000000)` produces a valid JavaScript Date, so `toLocaleDateString()` still rendered a readable date — but the underlying data was wrong

## Root Cause

The bug originates in `backend/src/validation/schemas.js`, specifically in the Joi validation schemas for work entries:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

**What happens step by step:**

1. The frontend sends a date as an ISO string: `"2026-04-07"`
2. Joi's `date().iso()` validator **converts** the string into a JavaScript `Date` object: `Date("2026-04-07T00:00:00.000Z")`
3. The `Date` object is passed to SQLite's parameterized query: `INSERT INTO work_entries (..., date) VALUES (..., ?)`
4. SQLite's `better-sqlite3` / `sqlite3` driver serializes the JavaScript `Date` object as its numeric representation — the Unix timestamp in milliseconds: `1775520000000`
5. When the date is read back from SQLite, it comes back as the number `1775520000000` instead of the original string `"2026-04-07"`
6. This numeric value is returned directly in API responses and written into CSV/PDF exports

## Why It Wasn't Caught Earlier

- The frontend uses `new Date(entry.date).toLocaleDateString()` to display dates. Since `new Date(1775520000000)` produces a valid Date object, the UI still showed a correct-looking date — masking the underlying data corruption.
- The existing test suite passes dates through the same Joi validation, so the stored values were consistently timestamps. Tests that checked for the presence of a `date` field passed because the field existed (just with the wrong type).

## Fix

Changed the date validation from `Joi.date().iso()` to `Joi.string().pattern()` to preserve the date as an ISO string throughout the pipeline:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This was applied to both `workEntrySchema` (create) and `updateWorkEntrySchema` (update).

### Why This Fix Is Correct

- Dates are now stored in SQLite as ISO-8601 date strings (`"2026-04-07"`), which is SQLite's recommended text format for dates
- The regex `/^\d{4}-\d{2}-\d{2}$/` validates the expected `YYYY-MM-DD` format
- API responses return dates as human-readable strings
- CSV and PDF exports display correct date values
- The frontend's `new Date("2026-04-07")` parsing continues to work correctly
- All 161 existing tests pass with the fix

## Files Changed

- `backend/src/validation/schemas.js` — Changed `date` field validation in `workEntrySchema` and `updateWorkEntrySchema`

## Impact

- **Severity**: High — affects all date data across the entire application
- **Scope**: All work entry creation, updates, reports, and exports
- **Data affected**: Any work entries created before the fix have corrupted date values stored as timestamps
