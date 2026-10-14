# Root Cause Analysis: Work-entry dates exported as raw epoch numbers

## Summary

Every CSV and PDF report exported a work entry's date as a raw Unix-millisecond
number (e.g. `1782259200000`) instead of a readable calendar date (e.g.
`2026-06-24`). Exporting reports is a headline feature of the app
("Export hourly reports to CSV or PDF"), so this made the exported artifacts —
the thing a user actually hands to a client or finance team — effectively
unusable.

| | Date column in export |
|---|---|
| **Before** | `1782259200000,8.5,Backend API development,...` |
| **After**  | `2026-06-24,8.5,Backend API development,...` |

## Symptoms

- CSV export `Date` column showed a 13-digit number.
- PDF export `Date` column showed the same 13-digit number.
- The bug was **invisible in the web UI**: the Work Entries, Reports and
  Dashboard tables all render the date with `new Date(entry.date)`, and
  `new Date(1782259200000)` happens to produce the correct date — so the
  corruption only surfaced in the exports, which print the stored value verbatim.

## Root cause

The `date` field was being stored in the database as an epoch-millisecond
**number** rather than a `YYYY-MM-DD` **string**.

The chain of events:

1. The work-entry validation schema declares the date with Joi's date type:

   ```js
   // backend/src/validation/schemas.js
   date: Joi.date().iso().required()
   ```

   `Joi.date()` does not just validate — it **coerces** the validated value,
   replacing the incoming `"2026-06-24"` string with a JavaScript `Date` object
   on `value.date`.

2. The route inserted that coerced value straight into SQLite:

   ```js
   // backend/src/routes/workEntries.js (before)
   db.run(
     'INSERT INTO work_entries (..., date) VALUES (..., ?)',
     [..., date]   // <-- date is a JS Date object here
   );
   ```

3. `node-sqlite3` does not have a native date type. When it binds a JS `Date`,
   it stores the value's numeric primitive — i.e. `date.valueOf()`, the epoch in
   milliseconds. The `DATE` column has no strict typing in SQLite, so the number
   was happily stored.

4. The report/CSV/PDF code reads that column back and writes it out as-is, so the
   number leaked into the exported files.

The same flaw existed in the **update** path, which pushed `value.date` (also a
coerced `Date`) into the `UPDATE` statement.

## The fix

Normalize the date to a `YYYY-MM-DD` string at the point of persistence, in both
the create and update routes:

```js
// backend/src/routes/workEntries.js
function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

// create
[clientId, req.userEmail, hours, description || null, toDateString(date)]

// update
values.push(toDateString(value.date));
```

`toDateString` accepts either the Joi-coerced `Date` or a plain string and always
produces a clean `YYYY-MM-DD`, so the `DATE` column now stores exactly what the
schema implies. Because the input is an ISO date already normalized to UTC
midnight by Joi, `toISOString().split('T')[0]` yields the intended calendar date.

This fixes the cause at the boundary where the bad value entered the database,
rather than papering over it by reformatting in three separate read paths
(report JSON, CSV, PDF).

## Why this location

The bug could also be "fixed" by formatting the number when generating each
export, but that would:

- leave the database holding a wrong/ambiguous value,
- require duplicate formatting logic in the report, CSV and PDF code paths, and
- leave any future consumer of the data (new endpoints, migrations to file-based
  SQLite, analytics) exposed to the same corruption.

Fixing it once at write time keeps the stored data correct for every reader.

## Verification

- `POST` then export CSV → `Date` column shows `2026-06-24` (was
  `1782259200000`).
- `PUT` to change the date, then export → updated date shown correctly.
- PDF export renders the readable date.
- Added regression tests asserting the value bound to the SQL `INSERT`/`UPDATE`
  for the date column is the `YYYY-MM-DD` string.
- Full backend suite passes (163 tests); frontend lint + production build pass.

## Related observation (not fixed here)

The frontend sends the date as `formData.date.toISOString().split('T')[0]`
(`WorkEntriesPage.tsx`). `toISOString()` converts the locally-selected `Date` to
UTC, so for users in timezones west of UTC a date picked at local midnight can
shift to the previous calendar day. This is a separate, timezone-dependent issue
and is out of scope for this change, but is worth a follow-up (e.g. formatting
the picked date using local components instead of `toISOString`).
