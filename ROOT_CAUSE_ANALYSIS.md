# Root Cause Analysis: Date Off-By-One Bug

## Bug Summary

All work entry dates displayed in the application are **shifted back by one day** for users in timezones behind UTC (e.g., US Eastern, US Pacific). A work entry recorded for June 20 appears as June 19; an entry for June 1 appears as May 31. This affects the Dashboard, Work Entries page, and Reports page -- every view that displays a work entry date.

## Impact

- **Severity: Critical** -- dates are the core data in a timesheet application
- **Scope:** Every date displayed in the frontend for users in any timezone west of UTC (most of the Americas)
- Billing reports show incorrect dates, leading to potential invoicing errors
- CSV and PDF exports inherit the wrong dates from the same data path
- Editing an existing work entry pre-fills the date picker with the wrong day

## Root Cause

The bug has two contributing factors that combine into the off-by-one error:

### 1. Backend: Joi converts date strings to JavaScript Date objects (timestamps)

In `backend/src/validation/schemas.js`, the date field was validated with:

```js
date: Joi.date().iso().required()
```

`Joi.date().iso()` parses the input string `"2026-06-20"` into a JavaScript `Date` object, which is internally a UTC timestamp (`1781913600000`, representing `2026-06-20T00:00:00.000Z`). This timestamp is what gets stored in the SQLite database instead of the original `"2026-06-20"` string.

### 2. Frontend: `new Date(timestamp)` shifts dates in non-UTC timezones

The frontend renders dates with:

```tsx
new Date(entry.date).toLocaleDateString()
```

When `entry.date` is a timestamp like `1781913600000` (midnight UTC on June 20), the browser's `Date` constructor creates a `Date` at that UTC instant. But `toLocaleDateString()` formats it using the user's local timezone. In US Eastern (UTC-4 in summer):

```
new Date(1781913600000)  // 2026-06-20T00:00:00 UTC
                          // = 2026-06-19T20:00:00 EDT
toLocaleDateString()     // "6/19/2026"  <-- WRONG
```

The date shifts back because midnight UTC falls on the previous calendar day in western timezones.

## How It Was Fixed

### Backend Fix (`backend/src/validation/schemas.js`)

Changed the Joi validation from `Joi.date().iso()` to a string pattern validator that preserves the original `YYYY-MM-DD` string:

```js
// Before (converts to timestamp):
date: Joi.date().iso().required()

// After (preserves string):
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
  'string.pattern.base': 'Date must be in YYYY-MM-DD format'
})
```

This ensures the date is stored in SQLite as the string `"2026-06-20"` rather than the number `1781913600000`.

### Frontend Fix (3 files)

Changed date parsing to append `T00:00:00` which forces the browser to interpret the date string as **local** midnight rather than UTC midnight:

```tsx
// Before (UTC midnight, shifts in local timezone):
new Date(entry.date).toLocaleDateString()

// After (local midnight, no shift):
new Date(entry.date + 'T00:00:00').toLocaleDateString()
```

Files changed:
- `frontend/src/pages/DashboardPage.tsx` -- recent entries date display
- `frontend/src/pages/WorkEntriesPage.tsx` -- work entries table date display and edit form date pre-fill
- `frontend/src/pages/ReportsPage.tsx` -- report table date display

## Why This Pattern Is Important

The JavaScript `Date` constructor treats date-only strings (`"2026-06-20"`) as UTC per the ECMAScript spec, but date-time strings without a timezone offset (`"2026-06-20T00:00:00"`) as local time. This distinction is the source of many date bugs in web applications. The fix addresses both sides:

1. **Store dates as strings** so the database preserves the user's intended calendar date
2. **Parse dates as local time** so the display matches the stored value regardless of timezone

## Verification

Tested with the system timezone set to `America/New_York` (UTC-4):

| Entry Date | Before (Bug) | After (Fix) |
|-----------|-------------|------------|
| 2026-06-20 | 6/19/2026 | 6/20/2026 |
| 2026-06-17 | 6/16/2026 | 6/17/2026 |
| 2026-06-16 | 6/15/2026 | 6/16/2026 |
| 2026-06-15 | 6/14/2026 | 6/15/2026 |
| 2026-06-01 | 5/31/2026 | 6/1/2026 |

All 161 backend tests continue to pass after the fix.
