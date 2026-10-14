# Root Cause Analysis: Work Entry Dates Stored as Epoch Timestamps

## Bug Summary

**Severity**: High  
**Affected Features**: CSV export, PDF export, API responses  
**Impact**: Exported CSV/PDF reports display raw epoch timestamps (e.g., `1776816000000`) instead of human-readable dates (e.g., `2026-04-22`), making exported reports unusable for billing, client sharing, or record-keeping.

## What the Bug Is

When exporting a client's time report as CSV, the `Date` column contains Unix epoch millisecond values instead of formatted date strings:

**Before fix (broken CSV output):**
```
Date,Hours,Description,Created At
1776816000000,8,Frontend development - React components,2026-04-22 20:48:03
1776643200000,3.5,API design and implementation,2026-04-22 20:49:39
```

**After fix (correct CSV output):**
```
Date,Hours,Description,Created At
2026-04-22,8,Frontend development - React components,2026-04-22 20:51:37
2026-04-20,4.5,API design and implementation,2026-04-22 20:51:37
```

The same issue affects:
- PDF export (dates rendered as epoch numbers in the PDF document)
- All API JSON responses returning `date` as a number instead of a string

The frontend UI was not visibly affected because `new Date(epochMs).toLocaleDateString()` still renders correctly from epoch milliseconds, masking the underlying data issue.

## Why It Happened (Root Cause)

The bug originates in the Joi validation schema at `backend/src/validation/schemas.js`.

The `date` field was validated using `Joi.date().iso()`:

```js
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()  // <-- ROOT CAUSE
});
```

**The chain of events:**

1. The frontend sends a date as an ISO string: `"2026-04-22"`
2. `Joi.date().iso()` validates the format is correct, but **also converts the string into a JavaScript `Date` object** as part of Joi's type coercion
3. The `Date` object is passed to SQLite's `INSERT` statement
4. SQLite has no native `DATE` type -- when it receives a JavaScript `Date` object, the SQLite driver serializes it as its numeric value (epoch milliseconds): `1776816000000`
5. All subsequent `SELECT` queries return the epoch number, not the original date string
6. The CSV and PDF export routes write `entry.date` directly to the output, producing `1776816000000` instead of `2026-04-22`

This is a subtle interaction between three layers: Joi's type coercion, JavaScript's Date representation, and SQLite's type affinity system.

## How It Was Fixed

Changed the Joi validation for the `date` field from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` in both the create and update schemas:

```js
// Before (converts to Date object, stored as epoch ms)
date: Joi.date().iso().required()

// After (keeps as string, stored as "2026-04-22")
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This preserves the date as a `YYYY-MM-DD` string throughout the entire pipeline:
- The string is stored as-is in SQLite
- API responses return `"2026-04-22"` instead of `1776816000000`
- CSV/PDF exports render the correct date format
- The frontend continues to work correctly (both `new Date("2026-04-22")` and `new Date(epoch)` are valid)

### Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | Changed `date` field validation from `Joi.date().iso()` to `Joi.string().pattern()` in both `workEntrySchema` and `updateWorkEntrySchema` |

### Verification

- CSV export now outputs `2026-04-22` instead of `1776816000000`
- API responses return date as string `"2026-04-22"`
- Frontend work entries page displays dates correctly
- Frontend reports page displays dates correctly
- Date validation still enforces `YYYY-MM-DD` format
- Invalid dates are still rejected by the regex pattern

## Other Bugs Found During Exploration

| # | Bug | Severity | Description |
|---|-----|----------|-------------|
| 1 | **Epoch dates in exports** | High | Fixed in this PR (see above) |
| 2 | **Stale cache after delete-all clients** | Low | `deleteAllMutation` in `ClientsPage.tsx` only invalidates `'clients'` query, not `'workEntries'` -- dashboard/work entries page may show stale data until manual refresh |
| 3 | **PDF date column also shows epoch** | High | Same root cause as #1, fixed by the same change |
