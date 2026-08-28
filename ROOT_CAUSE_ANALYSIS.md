# Root Cause Analysis: Date Timezone Off-by-One Bug

## Bug Summary

Work entry dates display one day earlier than the date actually entered by the user, depending on the user's timezone. For example, a user in US Eastern time entering April 22, 2026 would see "4/21/2026" displayed in the work entries table, dashboard, and reports.

## Impact

- **Severity**: High - affects all date displays across the entire application (Work Entries, Dashboard, Reports)
- **Scope**: Every user in a non-UTC timezone sees incorrect dates
- **Data integrity**: Dates stored in the database are epoch milliseconds (e.g., `1745280000000`) instead of the intended date string (e.g., `"2026-04-22"`), making the stored data ambiguous and timezone-dependent

## Root Cause

The bug originates in the backend validation layer. The Joi validation schema used `Joi.date().iso()` for the date field:

```js
// BEFORE (backend/src/validation/schemas.js)
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string like `"2026-04-22"` but **converts it to a JavaScript `Date` object**. When SQLite stores a JavaScript `Date` object, it serializes it as **epoch milliseconds** (e.g., `1745280000000`).

On the frontend, the date was rendered using:

```tsx
new Date(entry.date).toLocaleDateString()
```

When `entry.date` is an epoch number like `1745280000000`, `new Date(1745280000000)` creates a Date at UTC midnight. In any timezone west of UTC (e.g., US Eastern, UTC-4), midnight UTC is the **previous day** in local time, causing the off-by-one display.

### Chain of Events

1. User enters date `"2026-04-22"` in the frontend date picker
2. Frontend sends `{ date: "2026-04-22" }` to the API
3. Joi's `date().iso()` validator converts `"2026-04-22"` to `Date("2026-04-22T00:00:00.000Z")` (UTC midnight)
4. SQLite stores this as epoch milliseconds: `1745280000000`
5. API returns `{ date: 1745280000000 }` to the frontend
6. Frontend calls `new Date(1745280000000).toLocaleDateString()` which in UTC-4 renders as `"4/21/2026"` (one day off)

## Fix

### Backend: Keep dates as ISO strings (schemas.js)

Changed validation from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`:

```js
// AFTER
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This validates the `YYYY-MM-DD` format without converting to a Date object. SQLite now stores the date as a plain string `"2026-04-22"`, which is timezone-agnostic.

### Frontend: Parse dates as local time

Changed all `entry.date` rendering from:
```tsx
new Date(entry.date).toLocaleDateString()
```
to:
```tsx
new Date(entry.date + 'T00:00:00').toLocaleDateString()
```

Appending `T00:00:00` (without a `Z` suffix) causes `new Date()` to interpret the date as **local midnight** rather than UTC midnight, preventing the timezone shift.

The same fix was applied to the edit form's date parsing to ensure the DatePicker shows the correct date when editing an existing entry.

### Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | Changed `Joi.date().iso()` to `Joi.string().pattern()` for both create and update schemas |
| `frontend/src/pages/WorkEntriesPage.tsx` | Fixed date display and edit form date parsing |
| `frontend/src/pages/DashboardPage.tsx` | Fixed date display |
| `frontend/src/pages/ReportsPage.tsx` | Fixed date display |

## Verification

After the fix:
- Dates are stored as `"2026-04-22"` (string) instead of `1745280000000` (number)
- Dates display correctly regardless of the user's timezone
- The date picker shows the correct date when editing existing entries
- Joi validation still rejects invalid date formats
