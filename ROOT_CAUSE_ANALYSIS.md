# Root Cause Analysis: Date Storage Bug in CSV/PDF Export

## Bug Summary

Work entry dates are exported as raw Unix timestamps (e.g., `1782259200000`) instead of human-readable date strings (e.g., `2026-06-24`) in CSV and PDF report exports.

## Impact

- **CSV reports are unusable** — the Date column displays epoch milliseconds instead of calendar dates, making exported timesheets meaningless for clients and accountants.
- **PDF reports contain raw timestamps** — same issue in generated PDF documents.
- **API responses return numeric timestamps** — downstream integrations consuming the report API receive `1782259200000` instead of `"2026-06-24"`.

The frontend display appeared correct because it wrapped the value in `new Date(entry.date).toLocaleDateString()`, masking the underlying data corruption from users until they exported a report.

## Root Cause

The bug originates from an interaction between **Joi validation** and **SQLite storage**:

1. The frontend sends dates as ISO strings: `"2026-06-24"`
2. The Joi validation schema in `backend/src/validation/schemas.js` uses:
   ```js
   date: Joi.date().iso().required()
   ```
   `Joi.date()` **converts** the incoming string into a JavaScript `Date` object.
3. The work entries route (`backend/src/routes/workEntries.js`) then inserts the validated value directly:
   ```js
   const { clientId, hours, description, date } = value;
   // date is now a Date object, not a string!
   db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date]);
   ```
4. When SQLite receives a JavaScript `Date` object via the `sqlite3` driver, it stores its numeric `.valueOf()` — the Unix timestamp in milliseconds (e.g., `1782259200000`).
5. The CSV/PDF export routes read this raw numeric value and write it directly without any formatting.

## Why It Wasn't Caught

- The **frontend masked the bug** by always wrapping `entry.date` in `new Date()` before calling `.toLocaleDateString()`, which works for both timestamps and date strings.
- The **test suite** doesn't verify the exported file content — it only checks HTTP status codes and response shapes.
- The in-memory database resets on restart, so the issue only manifests during active sessions.

## Fix Applied

### 1. Root cause fix — `backend/src/routes/workEntries.js`

Convert the `Date` object back to an ISO date string before storing in SQLite:

```js
// In POST (create) handler:
const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
// Use dateStr in the INSERT statement

// In PUT (update) handler:
values.push(value.date instanceof Date ? value.date.toISOString().split('T')[0] : value.date);
```

### 2. Defense-in-depth — `backend/src/routes/reports.js`

Added a `formatDate()` helper that handles both legacy timestamp data and properly stored date strings in the CSV and PDF export paths:

```js
function formatDate(dateValue) {
  if (!dateValue) return '';
  if (typeof dateValue === 'number') {
    return new Date(dateValue).toISOString().split('T')[0];
  }
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateValue.split('T')[0];
  }
  return String(dateValue);
}
```

This ensures correct output regardless of whether the stored value is an old-format timestamp or a new-format date string.

## Before/After

**Before (CSV export):**
```
Date,Hours,Description,Created At
1782259200000,8,Frontend development work,2026-06-24 13:59:53
```

**After (CSV export):**
```
Date,Hours,Description,Created At
2026-06-24,8,Frontend development work,2026-06-24 14:06:19
```

## Test Results

All 161 existing tests pass after the fix (8 test suites, 0 failures).
