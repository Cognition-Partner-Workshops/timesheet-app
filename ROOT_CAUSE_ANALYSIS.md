# Root Cause Analysis: Work Entry Dates Stored as Unix Timestamps

## Bug Summary

Work entry dates are stored in SQLite as raw Unix timestamps (e.g., `1777507200000`) instead of ISO date strings (e.g., `2026-04-30`). This breaks CSV and PDF exports (which display the raw numeric timestamp), and causes off-by-one-day errors for users in non-UTC timezones.

## Symptoms

1. **CSV export shows raw timestamps**: The Date column displays `1777507200000` instead of `2026-04-30`
2. **PDF export shows raw timestamps**: Same issue as CSV
3. **Timezone-dependent date display**: For users west of UTC (e.g., US Eastern), dates appear shifted back by one day in the frontend
4. **Date shift on edit**: Opening a work entry for editing could load the wrong date due to UTC midnight interpretation

## Root Cause

The Joi validation schema in `backend/src/validation/schemas.js` used `Joi.date().iso()` to validate the `date` field:

```javascript
date: Joi.date().iso().required()
```

`Joi.date()` converts the input string `"2026-04-30"` into a JavaScript `Date` object (`new Date("2026-04-30")` = midnight UTC). When this `Date` object is passed to the sqlite3 driver's `db.run()`, it is serialized as a numeric Unix timestamp in milliseconds (`1777507200000`).

**Data flow before fix:**
1. Frontend sends `{ date: "2026-04-30" }`
2. Joi converts to `Date` object (midnight UTC)
3. sqlite3 stores as `1777507200000`
4. API returns `{ date: 1777507200000 }`
5. Frontend does `new Date(1777507200000).toLocaleDateString()` -- timezone-dependent
6. CSV/PDF export writes `1777507200000` as the date value

Additionally, the frontend used `toISOString().split('T')[0]` when submitting dates, which converts to UTC and can shift the date backward for users east of UTC (or forward for users west of UTC when combined with the DatePicker's local time behavior).

## Fix

### Backend: `backend/src/validation/schemas.js`

Changed from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)` for both `workEntrySchema` and `updateWorkEntrySchema`. This validates the YYYY-MM-DD format while keeping the value as a string, so sqlite3 stores it as-is.

### Frontend: Date display (3 files)

Changed `new Date(entry.date)` to `new Date(entry.date + 'T00:00:00')` in all date display locations. Appending `T00:00:00` (without a timezone qualifier) causes the Date to be parsed as local time instead of UTC, preventing the off-by-one-day shift.

Files changed:
- `frontend/src/pages/WorkEntriesPage.tsx` -- table display + edit form loading
- `frontend/src/pages/ReportsPage.tsx` -- report table display
- `frontend/src/pages/DashboardPage.tsx` -- recent entries display

### Frontend: Date submission (`WorkEntriesPage.tsx`)

Changed from `formData.date.toISOString().split('T')[0]` to using `getFullYear()`/`getMonth()`/`getDate()` to format the date using local time components, preventing timezone-related date shifts during submission.

## Verification

- All 161 backend tests pass
- Frontend lint and build succeed
- CSV export now shows `2026-04-30` instead of `1777507200000`
- PDF export now shows `2026-04-30` instead of `1777507200000`
- API response returns `{ date: "2026-04-30" }` instead of `{ date: 1777507200000 }`
