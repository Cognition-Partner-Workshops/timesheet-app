# Root Cause Analysis: Date Off-By-One Bug

## Bug Summary

Work entry dates display one day earlier than the user entered for anyone in a timezone behind UTC (e.g., US Eastern, US Pacific, all of the Americas). A user who logs work for June 27 sees "6/26/2026" in the UI.

## Impact

- **Severity**: High
- **Affected users**: All users in timezones with negative UTC offsets (Americas, parts of Europe/Africa)
- **Affected features**: Work Entries list, Reports page, Dashboard recent entries
- **Business impact**: Incorrect date reporting leads to billing discrepancies, inaccurate timesheets, and potential compliance issues

## Root Cause

The bug is caused by a chain of three interacting issues across the backend validation layer and the frontend display logic:

### 1. Joi validation converts date strings to Date objects

In `backend/src/validation/schemas.js`:

```javascript
// BEFORE (buggy)
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string like `"2026-06-27"` but **converts it to a JavaScript `Date` object** representing UTC midnight: `2026-06-27T00:00:00.000Z`.

### 2. SQLite driver serializes Date objects as Unix timestamps

When the sqlite3 Node.js driver receives a JavaScript `Date` object as a query parameter, it serializes it as a **millisecond Unix timestamp** (e.g., `1782518400000`). This is what gets stored in the database.

### 3. Frontend interprets UTC midnight timestamps in local timezone

The frontend displays dates using:

```typescript
new Date(entry.date).toLocaleDateString()
```

When `entry.date` is `1782518400000` (UTC midnight June 27):
- In UTC: displays "6/27/2026" (correct)
- In US Eastern (UTC-4): displays "6/26/2026" (wrong - shows previous day)
- In US Pacific (UTC-7): displays "6/26/2026" (wrong - shows previous day)

UTC midnight, when converted to local time in negative-offset timezones, rolls back to the previous calendar day.

## Data Flow (Before Fix)

```
User enters: "2026-06-27"
    |
Frontend sends: { date: "2026-06-27" }
    |
Joi.date().iso() converts to: Date(2026-06-27T00:00:00.000Z)
    |
sqlite3 stores as: 1782518400000 (milliseconds)
    |
API returns: { date: 1782518400000 }
    |
Frontend: new Date(1782518400000).toLocaleDateString()
    |
US Eastern user sees: "6/26/2026"  <-- BUG: one day off!
```

## Fix Applied

### Backend: Keep dates as strings through the entire pipeline

**File**: `backend/src/validation/schemas.js`

```javascript
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
  .messages({ 'string.pattern.base': 'Date must be in YYYY-MM-DD format' })
```

By using `Joi.string().pattern()` instead of `Joi.date().iso()`, the date remains a plain string `"2026-06-27"` throughout the backend. SQLite stores it as text, and the API returns it as a string.

### Frontend: Parse date strings without timezone conversion

**Files**: `WorkEntriesPage.tsx`, `ReportsPage.tsx`, `DashboardPage.tsx`

```typescript
// AFTER (fixed) - timezone-safe date parsing
const d = typeof entry.date === 'string' ? entry.date : new Date(entry.date).toISOString().split('T')[0];
const [year, month, day] = d.split('-');
return `${parseInt(month)}/${parseInt(day)}/${year}`;
```

This manually parses the `YYYY-MM-DD` string into date components without any `Date` object construction, eliminating timezone conversion entirely.

## Data Flow (After Fix)

```
User enters: "2026-06-27"
    |
Frontend sends: { date: "2026-06-27" }
    |
Joi.string().pattern() keeps as: "2026-06-27"
    |
sqlite3 stores as: "2026-06-27" (text)
    |
API returns: { date: "2026-06-27" }
    |
Frontend: splits "2026-06-27" -> "6/27/2026"
    |
ALL users see: "6/27/2026"  <-- Correct regardless of timezone!
```

## Verification

- All 161 backend tests pass
- TypeScript compilation succeeds with no errors
- ESLint passes with no errors
- Manual testing confirmed dates display correctly when browser timezone is overridden to US Eastern

## Other Bugs Found (Not Fixed in This PR)

1. **MUI Select out-of-range warning**: WorkEntriesPage initializes `clientId` to `0` but has no `MenuItem` with `value={0}`, causing console warnings
2. **MUI Grid deprecated props**: Dashboard uses deprecated `item`, `xs`, `sm`, `md` props from MUI Grid v1 API
3. **Foreign key enforcement disabled**: SQLite doesn't enforce `ON DELETE CASCADE` without `PRAGMA foreign_keys = ON`, so deleting a client leaves orphaned work entries
4. **Tooltip on disabled button**: Export buttons wrapped in Tooltip don't fire events when disabled
