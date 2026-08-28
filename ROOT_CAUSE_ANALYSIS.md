# Root Cause Analysis: CSV/PDF Export Shows Raw Unix Timestamps Instead of Dates

## Bug Summary

When exporting client time reports as CSV or PDF, the **Date column displays raw Unix timestamps** (e.g., `1782259200000`) instead of human-readable dates (e.g., `6/24/2026`). This renders exported reports unusable for sharing with clients or management.

## Impact

**High** — Report export is a core feature of a billable-hours tracking application. The exported files are intended to be shared with clients for invoicing and with management for review. Unreadable timestamps make both CSV and PDF exports functionally broken for their primary use case.

## Steps to Reproduce

1. Log in to the application
2. Create a client and add work entries with various dates
3. Navigate to Reports, select a client
4. Click "Export as CSV" or "Export as PDF"
5. Open the exported file — the Date column shows numbers like `1782259200000`

## Root Cause

The bug is in `backend/src/routes/reports.js`. The data flow is:

1. **Input**: User submits a date string like `"2026-06-24"` when creating a work entry
2. **Validation**: Joi's `Joi.date().iso()` schema parses the ISO string into a JavaScript `Date` object
3. **Storage**: SQLite stores the `Date` object as a Unix timestamp in milliseconds (e.g., `1782259200000`)
4. **Retrieval**: The database returns the raw millisecond timestamp
5. **Frontend display**: The React UI correctly converts it back: `new Date(entry.date).toLocaleDateString()` → `"6/24/2026"`
6. **Export (BUG)**: The CSV and PDF export routes write `entry.date` directly to the output without any date formatting

The frontend masks the issue because it formats timestamps client-side, but the backend export endpoints bypass client-side rendering and output the raw database value.

### Affected Code (before fix)

**CSV Export** (line ~124):
```js
// Wrote raw workEntries with unformatted timestamps directly to CSV
csvWriter.writeRecords(workEntries)
```

**PDF Export** (line ~227):
```js
// Wrote raw timestamp directly into the PDF
doc.text(entry.date, 50, doc.y, { width: 100 });
```

## Fix Applied

Format the date in both export routes using `new Date(entry.date).toLocaleDateString('en-US')` before writing to the output file.

**CSV Export** — map entries to format dates before writing:
```js
const formattedEntries = workEntries.map(entry => ({
  ...entry,
  date: new Date(entry.date).toLocaleDateString('en-US'),
}));

csvWriter.writeRecords(formattedEntries)
```

**PDF Export** — format each date inline:
```js
const formattedDate = new Date(entry.date).toLocaleDateString('en-US');
doc.text(formattedDate, 50, doc.y, { width: 100 });
```

## Before / After

**Before (broken):**
```
Date,Hours,Description,Created At
1782259200000,8,Backend API development,2026-06-24 14:00:28
1782172800000,4.5,Frontend refactoring,2026-06-24 14:01:20
1782086400000,6,Database migration,2026-06-24 14:01:20
```

**After (fixed):**
```
Date,Hours,Description,Created At
6/24/2026,8,Backend API development,2026-06-24 14:05:57
6/23/2026,4.5,Frontend refactoring,2026-06-24 14:05:57
6/22/2026,6,Database migration,2026-06-24 14:05:57
```

## Verification

- All 161 existing backend tests pass after the fix
- Manual testing confirms both CSV and PDF exports now show formatted dates
- Frontend report display continues to work correctly (no regression)

## Lessons Learned

When a data format transformation happens at the presentation layer (frontend), any server-side export path that bypasses the frontend will output raw stored data. Export routes should apply the same formatting logic server-side that the frontend applies client-side.
