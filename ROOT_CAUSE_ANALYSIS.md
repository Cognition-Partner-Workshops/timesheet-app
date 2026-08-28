# Root Cause Analysis: Work Entry Dates Stored as Millisecond Timestamps

## Bug Summary

Work entry dates are stored in the SQLite database as millisecond timestamps (e.g., `1775088000000`) instead of ISO date strings (e.g., `2026-04-02`), causing CSV and PDF exports to display unintelligible numeric values instead of human-readable dates.

## Symptoms Observed

1. **CSV exports show raw timestamps**: The Date column in exported CSV files contains values like `1775088000000` instead of `2026-04-02`
2. **PDF exports show raw timestamps**: The same issue affects PDF report generation
3. **API responses return numeric dates**: The REST API returns `"date": 1775088000000` instead of `"date": "2026-04-02"`
4. **UI appears unaffected**: The frontend masks the bug by passing timestamps through `new Date(entry.date).toLocaleDateString()`, which handles both strings and numbers

## Root Cause

The bug originates from a type coercion mismatch between the Joi validation layer and the SQLite database.

**Validation schema** (`backend/src/validation/schemas.js`, line 14):
```js
date: Joi.date().iso().required()
```

`Joi.date().iso()` validates that the input is a valid ISO 8601 date string, but **silently converts the string to a JavaScript `Date` object** as part of its default behavior. When the validated value is destructured and passed to the SQLite `INSERT` or `UPDATE` statement, the `Date` object is coerced to its numeric representation (milliseconds since Unix epoch) by SQLite's type affinity system.

**Affected route handler** (`backend/src/routes/workEntries.js`):
```js
// Before fix - `date` is a Date object, not a string
const { clientId, hours, description, date } = value;
db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date]);
```

The `date` parameter bound to the SQL query is a `Date` object. The `sqlite3` Node.js driver serializes `Date` objects as their `.getTime()` value (milliseconds), resulting in values like `1775088000000` being stored in the `date` column.

## Impact Assessment

- **Severity**: High
- **Affected features**: CSV export, PDF export, API responses
- **Data integrity**: All work entry dates in the database are stored as millisecond timestamps instead of date strings. While the data is not lost (timestamps can be converted back), any system or user consuming raw data (exports, API integrations, database queries) sees meaningless numbers.
- **User impact**: Any user who exports a time report to CSV or PDF receives a file with unreadable date values, making the reports unusable for billing, invoicing, or record-keeping purposes.

## Fix Description

**File changed**: `backend/src/routes/workEntries.js`

The fix converts the Joi-validated `Date` object back to an ISO date string (`YYYY-MM-DD`) before passing it to the SQLite query, in both the create and update handlers:

```js
// Create handler
const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;

// Update handler
const dateStr = value.date instanceof Date ? value.date.toISOString().split('T')[0] : value.date;
```

This ensures:
- Dates are stored as human-readable strings in SQLite (`2026-04-02`)
- CSV/PDF exports display correct dates
- API responses return proper date strings
- The frontend continues to work correctly (it already handles both formats)
- The `instanceof Date` guard ensures backward compatibility if the input is already a string

## Verification Steps

1. Start the backend server: `cd backend && npm run dev`
2. Create a client and work entries via the API or UI
3. Export the client report as CSV: `GET /api/reports/export/csv/:clientId`
4. Verify the Date column contains `YYYY-MM-DD` formatted dates (not numeric timestamps)
5. Verify the API response for work entries returns string dates
6. Run the test suite: `cd backend && npm test` (all 161 tests pass)

## Additional Bugs Found (Not Fixed)

1. **No `PRAGMA foreign_keys = ON`**: SQLite has foreign keys defined in the schema but does not explicitly enable the pragma. Foreign key cascades work in the current SQLite version by default, but this is version-dependent and could silently fail in other environments. (Severity: Low)

2. **Delete-all-clients endpoint exposed without confirmation**: `DELETE /api/clients` deletes all clients for a user. While the frontend shows a confirmation dialog, the API endpoint itself has no safeguard against accidental bulk deletion from API consumers. (Severity: Low)
