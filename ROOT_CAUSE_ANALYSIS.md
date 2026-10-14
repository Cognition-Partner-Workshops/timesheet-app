# Root Cause Analysis: Dates Displayed as Unix Timestamps in CSV/PDF Exports

## Bug Summary

When exporting client time reports as CSV or PDF, the **Date column shows raw Unix timestamps** (e.g., `1782172800000`) instead of human-readable dates (e.g., `2026-06-23`). This makes all exported reports completely unusable for clients, accounting, or any downstream processing.

## Reproduction Steps

1. Log in to the application
2. Create a client (e.g., "Acme Corporation")
3. Add work entries with specific dates
4. Navigate to Reports, select the client
5. Export as CSV or PDF
6. Observe: Date column shows `1782172800000` instead of `2026-06-23`

## Root Cause

The bug originates from a **type coercion mismatch between Joi validation and SQLite storage**.

### Data Flow (Before Fix)

```
Frontend sends:  { "date": "2026-06-23" }           -- ISO date string
       |
Joi validates:   Joi.date().iso()                    -- converts string to JS Date object
       |
Route handler:   value.date = Date(2026-06-23T00:00:00.000Z)  -- now a Date object
       |
SQLite INSERT:   INSERT INTO work_entries (..., date) VALUES (..., ?)
       |                                                        ^
       |                              SQLite receives a Date object, stores it as
       |                              its numeric representation: 1782172800000
       |
SQLite SELECT:   entry.date = 1782172800000          -- raw timestamp number
       |
CSV/PDF export:  writes 1782172800000 directly       -- BUG: not a readable date
```

### The Specific Issue

In `backend/src/validation/schemas.js`, the work entry schema uses:

```javascript
date: Joi.date().iso().required()
```

`Joi.date().iso()` validates that the input is a valid ISO date string, but then **converts it to a JavaScript `Date` object**. When this `Date` object is passed to SQLite via a parameterized query, SQLite stores it as a numeric timestamp (milliseconds since epoch).

When the data is read back from SQLite and passed to the CSV writer or PDF generator in `backend/src/routes/reports.js`, `entry.date` is the raw numeric timestamp -- not a formatted date string.

### Why the UI Wasn't Affected

The frontend uses `new Date(entry.date).toLocaleDateString()` to display dates. JavaScript's `Date` constructor accepts both ISO strings and numeric timestamps, so `new Date(1782172800000)` works correctly in the browser. The bug only manifests in the CSV/PDF exports where `entry.date` is written directly without formatting.

## Fix Applied

**File: `backend/src/routes/workEntries.js`**

Convert the Joi-validated `Date` object back to an ISO date string (`YYYY-MM-DD`) before inserting into SQLite:

```javascript
// In POST handler (create work entry):
const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
// Use dateStr instead of date in the INSERT query

// In PUT handler (update work entry):
const dateStr = value.date instanceof Date ? value.date.toISOString().split('T')[0] : value.date;
// Use dateStr instead of value.date in the UPDATE query
```

This ensures dates are stored as `TEXT` in the format `YYYY-MM-DD` in SQLite, which is:
- Correctly sortable (`ORDER BY date DESC` works as expected)
- Human-readable in exports (CSV and PDF show `2026-06-23` not `1782172800000`)
- Compatible with the frontend's `new Date()` parsing

## Before/After Evidence

### Before (Bug)

**CSV output:**
```
Date,Hours,Description,Created At
1782172800000,5.5,Frontend UI work,2026-06-24 07:17:13
1782086400000,3,Code review,2026-06-24 07:17:24
```

**PDF output:** Date column shows `1782172800000` and `1782086400000`

### After (Fix)

**CSV output:**
```
Date,Hours,Description,Created At
2026-06-23,5.5,Frontend UI work,2026-06-24 07:20:39
2026-06-22,3,Code review,2026-06-24 07:20:46
```

**PDF output:** Date column shows `2026-06-23` and `2026-06-22`

## Impact

- **Severity:** High -- all report exports were completely unusable
- **Scope:** Affects every CSV and PDF export in the application
- **Users affected:** All users who export time reports
- **Data integrity:** No data loss; the fix only changes the storage format from numeric timestamps to ISO date strings

## Additional Bugs Found During Exploration

1. **`.env.example` CORS mismatch**: `FRONTEND_URL=http://localhost:3000` but Vite defaults to port 5173. Mitigated by the Vite proxy but would cause issues with direct API calls.

2. **SQLite foreign keys not enforced**: The schema defines `ON DELETE CASCADE` for work entries when a client is deleted, but SQLite requires `PRAGMA foreign_keys = ON` to enforce this. Without it, deleting a client orphans its work entries.

3. **No JWT authentication despite README claims**: The README describes "JWT-based authentication with 24-hour token expiration" but the actual implementation uses simple email-header-based authentication with no tokens.
