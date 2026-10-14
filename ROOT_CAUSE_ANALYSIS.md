# Root Cause Analysis: Date Timestamps in CSV/PDF Exports

## Bug Summary

CSV and PDF report exports displayed raw Unix timestamps (e.g., `1777507200000`) in the Date column instead of human-readable dates (e.g., `2026-04-30`). This made exported reports unusable for end users and external stakeholders.

## Affected Features

- **CSV Export** (`GET /api/reports/export/csv/:clientId`) — Date column contained numeric timestamps
- **PDF Export** (`GET /api/reports/export/pdf/:clientId`) — Date column contained numeric timestamps
- **Report API** (`GET /api/reports/client/:clientId`) — Date field returned as number (masked in UI by frontend formatting)

## Root Cause

The bug originated in `backend/src/validation/schemas.js` where the Joi validation schema for work entries used `Joi.date().iso()` to validate the date field:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

### How the bug propagated:

1. **Frontend** sends a date as an ISO string: `"2026-04-30"`
2. **Joi validation** (`Joi.date().iso()`) validates the format but **converts the string into a JavaScript `Date` object**
3. **SQLite INSERT** receives the `Date` object and stores it as a **numeric timestamp** (milliseconds since Unix epoch: `1777507200000`) because SQLite has no native Date type and falls back to the numeric representation of a JS Date
4. **SELECT queries** return the raw numeric value from the database
5. **Frontend UI** worked around this by passing the value through `new Date(entry.date).toLocaleDateString()`, which correctly interprets the number as a timestamp
6. **CSV/PDF exports** wrote the raw database value directly, resulting in numeric timestamps in exported files

## Why It Wasn't Caught

- The **frontend UI** masked the issue by converting timestamps back to dates with `new Date()`
- The **in-memory database** (SQLite `:memory:`) made it hard to inspect stored values directly
- No integration tests verified the content of exported CSV/PDF files

## Fix

Changed the Joi validation to use a string pattern instead of `Joi.date().iso()`:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This ensures:
- The date is still validated as a properly formatted `YYYY-MM-DD` string
- The value is stored in SQLite as a **text string**, preserving the human-readable format
- All downstream consumers (API, CSV, PDF, UI) receive a consistent `YYYY-MM-DD` string
- SQLite date functions and ordering still work correctly with `YYYY-MM-DD` text format

## Files Changed

- `backend/src/validation/schemas.js` — Changed `workEntrySchema.date` and `updateWorkEntrySchema.date` from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`

## Verification

### Before Fix
```
CSV: 1777507200000,8,Frontend development for dashboard,2026-04-30 14:58:50
PDF: 1777507200000  8  Frontend development for dashboard
```

### After Fix
```
CSV: 2026-04-30,8,Frontend development for dashboard,2026-04-30 15:03:53
PDF: 2026-04-30  8  Frontend development for dashboard
```

## Impact Assessment

- **Severity**: High — core reporting/export feature was broken
- **User Impact**: All exported reports (CSV and PDF) contained unreadable date values, rendering them useless for record-keeping, invoicing, and client reporting
- **Scope**: Every work entry's date was affected in every export
