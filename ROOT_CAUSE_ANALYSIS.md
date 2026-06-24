# Root Cause Analysis: Work Entry Dates Stored as Epoch Timestamps

## Bug Summary

Work entry dates are stored in SQLite as epoch milliseconds (e.g., `1782172800000`) instead of ISO date strings (e.g., `2026-06-23`). This causes **CSV and PDF exports to display raw numeric timestamps** instead of human-readable dates, making exported reports unusable.

## Symptoms

- **CSV exports** show epoch timestamps in the Date column:
  ```
  Date,Hours,Description,Created At
  1782172800000,5.5,API integration work,2026-06-24 07:18:27
  ```
- **PDF exports** render numeric timestamps instead of dates in the report table
- **API responses** return epoch numbers for the `date` field
- The **frontend UI** appears correct because `new Date(epochMs)` happens to work, masking the underlying data corruption

## Root Cause

The bug originates from an interaction between **Joi validation** and **SQLite parameter binding**:

1. The Joi validation schema in `backend/src/validation/schemas.js` uses `Joi.date().iso()`:
   ```js
   date: Joi.date().iso().required()
   ```

2. `Joi.date().iso()` validates the input is a valid ISO date string, but then **converts it to a JavaScript `Date` object** as part of its output.

3. When the route handler passes this `Date` object to SQLite via a parameterized query:
   ```js
   db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date])
   ```

4. The `sqlite3` npm package serializes JavaScript `Date` objects by calling `.valueOf()`, which returns the **epoch milliseconds** representation.

5. SQLite stores this as a numeric value in the `date` column (despite it being typed as `DATE`). When read back, the raw number is returned in API responses and used directly in CSV/PDF exports.

### Why the Frontend UI Wasn't Affected

The frontend displays dates using:
```tsx
{new Date(entry.date).toLocaleDateString()}
```

`new Date(1782172800000)` creates a valid Date from epoch milliseconds, so the UI coincidentally renders the correct date. This masked the bug from being caught during manual UI testing.

## Fix

In `backend/src/routes/workEntries.js`, convert the Joi-validated `Date` object back to an ISO date string (`YYYY-MM-DD`) before passing it to SQLite:

**Create handler (POST):**
```js
const date = value.date instanceof Date
  ? value.date.toISOString().split('T')[0]
  : value.date;
```

**Update handler (PUT):**
```js
if (value.date !== undefined) {
  updates.push('date = ?');
  values.push(value.date instanceof Date
    ? value.date.toISOString().split('T')[0]
    : value.date);
}
```

This preserves Joi's date validation (rejecting invalid dates like `2026-02-30`) while ensuring the database stores a proper `YYYY-MM-DD` string.

## Impact

| Area | Before Fix | After Fix |
|------|-----------|-----------|
| CSV Export | `1782172800000` | `2026-06-23` |
| PDF Export | `1782172800000` | `2026-06-23` |
| API Response | `1782172800000` | `"2026-06-23"` |
| Frontend UI | Correct (coincidental) | Correct |
| DB Storage | Epoch ms (numeric) | ISO date string |

## Other Bugs Found During Exploration

1. **`.env.example` CORS mismatch** - Backend `.env.example` sets `FRONTEND_URL=http://localhost:3000` but the Vite frontend runs on port 5173. Copying the example as-is would cause CORS errors.

2. **SQLite foreign key constraints not enabled** - `PRAGMA foreign_keys = ON` is never executed in `database/init.js`, so `ON DELETE CASCADE` does not work. Deleting a client leaves orphaned work entries in the database.

3. **No JWT authentication despite README claims** - The README describes JWT-based auth, but the actual implementation uses a simple `x-user-email` header. No tokens are issued or validated.
