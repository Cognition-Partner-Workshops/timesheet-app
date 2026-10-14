# Root Cause Analysis: Date Storage Bug

## Bug Summary

Work entry dates are stored as epoch milliseconds (e.g., `1775520000000`) in the SQLite database instead of ISO date strings (e.g., `"2026-04-07"`). This causes corrupted date values in CSV/PDF exports and API responses.

## Symptoms

1. **CSV exports show epoch numbers instead of dates**: Exported reports display raw numeric timestamps like `1775520000000` in the Date column instead of human-readable dates like `2026-04-07`.
2. **API responses return numeric timestamps**: The `/api/work-entries` and `/api/reports/client/:id` endpoints return `"date": 1775520000000` instead of `"date": "2026-04-07"`.
3. **PDF reports contain epoch numbers**: Generated PDF documents show numeric timestamps in the date column.

### Impact

- **High** - All exported reports (CSV and PDF) are effectively unusable because dates appear as large numbers.
- Users receiving exported reports cannot interpret the date values.
- Any downstream system consuming the API would need to handle both epoch numbers and date strings.

## Root Cause

The bug originates in `backend/src/validation/schemas.js`. The Joi validation schemas for work entries used `Joi.date().iso()` for the date field:

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

### Why This Causes the Bug

1. The frontend sends dates as ISO strings: `"2026-04-07"` (via `formData.date.toISOString().split('T')[0]`).
2. `Joi.date().iso()` **validates** the ISO format but also **converts** the string into a JavaScript `Date` object (`2026-04-07T00:00:00.000Z`).
3. When SQLite receives a JavaScript `Date` object via a parameterized query, it stores it as an epoch timestamp in milliseconds (`1775520000000`).
4. On retrieval, SQLite returns the raw numeric value, which propagates through the API to the frontend and export functions.

### Data Flow (Before Fix)

```
Frontend: "2026-04-07" (string)
    ↓ POST /api/work-entries
Joi validation: Joi.date().iso() converts to Date object
    ↓
Backend route: Date object passed to SQLite INSERT
    ↓
SQLite: Stores as epoch number 1775520000000
    ↓
API response: Returns { "date": 1775520000000 }
    ↓
CSV export: Writes "1775520000000" to Date column
```

## Fix

Changed the Joi validation schema to use `Joi.string().pattern()` instead of `Joi.date().iso()`, keeping the date as an ISO string throughout the pipeline:

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': 'Date must be in YYYY-MM-DD format'
  })
});
```

### Data Flow (After Fix)

```
Frontend: "2026-04-07" (string)
    ↓ POST /api/work-entries
Joi validation: Validates format, keeps as string "2026-04-07"
    ↓
Backend route: String "2026-04-07" passed to SQLite INSERT
    ↓
SQLite: Stores as TEXT "2026-04-07"
    ↓
API response: Returns { "date": "2026-04-07" }
    ↓
CSV export: Writes "2026-04-07" to Date column
```

## Files Changed

- `backend/src/validation/schemas.js` - Changed `date` field validation in both `workEntrySchema` and `updateWorkEntrySchema` from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`.

## Verification

- All 161 backend tests pass.
- API responses now return proper ISO date strings.
- CSV exports show human-readable dates.
- Frontend date display and editing continue to work correctly.
- The new validation still rejects invalid date formats with a clear error message.

## Lessons Learned

- `Joi.date().iso()` is a validation + transformation — it converts strings to Date objects. When the downstream consumer (SQLite) doesn't handle JS Date objects natively, this silent transformation causes data corruption.
- String-based date validation (`Joi.string().pattern()`) is safer when the storage layer expects text values, as it preserves the original format without transformation.
