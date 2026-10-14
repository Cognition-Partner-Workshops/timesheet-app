# Root Cause Analysis: Date Timezone Bug

## Bug Summary

Work entry dates display incorrectly and silently shift backward by one day for users in timezones west of UTC (e.g., US Eastern, US Pacific). Every edit of a work entry further corrupts the stored date by shifting it back an additional day.

## Symptoms

1. **Wrong date displayed**: A work entry created for April 30 shows as April 29 for users in US Eastern timezone.
2. **Date drift on edit**: Opening the edit dialog pre-fills the DatePicker with the wrong date (one day earlier). Saving without changes shifts the stored date backward by one day. Repeated edits keep shifting the date further back.
3. **Reports show wrong dates**: The Reports page displays the same incorrect dates since it uses the same parsing pattern.
4. **Dashboard shows wrong dates**: Recent work entries on the Dashboard also show shifted dates.

## Root Cause

The bug is caused by two interacting problems in the frontend date handling:

### Problem 1: Date parsing treats dates as UTC

The backend stores dates using Joi's `date()` validator, which converts ISO date strings into JavaScript `Date` objects. SQLite then stores these as numeric UTC timestamps (epoch milliseconds). The API returns values like `1777507200000` (UTC midnight of April 30, 2026).

The frontend used `new Date(entry.date)` to parse these values. Since the timestamp represents UTC midnight, calling `.toLocaleDateString()` in a negative-UTC timezone produces the previous day:

```
UTC midnight April 30 = April 29 at 8:00 PM in US Eastern (UTC-4)
```

**Affected code** (`WorkEntriesPage.tsx`, `ReportsPage.tsx`, `DashboardPage.tsx`):
```tsx
// BUG: new Date(timestamp) creates UTC midnight, displays as previous day in west-of-UTC zones
{new Date(entry.date).toLocaleDateString()}
```

### Problem 2: Date serialization uses UTC conversion

When submitting the form, the code used `toISOString().split('T')[0]` to format the date. Since `toISOString()` converts to UTC, this could produce a different date than what the DatePicker shows:

```tsx
// BUG: toISOString() converts to UTC, potentially shifting the date
date: formData.date.toISOString().split('T')[0],
```

### Problem 3: Edit pre-fill compounds the error

When opening the edit dialog, dates from the API were parsed with `new Date(entry.date)`, creating a UTC-midnight Date that the DatePicker interprets as local time — showing the wrong day:

```tsx
// BUG: UTC midnight timestamp displays as previous day in DatePicker
date: new Date(entry.date),
```

## Impact

- **Data corruption**: Every edit of a work entry silently shifts the date backward. Users editing other fields (hours, description) unknowingly change the date.
- **Incorrect reports**: Reports show wrong dates, undermining trust in exported CSV/PDF documents.
- **Affects all non-UTC users**: Any user in the Americas, or any timezone west of UTC, would experience this bug.

## Fix

Created a shared date utility module (`frontend/src/utils/dateUtils.ts`) with two functions:

### `parseLocalDate(value: string | number): Date`
Extracts UTC date components and constructs a local-midnight Date, ensuring the displayed date always matches the intended date regardless of timezone:

```ts
export function parseLocalDate(value: string | number): Date {
  const d = new Date(value);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
```

### `formatLocalDate(date: Date): string`
Formats a Date using local-timezone components instead of `toISOString()`:

```ts
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### Files Changed

| File | Change |
|------|--------|
| `frontend/src/utils/dateUtils.ts` | New shared date utility module |
| `frontend/src/pages/WorkEntriesPage.tsx` | Use `parseLocalDate` for display/edit, `formatLocalDate` for submission |
| `frontend/src/pages/ReportsPage.tsx` | Use `parseLocalDate` for date display |
| `frontend/src/pages/DashboardPage.tsx` | Use `parseLocalDate` for date display |
| `frontend/src/types/api.ts` | Fix `WorkEntry.date` type to `string \| number` to match actual API response |

## Verification

- All 161 backend tests pass
- Frontend builds with no TypeScript or lint errors
- Work entry dates display correctly after the fix
- Edit dialog pre-fills the correct date
- Saving an edited entry preserves the original date
