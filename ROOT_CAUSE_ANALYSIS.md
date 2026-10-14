# Root Cause Analysis: Date Stored as Millisecond Timestamp Instead of ISO String

## Bug Summary

Work entry dates are stored in SQLite as millisecond timestamps (e.g., `1775520000000`) instead of ISO date strings (e.g., `2026-04-07`). This causes CSV and PDF report exports to display unintelligible numeric timestamps in the Date column, rendering exported reports unusable.

## Impact

- **CSV exports** show raw timestamps like `1775520000000` instead of human-readable dates
- **PDF exports** print the same numeric timestamps in the Date column
- **API responses** return numeric timestamps for the `date` field, forcing the frontend to rely on `new Date(timestamp)` conversion which can introduce timezone-related off-by-one errors
- This affects **every work entry** in the system and breaks the core reporting/export functionality

## Root Cause

The bug originates in `backend/src/validation/schemas.js`. The Joi validation schemas for work entry creation and update used `Joi.date().iso()`:

```javascript
// BEFORE (buggy)
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.date().iso().required()   // <-- THIS IS THE PROBLEM
});
```

### Why this causes the bug

1. The frontend sends dates as ISO strings: `"2026-04-07"`
2. `Joi.date().iso()` **validates** that the input is a valid ISO date, but it also **converts** the string into a JavaScript `Date` object
3. After Joi validation, `value.date` is now a `Date` object (e.g., `Date('2026-04-07T00:00:00.000Z')`) instead of the original string `"2026-04-07"`
4. When this `Date` object is passed to SQLite's parameterized query, SQLite stores the JavaScript numeric representation: the Unix timestamp in milliseconds (`1775520000000`)
5. All downstream consumers (CSV writer, PDF generator, API responses) then read back this numeric value instead of a date string

### The conversion chain

```
Frontend sends: "2026-04-07"
    --> Joi.date().iso() converts to: Date object (2026-04-07T00:00:00.000Z)
    --> SQLite stores as: 1775520000000 (milliseconds since epoch)
    --> CSV/PDF exports display: "1775520000000"
```

## Fix

Changed the Joi schema from `Joi.date().iso()` to `Joi.string().pattern()` with an ISO date regex pattern (`/^\d{4}-\d{2}-\d{2}$/`). This validates the date format without converting the string to a Date object:

```javascript
// AFTER (fixed)
const workEntrySchema = Joi.object({
  clientId: Joi.number().integer().positive().required(),
  hours: Joi.number().positive().max(24).precision(2).required(),
  description: Joi.string().trim().max(1000).optional().allow(''),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': 'Date must be in YYYY-MM-DD format' })
});
```

The same fix was applied to `updateWorkEntrySchema`.

### Why this fix is correct

- The date is now stored in SQLite as the string `"2026-04-07"` (matching the `DATE` column type)
- CSV and PDF exports correctly display the human-readable date
- API responses return the date as a string, eliminating timezone conversion issues on the frontend
- The regex pattern still validates the format (YYYY-MM-DD), rejecting invalid inputs
- All 161 existing tests continue to pass

## Files Changed

- `backend/src/validation/schemas.js` - Changed `date` field validation in both `workEntrySchema` and `updateWorkEntrySchema`

## Other Bugs Found During Exploration

1. **SQLite foreign keys not enforced**: The database initialization (`backend/src/database/init.js`) does not enable `PRAGMA foreign_keys = ON`. This means `ON DELETE CASCADE` constraints on `work_entries.client_id` are not enforced. Deleting a client leaves orphaned work entries that are silently hidden by INNER JOINs in queries, causing data loss from the user's perspective.

2. **Vite proxy incomplete**: The Vite dev server only proxies `/api` routes but not `/health`, so the frontend health check endpoint doesn't work through the dev proxy.
