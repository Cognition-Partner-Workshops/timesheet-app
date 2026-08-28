# Root Cause Analysis: Work Entry Date Stored as Unix Timestamp

## Bug Summary

Work entry dates are stored in SQLite as Unix timestamps in milliseconds (e.g., `1775520000000`) instead of ISO date strings (e.g., `2026-04-07`). This causes exported CSV and PDF reports to display raw numeric timestamps in the Date column, making them unreadable and unusable for end users.

## Symptoms

1. **CSV exports show raw timestamps**: The Date column displays values like `1775520000000` instead of `2026-04-07`
2. **PDF exports show raw timestamps**: Same issue in generated PDF reports
3. **API returns numeric dates**: The `/api/work-entries` and `/api/reports/client/:id` endpoints return `"date": 1775520000000` instead of `"date": "2026-04-07"`
4. **UI appears unaffected**: The frontend happens to work because `new Date(1775520000000).toLocaleDateString()` correctly interprets the timestamp, masking the underlying data issue

## Root Cause

The bug originates in `backend/src/validation/schemas.js`, specifically in the Joi validation schemas for work entries.

### The Problem

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

`Joi.date().iso()` performs two operations:
1. **Validates** that the input is a valid ISO date string
2. **Converts** the string into a JavaScript `Date` object

When the converted `Date` object is passed to SQLite via the parameterized INSERT query, SQLite's type affinity system stores it as a numeric value (the Unix timestamp in milliseconds). This is because JavaScript `Date` objects, when coerced to a primitive for storage, produce their numeric `.getTime()` value.

### Data Flow (Before Fix)

```
Frontend sends: { "date": "2026-04-07" }
    |
    v
Joi validates & converts: Date object (Mon Apr 07 2026 00:00:00 GMT+0000)
    |
    v
SQLite stores: 1775520000000 (numeric timestamp)
    |
    v
API returns: { "date": 1775520000000 }
    |
    v
CSV/PDF export: "1775520000000" (raw timestamp in output)
```

## Fix

Changed the date validation from `Joi.date().iso()` to `Joi.string().pattern()` to preserve the date as an ISO string throughout the data pipeline.

### The Solution

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': '"date" must be a valid ISO date string (YYYY-MM-DD)'
  })
});
```

This change:
- **Validates** the date format (YYYY-MM-DD) using a regex pattern
- **Preserves** the date as a string, so SQLite stores it as TEXT
- **Provides** a clear error message for invalid date formats

### Data Flow (After Fix)

```
Frontend sends: { "date": "2026-04-07" }
    |
    v
Joi validates (keeps as string): "2026-04-07"
    |
    v
SQLite stores: "2026-04-07" (TEXT)
    |
    v
API returns: { "date": "2026-04-07" }
    |
    v
CSV/PDF export: "2026-04-07" (correct human-readable date)
```

## Files Changed

- `backend/src/validation/schemas.js` - Changed `date` field validation in both `workEntrySchema` and `updateWorkEntrySchema` from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` with descriptive error messages.

## Impact Assessment

- **Severity**: High - CSV/PDF exports were producing incorrect, unreadable date values
- **Scope**: All work entry dates across the entire application
- **User Impact**: Any user exporting reports would receive files with numeric timestamps instead of dates, rendering the exports effectively useless for business purposes
- **Why the UI masked it**: The frontend used `new Date(entry.date).toLocaleDateString()` which happens to correctly interpret both timestamp numbers and date strings, so the bug was invisible in the browser

## Verification

**Before fix:**
```csv
Date,Hours,Description,Created At
1775520000000,8,Backend API development,2026-04-07 06:26:11
```

**After fix:**
```csv
Date,Hours,Description,Created At
2026-04-07,8,Backend API development,2026-04-07 06:31:21
```
