# Root Cause Analysis: Date Storage Bug

## Bug Summary

Work entry dates are stored as numeric epoch timestamps (e.g. `1776038400000`) instead of ISO date strings (e.g. `"2026-04-13"`) in the SQLite database. This corrupts date values across the entire application, making CSV and PDF exports unusable and returning incorrect data from the API.

## Impact

| Area | Before Fix | After Fix |
|------|-----------|-----------|
| **API responses** | `"date": 1776038400000` | `"date": "2026-04-13"` |
| **CSV export** | `Date` column: `1776038400000` | `Date` column: `2026-04-13` |
| **PDF export** | Date rows: `1776038400000` | Date rows: `2026-04-13` |
| **Frontend display** | Appears correct (JS converts timestamps) | Correct (renders date strings) |

**Severity: High** — CSV and PDF exports are the primary deliverables of the reporting feature. With raw timestamps, exported reports are unusable for clients or accounting purposes. The frontend happened to mask the bug because `new Date(1776038400000).toLocaleDateString()` still produces a readable date, but the underlying data was wrong.

## Root Cause

The bug is in `backend/src/validation/schemas.js`, in both `workEntrySchema` and `updateWorkEntrySchema`:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

**What happens:**

1. The frontend sends a date as an ISO string: `"2026-04-13"`
2. Joi's `date().iso()` validator **converts** the string into a JavaScript `Date` object: `Date("2026-04-13T00:00:00.000Z")`
3. The `Date` object is passed to the SQLite `INSERT` statement
4. SQLite has no native `Date` type — when it receives a JS `Date` object, the sqlite3 driver serializes it as its numeric value (milliseconds since Unix epoch): `1776038400000`
5. All subsequent reads return the numeric timestamp instead of the original date string

This is a classic type-coercion bug at the boundary between validation and storage layers.

## Fix

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

The fix replaces `Joi.date().iso()` with `Joi.string().pattern()` using a `YYYY-MM-DD` regex. This:

- **Validates** that the input matches the expected date format
- **Preserves** the value as a string (no type conversion)
- **Stores** the date correctly in SQLite as a text value

The same change was applied to both `workEntrySchema` (for creating entries) and `updateWorkEntrySchema` (for updating entries).

## File Changed

- `backend/src/validation/schemas.js` — Lines 14 and 21

## Verification

- All 161 existing backend tests pass
- API now returns `"date": "2026-04-13"` instead of `"date": 1776038400000`
- CSV export shows `2026-04-13` in the Date column
- PDF export renders `2026-04-13` in date rows
- Invalid date formats (e.g. `"not-a-date"`, `"2026-04-13T12:00:00Z"`) are correctly rejected with a validation error

## Trade-offs

The new regex validates **format only** (`YYYY-MM-DD`), not calendar validity. A value like `"2026-02-31"` would pass validation. The original `Joi.date().iso()` did validate calendar dates, but the type conversion side-effect made it unusable with SQLite. If stricter calendar validation is needed in the future, a custom Joi extension or a post-validation check could be added.
