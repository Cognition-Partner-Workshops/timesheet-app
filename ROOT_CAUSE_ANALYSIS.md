# Root Cause Analysis: Timezone-Dependent Date Off-by-One Bug

## Bug Summary

Work entry dates display as **one day earlier** than the user selected for anyone in a timezone west of UTC (e.g. US Eastern, US Pacific). A user who logs work for May 5 sees "5/4/2026" in the Work Entries table, Reports page, and Dashboard.

The same class of bug also corrupts dates on **submission** for users east of UTC (e.g. UTC+5 through UTC+14): the date sent to the API can shift backward by a day.

## Impact

- **Severity: High** — every date displayed or submitted in the app is potentially wrong, making timesheets inaccurate for any user not in UTC.
- Affects three pages: Work Entries, Reports, and Dashboard.
- Affects both reading (display) and writing (create/edit submission).

## Root Cause

### Display path

Dates are stored in the database as date-only strings (`"2026-05-05"`). The frontend renders them with:

```js
new Date(entry.date).toLocaleDateString()
```

Per the ECMAScript specification, `new Date("2026-05-05")` (a date-only ISO 8601 string) is interpreted as **UTC midnight** (`2026-05-05T00:00:00.000Z`). When `toLocaleDateString()` converts that instant to the user's local timezone, it can roll back to the previous calendar day:

| Timezone | UTC instant | Local time | Displayed date |
|---|---|---|---|
| UTC | May 5 00:00 UTC | May 5 00:00 | 5/5/2026 |
| EST (UTC−5) | May 5 00:00 UTC | May 4 19:00 | **5/4/2026** |
| PST (UTC−8) | May 5 00:00 UTC | May 4 16:00 | **5/4/2026** |

### Submission path

When creating or editing a work entry, the date was serialised with:

```js
formData.date.toISOString().split('T')[0]
```

`toISOString()` always returns UTC. If a user in UTC+10 picks May 5 in the date picker, their local Date object is `May 5 00:00 local = May 4 14:00 UTC`, so `toISOString()` yields `"2026-05-04T14:00:00.000Z"`, and splitting gives `"2026-05-04"` — the wrong date.

## Fix

### New utility (`frontend/src/utils/dateUtils.ts`)

Two small helper functions:

- **`parseLocalDate(dateStr)`** — splits `"YYYY-MM-DD"` and constructs a `Date` using `new Date(year, month - 1, day)`, which always represents local midnight regardless of timezone.
- **`formatDateForApi(date)`** — extracts `getFullYear()`, `getMonth()`, `getDate()` (local components) and formats as `"YYYY-MM-DD"`, avoiding the UTC shift that `toISOString()` introduces.

### Files changed

| File | Change |
|---|---|
| `frontend/src/utils/dateUtils.ts` | New file — `parseLocalDate` and `formatDateForApi` helpers |
| `frontend/src/pages/WorkEntriesPage.tsx` | Display: `parseLocalDate(entry.date).toLocaleDateString()`; Edit load: `parseLocalDate(entry.date)`; Submit: `formatDateForApi(formData.date)` |
| `frontend/src/pages/DashboardPage.tsx` | Display: `parseLocalDate(entry.date).toLocaleDateString()` |
| `frontend/src/pages/ReportsPage.tsx` | Display: `parseLocalDate(entry.date).toLocaleDateString()` |

## Verification

Console test confirming the fix eliminates the off-by-one:

```
// Before fix
new Date("2026-05-05").toLocaleDateString()
// UTC: "5/5/2026"  EST: "5/4/2026"  PST: "5/4/2026"

// After fix
parseLocalDate("2026-05-05").toLocaleDateString()
// UTC: "5/5/2026"  EST: "5/5/2026"  PST: "5/5/2026"
```

## Other Bugs Noted (not fixed in this PR)

1. **CORS origin mismatch** — `backend/.env` sets `FRONTEND_URL=http://localhost:3000` but the Vite dev server runs on port 5173. Works in dev because the Vite proxy forwards `/api` requests, but would break any direct cross-origin requests.
2. **Export buttons enabled without client selected** — CSV/PDF export buttons on the Reports page are only disabled via the HTML `disabled` attribute on the native `<button>`, but the icon-buttons may still allow click events.
