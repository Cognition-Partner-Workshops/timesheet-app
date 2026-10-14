# Root Cause Analysis: Work Entry Dates Stored as Timestamps

## Bug Summary

Work entry dates are stored in SQLite as raw millisecond timestamps (e.g., `1777507200000`) instead of ISO date strings (e.g., `2026-04-30`). This causes CSV and PDF exports to display meaningless numeric timestamps in the Date column, making exported reports unusable.

## Symptoms

- **CSV Export**: Date column shows `1777507200000` instead of `2026-04-30`
- **PDF Export**: Date column shows `1777507200000` instead of `2026-04-30`
- **API Response**: The `date` field in work entry JSON responses returns a number instead of a string
- **Frontend Display**: Appears to work correctly only by accident, because JavaScript's `new Date()` constructor accepts both millisecond timestamps and ISO strings

## Root Cause

The bug originates in `backend/src/validation/schemas.js`:

```javascript
// BEFORE (buggy)
date: Joi.date().iso().required()
```

Joi's `date().iso()` validator accepts an ISO date string like `"2026-04-30"` but then **converts it to a JavaScript `Date` object** as part of validation. When this `Date` object is passed to SQLite's `db.run()`, SQLite serializes it as a numeric millisecond timestamp (its default behavior for non-string date values).

### Data Flow (Before Fix)

1. Frontend sends: `{ "date": "2026-04-30" }` (valid ISO string)
2. Joi validates with `date().iso()` -> converts to `Date` object: `Wed Apr 30 2026 00:00:00 GMT+0000`
3. SQLite receives the `Date` object -> stores as `1777507200000` (milliseconds since epoch)
4. Backend queries return `1777507200000` as the `date` field
5. CSV/PDF exports write `1777507200000` directly into the Date column
6. Frontend's `new Date(1777507200000)` happens to produce the correct date (by accident)

## Fix Applied

Changed the Joi validation schema from `Joi.date().iso()` to a string-based pattern that validates YYYY-MM-DD format while preserving the original string value:

```javascript
// AFTER (fixed)
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
  'string.pattern.base': 'Date must be in YYYY-MM-DD format'
})
```

This was applied to both `workEntrySchema` (create) and `updateWorkEntrySchema` (update) in `backend/src/validation/schemas.js`.

### Data Flow (After Fix)

1. Frontend sends: `{ "date": "2026-04-30" }` (valid ISO string)
2. Joi validates the format -> preserves the original string `"2026-04-30"`
3. SQLite receives the string -> stores as `"2026-04-30"` (TEXT)
4. Backend queries return `"2026-04-30"` as the `date` field
5. CSV/PDF exports write `"2026-04-30"` into the Date column
6. Frontend's `new Date("2026-04-30")` produces the correct date

## Impact

- **Severity**: High - all exported reports (CSV and PDF) had corrupted date columns
- **Scope**: Every work entry created through the application was affected
- **User Impact**: Reports exported for client billing or record-keeping contained unreadable timestamp numbers instead of dates

## Files Changed

- `backend/src/validation/schemas.js` - Changed `date` validation from `Joi.date().iso()` to `Joi.string().pattern()` in both `workEntrySchema` and `updateWorkEntrySchema`

## Other Bugs Noted During Exploration

1. **Foreign key constraints not enforced**: SQLite's `PRAGMA foreign_keys` is not enabled in `database/init.js`, so `ON DELETE CASCADE` on the `work_entries` table does not function. Deleting a client leaves orphaned work entries in the database (invisible due to JOIN queries, but still consuming resources).

2. **No JWT tokens generated**: The login endpoint (`routes/auth.js`) does not generate JWT tokens despite the README claiming JWT-based authentication. Authentication relies solely on the `x-user-email` header, which any client can set without verification.
