# Root Cause Analysis: Work Entry Dates Stored as Epoch Milliseconds

## Bug Summary

Work entry dates were stored in SQLite as epoch milliseconds (e.g., `1778544000000`) instead of ISO date strings (e.g., `"2026-05-12"`). This caused CSV and PDF exports to display unintelligible numeric timestamps, and corrupted the API response data for all date fields on work entries.

## Symptoms

| Area | Before Fix | After Fix |
|------|-----------|-----------|
| API Response | `"date": 1778544000000` | `"date": "2026-05-12"` |
| CSV Export | `1778544000000,8,Backend dev work,...` | `2026-05-12,8,Backend dev work,...` |
| PDF Export | Date column shows `1778544000000` | Date column shows `2026-05-12` |
| Frontend UI | Appeared correct (JS handles epoch) | Correct (unchanged) |

The frontend UI masked the bug because `new Date(1778544000000).toLocaleDateString()` renders correctly in JavaScript. The real impact was on exported data and any system consuming the API directly.

## Root Cause

In `backend/src/validation/schemas.js`, the Joi validation schema for work entries used:

```javascript
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string like `"2026-05-12"` but **converts it to a JavaScript `Date` object** as part of validation. When this `Date` object was passed as a bind parameter to SQLite via the `sqlite3` npm package, the driver called `.valueOf()` on it, producing an epoch timestamp in milliseconds (e.g., `1778544000000`). This numeric value was then stored in the `date` TEXT column.

### Chain of events:
1. Frontend sends `{"date": "2026-05-12"}` in the request body
2. Joi validates and **converts** `"2026-05-12"` → `Date("2026-05-12T00:00:00.000Z")`
3. Route handler passes the `Date` object to SQLite: `[..., value.date]`
4. `sqlite3` driver calls `.valueOf()` → `1778544000000`
5. SQLite stores `1778544000000` in the `date` column
6. All reads return the numeric value instead of a date string

## Fix Applied

**File: `backend/src/validation/schemas.js`**

Changed the `date` field validation from `Joi.date().iso()` to a string pattern that validates YYYY-MM-DD format without converting to a Date object:

```javascript
// Before (converts string to Date object):
date: Joi.date().iso().required()

// After (validates format, keeps as string):
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
  'string.pattern.base': '"date" must be a valid ISO date (YYYY-MM-DD)'
})
```

This ensures the date remains a plain string `"2026-05-12"` through validation, storage, and retrieval.

## Additional Fix: Foreign Key Constraints Not Enforced

**File: `backend/src/database/init.js`**

SQLite has foreign key constraints OFF by default. The schema defined `ON DELETE CASCADE` on the `work_entries.client_id` foreign key, but without `PRAGMA foreign_keys = ON`, cascade deletes never triggered. Deleting a client left orphaned work entries in the database — invisible to queries (due to JOIN) but still consuming storage.

Added `PRAGMA foreign_keys = ON` to the database initialization to enable proper cascade behavior.

## Other Bugs Observed During Testing

| Bug | Severity | Description |
|-----|----------|-------------|
| `.env` CORS mismatch | Low | Backend `.env` sets `FRONTEND_URL=http://localhost:3000` but frontend runs on port 5173. Mitigated by Vite proxy, but would break direct cross-origin requests. |
| Rate limiting too aggressive | Low | 100 requests per 15 minutes per IP is restrictive for development. Normal app usage can easily exceed this. |

## Impact Assessment

- **Severity**: High — every work entry date was stored incorrectly
- **Scope**: All work entries created through the application
- **User Impact**: CSV/PDF exports were unusable (dates as epoch ms); any external system consuming the API would receive wrong date formats
- **Data Loss**: No data loss — dates could theoretically be recovered by converting epoch ms back to ISO strings, but the stored format was wrong

## Verification

After the fix:
- API returns `"date": "2026-05-12"` (proper ISO string)
- CSV exports show `2026-05-12` (human-readable)
- Invalid date formats are rejected with clear error messages
- Cascade deletes work correctly when clients are removed
