# Root Cause Analysis: Corrupted dates in CSV/PDF report exports

## Summary

Exported time reports (both **CSV** and **PDF**) rendered the **Date** column as
raw epoch‑millisecond numbers (e.g. `1782000000000`) instead of human‑readable
dates (e.g. `2026-06-21`). Because reporting/export is a headline feature of the
app, every exported report was effectively unusable.

## Symptom

1. Log in, create a client, and add a work entry dated `2026-06-20`.
2. Go to **Reports**, select the client, and click **Export CSV** or **Export PDF**.
3. The Date column shows a number like `1781913600000` rather than `2026-06-20`.

The in‑app tables (Work Entries, Reports, Dashboard) looked correct, which masked
the bug — see "Why it was hidden" below.

| | Date column |
|---|---|
| Before | `1782000000000`, `1781913600000` |
| After  | `2026-06-21`, `2026-06-19` |

## Root cause

The work‑entry validation schema coerces the incoming date into a JavaScript
`Date` object:

```js
// backend/src/validation/schemas.js
const workEntrySchema = Joi.object({
  ...
  date: Joi.date().iso().required(),   // returns a JS Date, not the original string
});
```

The create/update routes then bound that `Date` object directly as a SQL
parameter:

```js
// backend/src/routes/workEntries.js (before)
[clientId, req.userEmail, hours, description || null, date]   // date is a Date
```

`node-sqlite3` does not have a native date type. When a `Date` object is bound as
a parameter, it is stored as its **numeric epoch‑ms value** in the `date`
(`DATE`) column. So `"2026-06-20"` was persisted as `1781913600000`.

## Why it was hidden in the UI

The frontend renders dates with `new Date(entry.date).toLocaleDateString()`.
`new Date(1781913600000)` is a valid timestamp, so the tables displayed the
correct day and the corruption was invisible in the app. The CSV writer and
PDFKit, however, print the stored value verbatim, exposing the raw number.

## Fix

Normalize the validated date back to a `YYYY-MM-DD` string before it is written
to the database, in both the create and update paths:

```js
// backend/src/routes/workEntries.js (after)
function toDateString(value) {
  return value instanceof Date ? value.toISOString().split('T')[0] : value;
}

// INSERT
[clientId, req.userEmail, hours, description || null, toDateString(date)]

// UPDATE
values.push(toDateString(value.date));
```

This keeps Joi's date validation, stores values that match the column's `DATE`
type, and makes CSV/PDF exports (and the API responses) return proper date
strings. The frontend is unaffected — `new Date("2026-06-20")` still renders
correctly.

The fix targets storage (the root cause) rather than formatting at each export
site, so all current and future consumers of the `date` field are correct.

## Verification

- Re‑created entries and re‑exported: CSV/PDF now show `2026-06-21` / `2026-06-19`.
- Added a regression test asserting the value bound to the `INSERT` is a
  `YYYY-MM-DD` string (`backend/src/__tests__/routes/workEntries.test.js`).
- Full backend suite passes (162 tests).

## Note: data persistence

The database is SQLite in‑memory, so it resets on every backend restart and no
data migration is required. If the app is switched to file‑based SQLite, any
pre‑existing rows that already contain epoch‑ms values would need a one‑time
backfill to convert them to date strings.
