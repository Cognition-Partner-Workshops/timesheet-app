# Root Cause Analysis: Date Storage Bug

## Bug Summary

Work entry dates are stored as epoch timestamps (e.g., `1777507200000`) instead of ISO date strings (e.g., `"2026-04-30"`) in the SQLite database. This causes:

1. **CSV exports show raw epoch numbers** instead of human-readable dates
2. **PDF exports show raw epoch numbers** instead of human-readable dates
3. **Dates display incorrectly for non-UTC timezone users** — a work entry dated April 30 may appear as April 29 for users in UTC-5 (Eastern US)

## Impact

- **High** — This bug affects every user and corrupts the primary data export functionality. Exported reports are unusable because the Date column contains meaningless numbers like `1777507200000` instead of `2026-04-30`.
- The timezone component silently shifts dates by one day for roughly half the world's timezones, leading to incorrect time tracking records.

## Root Cause

The bug originates in the Joi validation schema (`backend/src/validation/schemas.js`):

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` validates the incoming date string but **converts it to a JavaScript `Date` object**. When the SQLite driver (`better-sqlite3`/`sqlite3`) encounters a `Date` object, it serializes it as an epoch timestamp (milliseconds since Unix epoch) rather than preserving the original string format.

**Data flow before fix:**
1. Frontend sends: `{ "date": "2026-04-30" }`
2. Joi validates and converts: `{ "date": Date("2026-04-30T00:00:00.000Z") }`
3. SQLite stores the Date object as: `1777507200000` (epoch ms)
4. API returns: `{ "date": 1777507200000 }`
5. CSV export writes: `1777507200000,8,Backend development work,...`

A secondary issue existed on the frontend:
- **Date submission** used `date.toISOString().split('T')[0]` which converts to UTC before extracting the date, potentially shifting the date by -1 day in positive UTC offset timezones
- **Date display** used `new Date(timestamp)` which interprets epoch timestamps at UTC midnight, displaying the previous day in negative UTC offset timezones

## Fix

### Backend (`backend/src/validation/schemas.js`)

Changed the Joi schema from `Joi.date().iso()` to `Joi.string().pattern()` to preserve dates as ISO strings:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This validates the `YYYY-MM-DD` format without converting to a `Date` object, so SQLite stores the string as-is.

### Frontend (3 pages)

**Date display** — Added `'T00:00:00'` suffix when parsing date strings to force local timezone interpretation:

```js
// BEFORE
new Date(entry.date).toLocaleDateString()

// AFTER
new Date(entry.date + 'T00:00:00').toLocaleDateString()
```

**Date submission** (`WorkEntriesPage.tsx`) — Replaced `toISOString()` with local date component extraction to avoid UTC conversion:

```js
// BEFORE
date: formData.date.toISOString().split('T')[0]

// AFTER
date: `${formData.date.getFullYear()}-${String(formData.date.getMonth() + 1).padStart(2, '0')}-${String(formData.date.getDate()).padStart(2, '0')}`
```

## Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | Changed `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` for both `workEntrySchema` and `updateWorkEntrySchema` |
| `frontend/src/pages/WorkEntriesPage.tsx` | Fixed date display, date submission, and date picker pre-population |
| `frontend/src/pages/ReportsPage.tsx` | Fixed date display |
| `frontend/src/pages/DashboardPage.tsx` | Fixed date display |

## Verification

**Before fix:**
- API returns: `"date": 1777507200000`
- CSV export: `1777507200000,8,Backend development work,...`

**After fix:**
- API returns: `"date": "2026-04-30"`
- CSV export: `2026-04-30,8,Backend development work,...`
- All 161 backend tests pass
- Frontend builds and lints cleanly
