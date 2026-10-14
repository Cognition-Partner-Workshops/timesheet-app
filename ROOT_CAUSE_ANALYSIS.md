# Root Cause Analysis: Work Entry Dates Stored and Exported as Unix Timestamps

## Bug Summary

Work entry dates are stored in SQLite as Unix timestamps (milliseconds) instead of ISO date strings (e.g., `2026-06-24`). This causes CSV and PDF report exports to display raw numeric timestamps like `1782259200000` instead of human-readable dates, making exported reports unusable.

## Symptoms

- **CSV export**: The `Date` column shows `1782259200000` instead of `2026-06-24`
- **PDF export**: The date column in the generated PDF shows the raw timestamp number
- **API responses**: The `/api/reports/client/:id` and `/api/work-entries` endpoints return `"date": 1782259200000` instead of `"date": "2026-06-24"`
- **Frontend display**: Appears correct because the frontend applies `new Date(entry.date).toLocaleDateString()`, which happens to handle both timestamps and date strings

### Before Fix (CSV export)

```
Date,Hours,Description,Created At
1782259200000,8,Backend API development,2026-06-24 14:07:31
```

### After Fix (CSV export)

```
Date,Hours,Description,Created At
2026-06-24,8,Backend API development,2026-06-24 14:19:41
```

## Root Cause

The bug originates in `backend/src/validation/schemas.js` where the Joi validation schema for work entries used `Joi.date().iso()` for the `date` field:

```js
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()   // <-- converts string to Date object
});
```

### What happens step-by-step

1. The frontend sends a work entry with `"date": "2026-06-24"` (an ISO date string)
2. Joi's `Joi.date().iso()` validator **validates** the string but also **converts** it to a JavaScript `Date` object
3. The route handler then passes `value.date` (now a `Date` object) to the SQLite INSERT statement
4. SQLite has no native `Date` type. The `sqlite3` Node.js driver serializes the `Date` object as its numeric representation: the Unix timestamp in milliseconds (e.g., `1782259200000`)
5. On retrieval, SQLite returns the raw number `1782259200000`
6. The CSV writer and PDF generator output this number directly as the date value
7. The frontend happens to work because `new Date(1782259200000)` reconstructs the correct date from the timestamp

### Why it was hard to catch

The bug is invisible in the frontend UI because JavaScript's `new Date()` constructor accepts both ISO strings and numeric timestamps. The issue only manifests in backend outputs (CSV, PDF, API JSON) where the date value is used as-is without conversion.

## Fix Applied

Changed the date validation in `backend/src/validation/schemas.js` from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` for both `workEntrySchema` and `updateWorkEntrySchema`:

```js
// AFTER (fixed)
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()  // keeps date as string
});
```

This ensures:

1. The date is still validated to be in `YYYY-MM-DD` format
2. The date remains a string throughout the data pipeline
3. SQLite stores the date as the text value `"2026-06-24"`
4. CSV, PDF, and API responses all return human-readable dates
5. The frontend continues to work since `new Date("2026-06-24")` is valid

## Files Changed

- `backend/src/validation/schemas.js`: Changed `date` field validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`

## Test Results

All 161 existing tests continue to pass across all 8 test suites after the fix.

## Other Bugs Found During Exploration

1. **CORS misconfiguration in `.env.example`**: The `FRONTEND_URL` defaults to `http://localhost:3000` but the Vite frontend runs on port `5173`. Users following the setup guide verbatim would encounter CORS errors.

2. **Missing `/health` proxy**: The frontend API client calls `/health` but the Vite proxy only forwards `/api` requests. The health check would fail from the frontend.

3. **Dangerous bulk delete endpoint**: `DELETE /api/clients` (no ID) deletes ALL clients for a user. While the frontend has a "Clear All" button for this, the endpoint lacks any confirmation safeguard and could cause accidental data loss.
