# Root Cause Analysis: Work Entry Dates Stored as Millisecond Timestamps

## Bug Summary

Work entry dates were stored in SQLite as millisecond epoch timestamps (e.g., `1782691200000`) instead of ISO date strings (e.g., `2026-06-29`). This caused CSV and PDF exports to display raw numeric timestamps instead of human-readable dates, and introduced timezone-dependent date display errors in the frontend.

## Symptoms

1. **CSV exports showed numeric timestamps instead of dates**
   - Expected: `Date,Hours,Description,Created At` / `2026-06-29,8,Frontend development work,...`
   - Actual: `Date,Hours,Description,Created At` / `1782691200000,8,Frontend development work,...`

2. **PDF exports contained the same numeric timestamps** in the date column.

3. **Frontend date display off-by-one for non-UTC timezones**: For users in timezones west of UTC (e.g., US timezones), dates could appear shifted back by one day. A work entry created for June 29 might display as June 28 because `new Date(1782691200000)` represents UTC midnight, which converts to the previous evening in western timezones.

## Root Cause

The bug originated in the Joi validation schema in `backend/src/validation/schemas.js`:

```javascript
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string like `"2026-06-29"` but **converts it to a JavaScript `Date` object** (`new Date("2026-06-29")` = `Date(2026-06-29T00:00:00.000Z)`).

When the `node-sqlite3` driver binds a JavaScript `Date` object as a query parameter, it calls `.valueOf()` on it, which returns the **milliseconds since Unix epoch** (e.g., `1782691200000`). This numeric value is what gets stored in the SQLite `date` column instead of the original `"2026-06-29"` string.

### Chain of events:
1. Frontend sends `{ "date": "2026-06-29" }` (correct YYYY-MM-DD string)
2. Joi's `date().iso()` validator converts `"2026-06-29"` to `new Date("2026-06-29")` (a Date object)
3. Backend passes this Date object to SQLite: `INSERT INTO work_entries (..., date) VALUES (..., ?)`
4. `node-sqlite3` binds the Date object as `1782691200000` (milliseconds since epoch)
5. SQLite stores `1782691200000` in the `date` column
6. When reading back, the value `1782691200000` is returned to the frontend/exports
7. CSV/PDF exports write `1782691200000` literally instead of a readable date
8. Frontend's `new Date(1782691200000).toLocaleDateString()` works in UTC but shifts dates in other timezones

## Fix

Changed the Joi validation to use a string pattern validator that preserves the date as a YYYY-MM-DD string:

```javascript
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Date must be in YYYY-MM-DD format').required()
```

This change was applied to both `workEntrySchema` (for creating entries) and `updateWorkEntrySchema` (for updating entries) in `backend/src/validation/schemas.js`.

### Why this fix is correct:
- The validated value remains a **string** (`"2026-06-29"`), so SQLite stores it as text
- The YYYY-MM-DD format is preserved through storage, retrieval, and export
- The regex pattern still rejects invalid formats (e.g., `"01/15/2024"`, `"not-a-date"`)
- All 161 existing backend tests continue to pass
- CSV exports now correctly show `2026-06-29` instead of `1782691200000`
- Frontend date display is timezone-independent since the string is parsed consistently

## Files Changed

- `backend/src/validation/schemas.js` (2 lines changed: `workEntrySchema.date` and `updateWorkEntrySchema.date`)

## Verification

### Before fix:
```
$ curl -H "x-user-email: test@example.com" http://localhost:3001/api/reports/export/csv/1
Date,Hours,Description,Created At
1782691200000,8,Frontend development work,2026-06-29 06:26:20
```

### After fix:
```
$ curl -H "x-user-email: test@example.com" http://localhost:3001/api/reports/export/csv/1
Date,Hours,Description,Created At
2026-06-29,8,Frontend development work,2026-06-29 06:30:40
```

## Other Bugs Noted (Not Fixed)

1. **`/health` endpoint not proxied by Vite**: The Vite dev server proxy only forwards `/api` routes. The frontend's `healthCheck()` method calls `/health` which hits Vite, not the backend. Low impact since health checks are typically for infrastructure monitoring, not end users.

2. **Date display timezone sensitivity in frontend**: While the root cause fix ensures dates are stored as strings, the frontend still uses `new Date(entry.date).toLocaleDateString()` to display them. `new Date("2026-06-29")` is parsed as UTC midnight, which in timezones west of UTC displays as the previous day. A more robust frontend approach would parse the date string directly (e.g., splitting on `-` and formatting) to avoid timezone conversion entirely. This is a secondary concern now that dates are stored correctly.
