# Root Cause Analysis: Date Fields Exported as Raw Unix Timestamps

## Bug Summary

Exported CSV and PDF reports display dates as raw Unix timestamps (e.g., `1782259200000`) instead of human-readable date strings (e.g., `2026-06-24`). This renders exported reports unusable for billing clients or submitting timesheets.

## Impact

- **Severity**: High
- **Affected Features**: CSV export, PDF export, and JSON API responses for reports and work entries
- **User Impact**: Every exported report contains unreadable timestamps in the Date column, making the core reporting/billing feature non-functional for its intended purpose

## Before (Bug)

CSV export output:
```
Date,Hours,Description,Created At
1782259200000,8,Backend API development - user authentication module,2026-06-24 14:00:15
```

PDF report showed `1782259200000` where the date should be.

## After (Fix)

CSV export output:
```
Date,Hours,Description,Created At
2026-06-24,8,Backend API development - user authentication module,2026-06-24 14:13:45
```

PDF report now correctly shows `2026-06-24`.

## Root Cause

The bug is caused by an interaction between three components:

### 1. Joi Validation Schema (`backend/src/validation/schemas.js`)

```js
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string like `"2026-06-24"` but **converts it to a JavaScript `Date` object** as part of validation. The validated `value.date` is no longer a string.

### 2. SQLite Storage via `sqlite3` Driver

When the JavaScript `Date` object is passed as a parameter to SQLite's parameterized query:

```js
db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date])
```

The `sqlite3` Node.js driver serializes the `Date` object as a **Unix timestamp in milliseconds** (e.g., `1782259200000`). SQLite stores this as a numeric value in the `date` column.

### 3. Export Code Writes Raw Values

Both the CSV and PDF export routes read the `date` field directly from the database and write it to the output without any formatting:

```js
// CSV: writes raw entry.date (a number) directly
csvWriter.writeRecords(workEntries)

// PDF: writes raw entry.date (a number) directly
doc.text(entry.date, 50, doc.y, { width: 100 });
```

### Why the UI Appeared Correct

The frontend happened to handle this correctly because it wraps dates with `new Date(entry.date).toLocaleDateString()`, which works with both timestamps and date strings. This masked the underlying storage bug.

## Fix Applied

### 1. Store dates as ISO strings (root cause fix)

In `backend/src/routes/workEntries.js`, convert the Joi-validated `Date` object back to an ISO date string before storing:

```js
const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
```

This ensures new entries store `"2026-06-24"` instead of `1782259200000`.

### 2. Format dates in export and API routes (defense-in-depth)

Added a `formatDate()` helper in both `reports.js` and `workEntries.js` that handles both formats:

```js
function formatDate(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'number') {
    return new Date(dateValue).toISOString().split('T')[0];
  }
  return String(dateValue);
}
```

Applied to:
- CSV export: formats entries before writing
- PDF export: formats date before rendering
- JSON API responses: formats dates for consistent client consumption

## Files Changed

- `backend/src/routes/workEntries.js` - Store dates as ISO strings; format dates in GET responses
- `backend/src/routes/reports.js` - Format dates in report JSON, CSV export, and PDF export

## Prevention

To prevent similar issues:
1. Always validate the type of data being stored, not just its format
2. Add integration tests that verify exported file contents (not just HTTP status codes)
3. Consider using a custom Joi extension that validates ISO dates but returns strings, not Date objects
