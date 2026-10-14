# Root Cause Analysis: Date Fields Stored as Epoch Milliseconds

## Bug Summary

Work entry dates are stored in SQLite as **epoch milliseconds** (e.g., `1776038400000`) instead of ISO date strings (e.g., `"2026-04-13"`). This causes CSV and PDF exports to display raw numeric timestamps instead of human-readable dates, making exported reports unusable.

## Symptoms

### CSV Export (Before Fix)
```
Date,Hours,Description,Created At
1776038400000,8,Backend API development,2026-04-13 13:54:59
1775952000000,6,Database optimization,2026-04-13 13:55:22
1775779200000,5.5,Frontend UI work,2026-04-13 13:55:21
```

### API Response (Before Fix)
```json
{
  "date": 1776038400000
}
```

### Impact
- **CSV exports are unusable** — the Date column shows raw epoch numbers
- **PDF exports show raw timestamps** — same issue in generated PDF reports
- **API responses return inconsistent date formats** — the frontend happens to tolerate this because `new Date(epochMs)` still works, but it's fragile and semantically wrong

## Root Cause

The bug originates in **`backend/src/validation/schemas.js`**, specifically in the Joi validation schemas for work entries.

### The Problematic Code

```javascript
// workEntrySchema
date: Joi.date().iso().required()

// updateWorkEntrySchema
date: Joi.date().iso().optional()
```

### Why This Causes the Bug

1. **Joi's `date().iso()` converts strings to Date objects**: When the frontend sends `"2026-04-13"` as a date string, Joi's `date().iso()` validator accepts the ISO format but **converts the string into a JavaScript `Date` object** as part of its validation/coercion process.

2. **SQLite stores Date objects as epoch milliseconds**: When a JavaScript `Date` object is passed to SQLite via a parameterized query (`INSERT INTO work_entries ... VALUES (?, ?, ?, ?, ?)`), SQLite's JavaScript driver serializes it as an integer (epoch milliseconds). So `new Date("2026-04-13")` becomes `1776038400000` in the database.

3. **The stored value propagates to all read paths**: When the data is read back from SQLite, the `date` field comes back as the integer `1776038400000` instead of the string `"2026-04-13"`. This raw value flows into:
   - API JSON responses
   - CSV file generation (via `csv-writer`)
   - PDF generation (via `pdfkit`)

4. **The frontend accidentally masks the bug**: The frontend uses `new Date(entry.date).toLocaleDateString()` to display dates. Since `new Date(1776038400000)` produces a valid Date object, the UI displays dates correctly — hiding the fact that the underlying data is wrong. However, the CSV and PDF exports write the raw database value directly, exposing the bug.

## The Fix

**File changed**: `backend/src/validation/schemas.js`

Replace `Joi.date().iso()` with `Joi.string().pattern()` to keep dates as ISO strings throughout the data pipeline:

```javascript
// Before (broken):
date: Joi.date().iso().required()

// After (fixed):
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
  'string.pattern.base': 'Date must be in YYYY-MM-DD format'
})
```

This change ensures that:
- Dates are validated to match the `YYYY-MM-DD` format
- Dates remain as strings throughout the entire pipeline (validation → storage → retrieval → export)
- No type coercion occurs — what goes into the database is exactly what comes out
- CSV and PDF exports display proper date strings
- The frontend continues to work correctly since `new Date("2026-04-13")` is also valid

### CSV Export (After Fix)
```
Date,Hours,Description,Created At
2026-04-13,8,Backend API development,2026-04-13 13:58:29
2026-04-12,6,Database optimization,2026-04-13 13:58:30
2026-04-10,5.5,Frontend UI work,2026-04-13 13:58:29
```

## Verification

- All **161 existing tests pass** after the fix (8 test suites, 0 failures)
- CSV export now shows proper `YYYY-MM-DD` date strings
- API responses return date strings instead of epoch integers
- Frontend date display continues to work correctly
- Work entry creation and editing work with proper date validation

## Other Bugs Found During Exploration

1. **No JWT tokens issued** — The README describes JWT-based authentication, but the login endpoint never generates/returns JWT tokens. Auth is purely email-header-based (`x-user-email`).
2. **Dangerous bulk delete endpoint** — `DELETE /api/clients` deletes ALL clients for a user with no additional safeguards beyond a frontend `window.confirm` dialog.
