# Root Cause Analysis: Work-entry dates exported as raw epoch numbers

## Summary

Every work-entry `date` was being stored in SQLite as an **epoch-millisecond
number** instead of the intended `YYYY-MM-DD` string. As a result, the two most
important user-facing outputs of the app — the **CSV export** and **PDF export**
of a client's time report — displayed unreadable numbers such as
`1782950400000` in the `Date` column instead of `2026-07-02`.

The web UI *appeared* correct only by coincidence, which is what made this bug
easy to miss (see "Why it was hidden" below).

## Impact

- **CSV export** (`GET /api/reports/export/csv/:clientId`) — `Date` column shows
  raw epoch numbers.
- **PDF export** (`GET /api/reports/export/pdf/:clientId`) — same corruption in
  the report table.
- **REST API** (`/api/work-entries`, `/api/reports/client/:clientId`) — returned
  `date` as a `number`, violating the frontend `WorkEntry.date: string` type
  contract.

Exports are the deliverable of a time-tracking app, so this affected every user
on every report.

### Before / After (CSV export of the same data)

```
BEFORE                                          AFTER
Date,Hours,Description,Created At               Date,Hours,Description,Created At
1782950400000,2.25,Meeting,...                  2026-07-02,2.25,Meeting,...
1782864000000,8.5,Dev work,...                  2026-07-01,8.5,Dev work,...
```

## Root cause

Work-entry input is validated with Joi in
`backend/src/validation/schemas.js`:

```js
// before
date: Joi.date().iso().required()
```

`Joi.date()` does more than validate — it **coerces** the incoming
`"2026-07-01"` string into a JavaScript `Date` object. That `Date` is then passed
straight into the parameterized `INSERT`:

```js
db.run('INSERT INTO work_entries (..., date) VALUES (?, ?, ?, ?, ?)',
       [clientId, req.userEmail, hours, description || null, date /* Date obj */], ...)
```

The `node-sqlite3` driver binds a JS `Date` by its numeric value
(`Date.prototype.valueOf()` → epoch milliseconds). Because SQLite uses dynamic
typing (the `date DATE` column has NUMERIC affinity and does not enforce a
format), the number `1782864000000` was stored verbatim and read back as a
number.

## Why it was hidden

The React tables render dates with `new Date(entry.date).toLocaleDateString()`.
When `entry.date` is the epoch-ms number, `new Date(1782864000000)`
reconstructs the correct instant, so the on-screen tables looked fine. The
corruption only surfaced in the CSV/PDF exporters, which write the value
directly without re-parsing it. The existing backend tests also mock the SQLite
layer, so they never exercised the real string→Date→number round-trip.

## The fix

Keep the value as the original ISO string while still validating it, using
Joi's `.raw()` modifier in `backend/src/validation/schemas.js`:

```js
// after
date: Joi.date().iso().raw().required()   // create schema
date: Joi.date().iso().raw().optional()   // update schema
```

`.iso()` still rejects non-ISO input (e.g. `01/15/2024`) and impossible dates
(e.g. `2024-13-45`), but `.raw()` makes Joi return the **original string** as the
validated value instead of the coerced `Date`. The string `"2026-07-01"` is then
stored as text in SQLite, and reads/exports return the correct value. No route
code needed to change, and the frontend `date: string` contract is honored.

### Verification

- CSV and PDF exports now show `2026-07-02` / `2026-07-01`.
- API responses return `date` as a `string`.
- Invalid formats (`01/15/2024`) are still rejected with a 400.
- Full backend suite passes (added 2 regression tests asserting the schema keeps
  `date` as a string): **163 passing**.
- Frontend `eslint` passes.

## Regression tests added

`backend/src/__tests__/validation/schemas.test.js` — for both
`workEntrySchema` and `updateWorkEntrySchema`:

```js
test('should keep date as an ISO string and not coerce it to a Date', () => {
  const { error, value } = workEntrySchema.validate({ clientId: 1, hours: 5, date: '2024-01-15' });
  expect(error).toBeUndefined();
  expect(typeof value.date).toBe('string');
  expect(value.date).toBe('2024-01-15');
});
```

## Secondary observation (not fixed here)

While exploring, I also found that deleting a client does **not** cascade-delete
its work entries. The schema declares
`FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE`, but SQLite
disables foreign keys by default and `backend/src/database/init.js` never runs
`PRAGMA foreign_keys = ON`. Verified: after deleting a client, its work_entries
rows remain orphaned. The effect is largely invisible today because the
work-entry queries `JOIN clients`, which hides orphans, and the DB is in-memory
(wiped on restart) — so it is lower impact than the export corruption. A
follow-up fix would enable the pragma on each connection in `getDatabase()`.
This RCA/PR intentionally stays scoped to the highest-impact bug.
