# Root Cause Analysis: Work Entry Dates Stored as Epoch Milliseconds

## Bug Summary

Work entry dates are stored in SQLite as epoch milliseconds (e.g., `1782259200000`) instead of ISO date strings (e.g., `2026-06-24`). This corrupts CSV and PDF exports, which render raw numeric timestamps instead of human-readable dates.

## Impact

- **CSV exports are unusable** -- the Date column contains raw epoch-millisecond values like `1782259200000` instead of formatted dates.
- **PDF exports show numeric timestamps** instead of readable dates in the report table.
- **API responses return epoch integers** for the `date` field, forcing every consumer (frontend, integrations, scripts) to manually convert. The frontend happened to mask the problem because `new Date(1782259200000)` still produces a valid JS Date, so the UI displayed dates correctly -- but the underlying data was wrong.
- **Database integrity** -- dates stored as integers cannot be compared with standard SQL date functions, breaking any future queries like `WHERE date BETWEEN '2026-06-01' AND '2026-06-30'`.

## Root Cause

The Joi validation schema in `backend/src/validation/schemas.js` declares:

```js
date: Joi.date().iso().required()
```

`Joi.date()` accepts an ISO-8601 string (`"2026-06-24"`) but **converts it to a JavaScript `Date` object** during validation. When this `Date` object is bound to a SQLite parameterised query via the `sqlite3` Node driver, the driver serialises it as its numeric `.getTime()` value (epoch milliseconds), because SQLite has no native Date type and the driver falls back to the primitive representation.

Meanwhile, `created_at` and `updated_at` columns use `DEFAULT CURRENT_TIMESTAMP`, which SQLite stores as a text string (`"2026-06-24 07:17:32"`), so they display correctly.

### Affected code paths

| Route | File | Line(s) |
|-------|------|---------|
| `POST /api/work-entries` | `backend/src/routes/workEntries.js` | ~87 (destructured `date` from `value`) |
| `PUT /api/work-entries/:id` | `backend/src/routes/workEntries.js` | ~216 (`value.date` pushed to params) |

Both paths passed the Joi-parsed `Date` object straight to the SQL `INSERT` / `UPDATE` statement.

## Fix

Convert the Joi-parsed `Date` back to an ISO date string (`YYYY-MM-DD`) before binding it to the query:

```js
// POST route -- create work entry
const date = value.date instanceof Date
  ? value.date.toISOString().split('T')[0]
  : value.date;

// PUT route -- update work entry
if (value.date !== undefined) {
  updates.push('date = ?');
  const dateStr = value.date instanceof Date
    ? value.date.toISOString().split('T')[0]
    : value.date;
  values.push(dateStr);
}
```

This ensures the `date` column always contains an ISO-8601 date string (`"2026-06-24"`), consistent with how `created_at` and `updated_at` are stored.

## Verification

### Before fix

```
CSV content:
  Date,Hours,Description,Created At
  1782259200000,8,Backend API development,2026-06-24 07:17:32

API response:
  { "date": 1782259200000, "created_at": "2026-06-24 07:17:32" }
```

### After fix

```
CSV content:
  Date,Hours,Description,Created At
  2026-06-20,8,Backend API development,2026-06-24 07:22:47

API response:
  { "date": "2026-06-20", "created_at": "2026-06-24 07:22:47" }
```

All 161 existing backend tests continue to pass.

## Other Bugs Observed During Exploration

| Bug | Severity | Notes |
|-----|----------|-------|
| MUI console warnings: "out-of-range value `0` for the select component" in WorkEntriesPage | Low | The `Select` for client uses initial value `0` but no `MenuItem` has `value={0}` -- purely cosmetic |
| MUI console warning: disabled button inside Tooltip | Low | The disabled export buttons inside `Tooltip` don't fire events -- needs a `span` wrapper |
| No confirmation or undo for "Clear All" clients | Medium | The bulk-delete button asks `window.confirm` but does not warn that associated work entries are also cascade-deleted |
