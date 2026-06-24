# Root Cause Analysis: Date Stored as Unix Timestamp in Work Entries

## Bug Summary

**Severity:** High  
**Affected Features:** CSV export, PDF export, API responses for reports  
**Symptom:** The "Date" column in exported CSV and PDF reports displays raw Unix epoch milliseconds (e.g., `1782259200000`) instead of human-readable date strings (e.g., `2026-06-24`).

## Before (Bug)

CSV export output:
```
Date,Hours,Description,Created At
1782259200000,8,Frontend development - implemented login page,2026-06-24 14:00:12
1782259200000,4.5,API integration and testing,2026-06-24 14:00:31
```

The PDF export similarly renders `1782259200000` in the Date column.

## After (Fix)

CSV export output:
```
Date,Hours,Description,Created At
2026-06-24,8,Frontend development - implemented login page,2026-06-24 14:08:29
2026-06-23,4.5,API integration and testing,2026-06-24 14:08:29
```

## Root Cause

The bug originates from a type mismatch between the Joi validation layer and the SQLite database storage.

### Data Flow (Before Fix)

1. **Frontend** sends a date as an ISO string: `"2026-06-24"`
2. **Joi validation** (`Joi.date().iso()` in `validation/schemas.js`) parses the string and **converts it to a JavaScript `Date` object**
3. **Route handler** (`workEntries.js`) destructures `date` from the validated value — it is now a `Date` object, not a string
4. **SQLite parameterized query** receives the `Date` object and stores its `.valueOf()` — the **epoch milliseconds** (`1782259200000`)
5. **Export routes** (`reports.js`) read the raw value from the database and output it directly to CSV/PDF without formatting

### Why the UI Appeared Correct

The frontend (`WorkEntriesPage.tsx`, `ReportsPage.tsx`) wraps dates with `new Date(entry.date).toLocaleDateString()`, which works with both numeric timestamps and date strings. This masked the underlying data corruption — the UI looked fine, but the exports revealed the raw stored value.

### Why `created_at` Was Unaffected

The `created_at` column uses SQLite's `DEFAULT CURRENT_TIMESTAMP`, which stores a proper datetime string (`"2026-06-24 14:00:12"`). Only the user-supplied `date` field went through Joi's date conversion path.

## Fix Applied

**File:** `backend/src/routes/workEntries.js`

In both the **create** (POST) and **update** (PUT) handlers, the `Date` object is converted back to an ISO date string before being passed to the database:

```javascript
// Convert Date object to ISO date string for proper storage
const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
```

This ensures the database always stores dates as human-readable `YYYY-MM-DD` strings, which are then correctly output in CSV/PDF exports and API responses without requiring additional formatting at read time.

## Impact

- CSV and PDF exports now contain readable dates usable for billing and invoicing
- API responses return clean ISO date strings
- The frontend continues to work correctly (it handles both formats)
- All 161 existing tests continue to pass

## Prevention

To prevent similar issues in the future:
- Consider using `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` instead of `Joi.date().iso()` when the intent is to store a date string rather than a Date object
- Add integration tests that verify CSV/PDF export content matches expected formats
- Add a database-level check or migration that validates stored date formats
