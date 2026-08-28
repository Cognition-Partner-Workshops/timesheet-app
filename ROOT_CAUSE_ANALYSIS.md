# Root Cause Analysis: Date Fields Stored as Epoch Timestamps

## Bug Summary

Work entry dates were stored in SQLite as epoch millisecond timestamps (e.g., `1775520000000`) instead of human-readable date strings (e.g., `2026-04-07`). This caused CSV and PDF report exports to display raw numeric timestamps instead of formatted dates, making exported reports unusable.

## Symptoms

- **CSV exports** showed dates like `1775520000000` instead of `2026-04-07`
- **PDF exports** rendered epoch numbers in the Date column
- **API responses** returned `"date": 1775520000000` instead of `"date": "2026-04-07"`
- The **frontend UI** was unaffected because `new Date(epochMs).toLocaleDateString()` can parse epoch timestamps, masking the underlying data issue

### Before Fix — CSV Export
```
Date,Hours,Description,Created At
1775520000000,8,Frontend development - homepage redesign,2026-04-07 06:03:13
1773532800000,3,Testing date format,2026-04-07 06:04:32
```

### After Fix — CSV Export
```
Date,Hours,Description,Created At
2026-04-07,8,Frontend development,2026-04-07 06:06:35
2026-03-15,3,Testing date format,2026-04-07 06:06:36
```

## Root Cause

The bug was in `backend/src/validation/schemas.js`. The Joi validation schemas for work entries used `Joi.date().iso()` to validate the `date` field:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` does two things:
1. Validates that the input is a valid ISO 8601 date string
2. **Converts the string to a JavaScript `Date` object** as part of Joi's type coercion

When the converted `Date` object was then passed to SQLite via a parameterized INSERT query, SQLite stored the numeric representation of the Date object — its epoch millisecond timestamp — rather than the original `YYYY-MM-DD` string.

This affected both the `workEntrySchema` (used for creating entries) and the `updateWorkEntrySchema` (used for updating entries).

## Why It Wasn't Caught Earlier

The bug was masked in the frontend because JavaScript's `new Date()` constructor accepts both ISO date strings and epoch timestamps. The frontend code `new Date(entry.date).toLocaleDateString()` worked correctly with either format, so dates displayed properly in the browser UI. The bug only became visible when:
- Exporting reports to CSV (raw database values used directly)
- Exporting reports to PDF (raw database values used directly)
- Inspecting API responses directly

## Fix Applied

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern()` to validate the date format while preserving the original string value:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': '"date" must be in YYYY-MM-DD format' })
```

This change:
- Still validates that the date is in `YYYY-MM-DD` format
- **Preserves the date as a string** so SQLite stores `"2026-04-07"` instead of `1775520000000`
- Provides a clear error message when validation fails
- Was applied to both `workEntrySchema` and `updateWorkEntrySchema`

## Files Changed

- `backend/src/validation/schemas.js` — Changed `date` field validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`

## Verification

- All 161 existing backend tests pass after the fix
- CSV exports now show human-readable dates
- API responses return date strings instead of epoch timestamps
- Frontend UI continues to work correctly (since `new Date("2026-04-07")` also works)
- Frontend lint checks pass
