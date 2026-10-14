# Root Cause Analysis: Date Storage Bug in Work Entries

## Bug Summary

Work entry dates are stored in SQLite as millisecond timestamps (e.g., `1775520000000`) instead of ISO date strings (e.g., `"2026-04-07"`). This causes **exported CSV and PDF reports to display raw numeric timestamps** instead of human-readable dates, making reports unusable for end users.

## Symptoms

- **CSV exports** show timestamps like `1775520000000` in the Date column instead of `2026-04-07`
- **PDF exports** render the same raw timestamps in the date column
- **API responses** return numeric timestamps for the `date` field instead of date strings
- The **frontend display** coincidentally works because JavaScript's `new Date()` can parse millisecond timestamps, masking the underlying data corruption

## Root Cause

The bug originates in `backend/src/validation/schemas.js` where Joi validation schemas use `Joi.date().iso()` for the date field:

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

### What happens step by step:

1. The frontend sends a valid ISO date string: `"2026-04-07"`
2. Joi's `Joi.date().iso()` **validates** the string, then **converts** it into a JavaScript `Date` object: `Date(2026-04-07T00:00:00.000Z)`
3. The `Date` object is passed to the SQLite `INSERT` statement
4. SQLite's `sqlite3` driver serializes the `Date` object by calling `.valueOf()`, which returns the **millisecond timestamp**: `1775520000000`
5. The numeric value `1775520000000` is stored in the `date DATE` column
6. When the data is read back, it comes out as the number `1775520000000` instead of the string `"2026-04-07"`

### Why the frontend appeared unaffected:

The frontend uses `new Date(entry.date).toLocaleDateString()` to display dates. Since `new Date(1775520000000)` produces the correct date, the display looks correct. This masked the bug from being caught during development.

### Why exports were broken:

The CSV writer and PDF generator use the raw `entry.date` value directly without conversion. Since the value is `1775520000000` (a number), it gets written as-is into the export files, producing unusable reports.

## Fix

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern()` with a regex that validates YYYY-MM-DD format while keeping the value as a string:

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
    .message('"date" must be a valid ISO date string (YYYY-MM-DD)')
    .required()
});
```

This ensures:
- The date format is still validated (must be YYYY-MM-DD)
- The value remains a string throughout the pipeline
- SQLite stores the date as a proper text value `"2026-04-07"`
- CSV/PDF exports display the correct human-readable date
- Frontend display continues to work correctly
- All 161 existing tests continue to pass

## Impact

- **Severity**: High - All exported reports (CSV and PDF) were completely unusable
- **Scope**: Every work entry created through the application was affected
- **Users affected**: All users who attempted to export time reports

## Files Changed

- `backend/src/validation/schemas.js` - Changed `workEntrySchema` and `updateWorkEntrySchema` date validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` with a descriptive error message

## Verification

### Before fix:
```
Date,Hours,Description,Created At
1775520000000,8,Backend API development,2026-04-07 05:54:20
```

### After fix:
```
Date,Hours,Description,Created At
2026-04-07,8,Backend API development,2026-04-07 05:56:38
```
