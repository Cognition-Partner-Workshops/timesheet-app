# Root Cause Analysis: Dates Exported as Epoch Milliseconds in CSV and PDF Reports

## Bug Summary

When exporting client time reports as CSV or PDF, the **Date** column displays raw epoch milliseconds (e.g., `1775260800000`) instead of human-readable dates (e.g., `2026-04-04`). This renders the exported reports unusable for anyone trying to read or process them outside the application.

## Impact

- **Severity**: Critical
- **Affected features**: CSV export, PDF export, and all API responses returning work entry dates
- **User impact**: Exported reports are unintelligible. Users sharing CSV/PDF reports with clients, managers, or accounting teams receive documents with meaningless 13-digit numbers in the Date column instead of actual dates.

## Root Cause

The bug originates in the Joi validation schema at `backend/src/validation/schemas.js`.

### The Problem

```js
// BEFORE (buggy)
date: Joi.date().iso().required()
```

Joi's `date().iso()` validator:
1. Accepts an ISO date string like `"2026-04-01"` from the request body
2. **Converts it to a JavaScript `Date` object** (e.g., `Date(2026-04-01T00:00:00.000Z)`)

When this `Date` object is then passed to SQLite via a parameterized query:
```js
db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date])
```

SQLite's `node-sqlite3` driver serializes the JavaScript `Date` object to its numeric representation: **epoch milliseconds** (e.g., `1775001600000`).

This numeric value is stored in the database and returned as-is in all subsequent queries. The frontend happened to work because `new Date(1775001600000)` in JavaScript correctly reconstructs the date. However, the CSV and PDF export endpoints write the raw database values directly to the output files, producing unreadable epoch numbers.

### Data Flow (Before Fix)

```
Client sends: "2026-04-01" (ISO string)
       |
Joi validates & converts to: Date object (Wed Apr 01 2026 00:00:00 GMT)
       |
SQLite stores as: 1775001600000 (epoch milliseconds)
       |
API returns: 1775001600000
       |
CSV/PDF exports: 1775001600000  <-- BUG: unreadable
Frontend display: new Date(1775001600000).toLocaleDateString() --> "4/1/2026"  <-- works by accident
```

## Fix

Modified the Joi validation schemas in `backend/src/validation/schemas.js` to convert the parsed `Date` object back to a `YYYY-MM-DD` string before it reaches the database layer:

```js
// AFTER (fixed)
date: Joi.date().iso().required().custom((value) => {
  // Convert Joi Date object back to YYYY-MM-DD string for SQLite storage
  return value.toISOString().split('T')[0];
})
```

This fix was applied to both `workEntrySchema` (for creating entries) and `updateWorkEntrySchema` (for updating entries).

### Data Flow (After Fix)

```
Client sends: "2026-04-01" (ISO string)
       |
Joi validates & converts to: Date object, then custom() converts to "2026-04-01" (string)
       |
SQLite stores as: "2026-04-01" (text)
       |
API returns: "2026-04-01"
       |
CSV/PDF exports: "2026-04-01"  <-- FIXED: readable
Frontend display: new Date("2026-04-01").toLocaleDateString() --> "4/1/2026"  <-- still works
```

## Why It Happened

This is a type coercion issue at the boundary between the validation layer (Joi) and the storage layer (SQLite). Joi's `date()` type is designed to normalize date inputs into JavaScript `Date` objects for further validation (e.g., min/max date checks). However, the code assumed the validated value would retain its original string format when passed to SQLite. SQLite, being dynamically typed, stored whatever JavaScript value it received -- in this case, the numeric representation of the `Date` object.

The bug was masked in the frontend because JavaScript's `new Date()` constructor accepts both ISO strings and epoch milliseconds, so the UI displayed dates correctly regardless of the underlying format.

## Verification

- All 161 existing backend tests pass after the fix
- CSV export now shows `2026-04-04` instead of `1775260800000`
- PDF export now shows `2026-04-04` instead of `1775260800000`
- Frontend date display continues to work correctly
- API responses now return clean ISO date strings
