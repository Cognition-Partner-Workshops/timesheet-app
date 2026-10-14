# Root Cause Analysis: Dates Displayed as Epoch Milliseconds in CSV/PDF Exports

## Bug Summary

Work entry dates appear as raw epoch milliseconds (e.g., `1782172800000`) instead of human-readable dates (e.g., `2026-06-23`) in CSV and PDF report exports. The bug also affects API responses, though the frontend UI masked it by converting the numeric timestamp with `new Date()`.

## Severity

**High** - The reporting/export feature is a core capability of the application. Exported CSV and PDF reports are unusable because the Date column contains opaque numeric timestamps instead of readable dates. Any user relying on exports for invoicing, timesheets, or record-keeping would receive corrupted data.

## Symptoms

| Surface | Before Fix | After Fix |
|---------|-----------|-----------|
| CSV Export | `1782172800000,8,Frontend development work,...` | `2026-06-24,8,Frontend development work,...` |
| PDF Export | Date column shows `1782172800000` | Date column shows `2026-06-24` |
| API Response | `"date": 1782172800000` | `"date": "2026-06-24"` |
| Frontend UI | Appeared correct (masked by `new Date()` conversion) | Correct (no change) |

## Root Cause

The bug originates in `backend/src/validation/schemas.js`:

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

The `Joi.date().iso()` validator accepts an ISO date string like `"2026-06-24"` but **converts it to a JavaScript `Date` object** as part of validation. When the SQLite driver receives this `Date` object in an INSERT statement, it stores it as its numeric representation - epoch milliseconds (e.g., `1782259200000`).

The full chain:

1. **Frontend** sends `{ "date": "2026-06-24" }` (correct ISO string)
2. **Joi validation** converts `"2026-06-24"` to `Date` object (`new Date("2026-06-24")`)
3. **SQLite INSERT** receives `Date` object, stores it as `1782259200000` (epoch ms)
4. **SQLite SELECT** returns `1782259200000` (number, not string)
5. **CSV/PDF export** writes `1782259200000` directly to the output file
6. **Frontend UI** calls `new Date(1782259200000).toLocaleDateString()` which happened to work, masking the bug in the browser

## Why the Frontend Masked the Bug

The frontend used `new Date(entry.date).toLocaleDateString()` to display dates. Since `new Date(1782259200000)` correctly reconstructs the date from epoch milliseconds, the UI showed correct dates. This made the bug invisible during normal browser usage - it only manifested when exporting data.

## Fix Applied

### 1. Backend validation schema (`backend/src/validation/schemas.js`)

Changed from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`:

```js
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
```

This validates the date format while keeping it as a string, so SQLite stores `"2026-06-24"` as-is. The same change was applied to both `workEntrySchema` and `updateWorkEntrySchema`.

### 2. Frontend date display (`WorkEntriesPage.tsx`, `DashboardPage.tsx`, `ReportsPage.tsx`)

Updated date parsing to append `'T00:00:00'` to force local timezone interpretation:

```tsx
// BEFORE
new Date(entry.date).toLocaleDateString()

// AFTER
new Date(entry.date + 'T00:00:00').toLocaleDateString()
```

Without `T00:00:00`, `new Date("2026-06-24")` parses as UTC midnight, which could display as the previous day in timezones behind UTC (e.g., US Eastern). Appending `T00:00:00` forces local timezone parsing.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | `Joi.date().iso()` to `Joi.string().pattern(...)` for both work entry schemas |
| `frontend/src/pages/WorkEntriesPage.tsx` | Date parsing uses `+ 'T00:00:00'` for display and edit |
| `frontend/src/pages/DashboardPage.tsx` | Date parsing uses `+ 'T00:00:00'` for display |
| `frontend/src/pages/ReportsPage.tsx` | Date parsing uses `+ 'T00:00:00'` for display |

## Verification

- All 161 backend tests pass
- Frontend TypeScript compilation clean (no errors)
- Frontend ESLint clean
- CSV export now shows `2026-06-24` instead of `1782172800000`
- PDF export now shows `2026-06-24` instead of `1782172800000`
- API responses return date strings instead of epoch numbers
- Frontend UI continues to display dates correctly

## Other Bugs Found During Exploration

While exploring the application, the following additional issues were noted (not fixed in this PR):

1. **Foreign key cascading disabled**: SQLite requires `PRAGMA foreign_keys = ON` to enforce `ON DELETE CASCADE`. Without this, deleting a client leaves orphaned work entries in the database. The orphaned rows are hidden from the UI (due to INNER JOIN) but remain in the database.

2. **MUI Select warnings**: Console warnings about "out-of-range value `0`" when the work entry form initializes with `clientId: 0` but no `MenuItem` with `value={0}` exists in the Select.

3. **No JWT implementation**: The README describes JWT-based authentication, but the actual implementation uses a simple `x-user-email` header without any token generation or verification.

## Screenshots

### Before Fix
The reports page appeared correct in the browser, but the exported CSV contained epoch milliseconds:
```
Date,Hours,Description,Created At
1782172800000,6,Backend API development,2026-06-24 14:05:59
```

![Before Fix - Reports page (date appeared correct in UI)](screenshot_before_fix.png)

### After Fix
Both the browser display and exports now show correct dates:
```
Date,Hours,Description,Created At
2026-06-24,8,Frontend development work,2026-06-24 14:10:08
2026-06-23,4.5,API integration testing,2026-06-24 14:10:08
```

![After Fix - Reports page with correct dates](screenshot_after_fix.png)
