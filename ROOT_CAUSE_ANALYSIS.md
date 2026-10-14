# Root Cause Analysis: Work Entry Dates Stored as Millisecond Timestamps

## Bug Summary

Work entry dates were stored in SQLite as raw millisecond epoch values (e.g., `1777507200000`) instead of human-readable date strings (e.g., `2026-04-30`). This caused **CSV and PDF report exports** to display meaningless numeric timestamps in the Date column, and produced incorrect raw data in API responses.

## Impact

- **CSV exports** showed `1777507200000` instead of `2026-04-30` in the Date column
- **PDF exports** rendered numeric timestamps instead of formatted dates
- **API responses** returned millisecond values, forcing all consumers to handle conversion
- The bug was **masked in the browser UI** because JavaScript's `new Date(1777507200000)` auto-converts milliseconds back to dates, so the frontend appeared to work correctly

## Root Cause

The Joi validation schema in `backend/src/validation/schemas.js` used `Joi.date().iso()` for the `date` field:

```javascript
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` validates that the input is a valid ISO date string, but then **converts the value from a string to a JavaScript `Date` object**. When the `Date` object is passed as a parameter to the SQLite `INSERT` query, the `sqlite3` driver calls `.valueOf()` on it, which returns the number of milliseconds since the Unix epoch. SQLite then stores this numeric value instead of the original date string.

### Data Flow (Before Fix)

```
Frontend sends: "2026-04-30"
    -> Joi.date().iso() converts to: Date object (Wed Apr 30 2026 00:00:00 GMT+0000)
    -> SQLite driver stores: 1777507200000 (Date.valueOf())
    -> API returns: 1777507200000
    -> CSV export writes: "1777507200000"
```

## Fix

Changed the Joi schema to validate the date as a **string** using a regex pattern, which preserves the original `YYYY-MM-DD` format throughout the data pipeline:

```javascript
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': 'date must be in YYYY-MM-DD format' })
```

### Data Flow (After Fix)

```
Frontend sends: "2026-04-30"
    -> Joi.string().pattern() validates and keeps: "2026-04-30"
    -> SQLite driver stores: "2026-04-30" (string as-is)
    -> API returns: "2026-04-30"
    -> CSV export writes: "2026-04-30"
```

## Files Changed

- `backend/src/validation/schemas.js` - Changed `workEntrySchema.date` and `updateWorkEntrySchema.date` from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` with a descriptive validation error message.

## Verification

- Work entries now store dates as `"2026-04-30"` strings in SQLite
- CSV exports show proper date values
- Frontend date display continues to work correctly
- Invalid date formats are still rejected with a clear error message: `"date must be in YYYY-MM-DD format"`
