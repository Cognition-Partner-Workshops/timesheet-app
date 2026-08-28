# Root Cause Analysis: Date Timestamps in Work Entry Exports

## Bug Summary

Work entry dates appear as raw numeric timestamps (e.g., `1775779200000`) instead of human-readable date strings (e.g., `2026-04-10`) in CSV exports, PDF exports, and API responses. This renders exported reports unusable for clients and accounting purposes.

## Symptoms

- **CSV Export**: The "Date" column contains Unix timestamps in milliseconds (e.g., `1775779200000`) instead of formatted dates.
- **PDF Export**: Dates in the generated PDF document are numeric timestamps rather than readable dates.
- **API Responses**: The `/api/reports/client/:clientId` and `/api/work-entries` endpoints return `date` fields as numbers instead of strings.
- **Frontend Display**: The UI appeared correct because the frontend converts timestamps using `new Date(timestamp).toLocaleDateString()`, which masked the underlying data issue.

### Example (Before Fix)

**CSV output:**
```
Date,Hours,Description,Created At
1775779200000,7.25,Database optimization,2026-04-13 14:04:27
1775606400000,6.5,Code review and testing,2026-04-13 14:04:26
```

**API response:**
```json
{
  "date": 1775520000000
}
```

## Root Cause

The bug originates in `backend/src/validation/schemas.js`. The Joi validation schemas for work entry creation and update used `Joi.date().iso()` for the `date` field:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` performs two operations:
1. **Validates** that the input is a valid ISO date string.
2. **Converts** the string into a JavaScript `Date` object.

When the converted `Date` object is passed to the SQLite `INSERT` statement, the `sqlite3` Node.js driver serializes it as a numeric Unix timestamp in milliseconds (e.g., `1775520000000`). SQLite stores this number in the `date` column instead of the original `"2026-04-07"` string.

On subsequent reads, SQLite returns the raw numeric value. The frontend happened to handle this gracefully (since `new Date(1775520000000)` produces a valid date), but any consumer reading the raw data -- CSV exports, PDF generation, API integrations -- received unusable numeric timestamps.

## Fix

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern()` with an explicit YYYY-MM-DD regex:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
  .messages({ 'string.pattern.base': 'Date must be in YYYY-MM-DD format' })
```

This preserves the date as a plain string throughout the entire pipeline:
- Joi validates the format without converting the type.
- SQLite stores the original `"2026-04-07"` string.
- All reads return the human-readable date string.
- CSV/PDF exports display correct dates.

### Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | Replaced `Joi.date().iso()` with `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema` |

### Example (After Fix)

**CSV output:**
```
Date,Hours,Description,Created At
2026-04-10,7.25,Database optimization,2026-04-13 14:08:55
2026-04-08,6.5,Code review and testing,2026-04-13 14:08:55
```

**API response:**
```json
{
  "date": "2026-04-07"
}
```

## Impact

- **High**: CSV and PDF exports were generating reports with unreadable timestamps in the Date column, making them useless for billing, invoicing, and time tracking review.
- **Medium**: Any external API consumer receiving work entry data would need to know to convert millisecond timestamps, which is undocumented and unexpected.
- **Low**: The frontend UI masked the issue, so end users browsing the web app saw correct dates.

## Prevention

- Add integration tests that verify CSV/PDF export output contains properly formatted date strings.
- Consider adding a response serialization layer that enforces consistent date formats across all API endpoints.
- Prefer `Joi.string()` with explicit format patterns over `Joi.date()` when the goal is to store and return dates as strings rather than Date objects.
