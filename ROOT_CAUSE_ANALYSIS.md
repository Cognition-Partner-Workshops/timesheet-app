# Root Cause Analysis: Date Off-By-One Bug

## Bug Summary

Work entry dates display **one day earlier than intended** for all users whose
browser is in a timezone behind UTC (e.g. US Eastern, Central, Pacific).
Editing and re-saving an entry silently shifts the date backward, causing
progressive data corruption with each edit.

| Intended Date | Displayed (UTC-5) | After Edit+Save |
|---|---|---|
| 2026-01-15 | 1/14/2026 | 2026-01-14 |
| 2026-03-01 | 2/28/2026 | 2026-02-28 |

## Root Cause

The bug has two compounding parts:

### 1. Backend: Joi converts date strings to epoch milliseconds

The Joi validation schema uses `Joi.date().iso()`:

```js
date: Joi.date().iso().required()
```

`Joi.date().iso()` parses the incoming ISO string `"2026-01-15"` into a
JavaScript `Date` object (`Date("2026-01-15T00:00:00.000Z")`). When this
object is passed to the SQLite parameterized query, the sqlite3 driver
serializes it as its numeric value: **epoch milliseconds** (`1768435200000`).

The database column is declared `DATE`, but SQLite's type system is flexible
and happily stores the number. All subsequent reads return the number
instead of the original date string.

### 2. Frontend: `new Date(epoch)` + `toLocaleDateString()` is timezone-sensitive

The frontend displays dates with:

```tsx
new Date(entry.date).toLocaleDateString()
```

`new Date(1768435200000)` creates a Date at **2026-01-15 00:00:00 UTC**.
In any timezone behind UTC (e.g. America/New_York, UTC-5), this moment
corresponds to **2026-01-14 19:00:00 EST**, so `toLocaleDateString()`
renders "1/14/2026" -- one day too early.

When editing, the same epoch value pre-fills the DatePicker with the wrong
local date. On save, `toISOString().split('T')[0]` converts the wrong
local date back to an ISO string, permanently shifting the stored date
backward.

## Impact

- **Every user in a negative UTC-offset timezone** sees the wrong date.
- **Every edit-and-save cycle** silently shifts the date backward by one day.
- Affected pages: Work Entries table, Dashboard recent entries, Reports table.
- CSV and PDF exports also contain the numeric epoch value instead of a
  readable date string.

## Fix

### Backend (`backend/src/routes/workEntries.js`)

After Joi validation, normalize the date back to an ISO date string before
inserting or updating in SQLite:

```js
const dateStr = date instanceof Date
  ? date.toISOString().split('T')[0]
  : date;
```

This ensures the database stores `"2026-01-15"` (text) instead of
`1768435200000` (number).

### Frontend (`frontend/src/utils/dateUtils.ts`)

A new `parseLocalDate` utility constructs a **local-midnight** `Date` from
either format, so the calendar day is preserved regardless of timezone:

```ts
export function parseLocalDate(value: string | number): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const utc = new Date(value);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
```

All date display calls (`DashboardPage`, `WorkEntriesPage`, `ReportsPage`,
`ClientsPage`) now use `formatDate()` from this utility instead of raw
`new Date(...).toLocaleDateString()`.

The form submission in `WorkEntriesPage` was also updated to serialize the
date from local components (`getFullYear/getMonth/getDate`) instead of
`toISOString()`, preventing the timezone shift on save.

## Other Bugs Noted During Exploration

| # | Bug | Severity | Location |
|---|---|---|---|
| 1 | `.env.example` sets `FRONTEND_URL=http://localhost:3000` but frontend runs on port 5173; copying the example breaks CORS | Medium | `backend/.env.example` |
| 2 | SQLite foreign keys not enforced (`PRAGMA foreign_keys` never enabled); deleting a client leaves orphaned work entries | Medium | `backend/src/database/init.js` |
| 3 | Vite proxy only forwards `/api`; the `/health` endpoint is not proxied | Low | `frontend/vite.config.ts` |
