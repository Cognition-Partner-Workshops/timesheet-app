# Root Cause Analysis: Work Entry Dates Stored as Unix Timestamps

## Bug Summary

Work entry dates are stored in SQLite as Unix timestamps (milliseconds since epoch) instead of ISO date strings (YYYY-MM-DD). This causes CSV and PDF exports to display raw numeric timestamps (e.g., `1775088000000`) instead of human-readable dates (e.g., `2026-04-02`), and returns incorrect date formats in API responses.

## Impact

- **CSV exports are broken**: The Date column shows values like `1775088000000` instead of `2026-04-02`, making exported reports unusable for clients or accounting purposes.
- **PDF exports show numeric timestamps**: Same issue renders PDF reports with unreadable date values.
- **API responses return timestamps**: Any downstream consumer of the API receives numeric timestamps instead of the expected ISO date strings, breaking integrations.
- **Database sorting may be affected**: Lexicographic sorting of timestamps stored as numbers behaves differently than date-string sorting in certain SQLite operations.
- **Frontend appears unaffected**: The UI accidentally masks this bug because JavaScript's `new Date(1775088000000)` correctly interprets millisecond timestamps, so the frontend renders dates correctly despite the underlying data corruption.

## Root Cause

The bug originates in `backend/src/validation/schemas.js`. The Joi validation schema for work entries used `Joi.date().iso()` for the `date` field:

```js
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.date().iso().required()
});
```

`Joi.date().iso()` validates that the input is a valid ISO date string, but it also **converts** the string into a JavaScript `Date` object as part of Joi's type coercion. When this `Date` object is then passed to SQLite via the parameterized query:

```js
db.run(
  'INSERT INTO work_entries (..., date) VALUES (?, ?, ?, ?, ?)',
  [clientId, req.userEmail, hours, description, date]  // date is now a Date object
);
```

SQLite's `node-sqlite3` driver serializes the JavaScript `Date` object to its numeric representation (milliseconds since Unix epoch), storing values like `1775088000000` in the `date` column instead of the intended `"2026-04-01"` string.

## The Fix

Changed the Joi validation from `Joi.date().iso()` to `Joi.string().pattern()` with a strict YYYY-MM-DD regex pattern. This validates the date format without converting the value, keeping it as the original string throughout the data pipeline:

```js
// AFTER (fixed)
const workEntrySchema = Joi.object({
  // ...
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': '"date" must be a valid ISO date (YYYY-MM-DD)' })
});
```

The same fix was applied to `updateWorkEntrySchema`.

## Files Changed

- `backend/src/validation/schemas.js` - Changed `date` field validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both `workEntrySchema` and `updateWorkEntrySchema`.

## Verification

### Before Fix
```
CSV Export:
Date,Hours,Description,Created At
1775088000000,4.5,Code review,2026-04-07 06:31:00
1775001600000,8,Frontend development,2026-04-07 06:31:00

API Response:
{ "date": 1775088000000 }
```

### After Fix
```
CSV Export:
Date,Hours,Description,Created At
2026-04-02,4.5,Code review,2026-04-07 06:36:06
2026-04-01,8,Frontend development,2026-04-07 06:36:06

API Response:
{ "date": "2026-04-02" }
```

### Tests
All 161 existing backend tests pass with the fix applied (8 test suites, 0 failures).

## Why This Bug Was Hard to Spot

The frontend uses `new Date(entry.date).toLocaleDateString()` to render dates. JavaScript's `Date` constructor accepts both ISO strings and numeric timestamps, so both `new Date("2026-04-02")` and `new Date(1775088000000)` produce valid dates. This means the bug was invisible in the UI but silently corrupted all data exports and API responses.

## Prevention

- Add integration tests that verify the exact format of date values in API responses (string vs number).
- Add tests for CSV/PDF export output to verify date formatting.
- Prefer `Joi.string().pattern()` over `Joi.date().iso()` when the intent is to preserve the original string format for storage.
