# Root Cause Analysis: Raw Timestamps in CSV and PDF Exports

## Bug Summary

When exporting client time reports as CSV or PDF, the **Date** column displays raw Unix timestamps (e.g., `1782259200000`) instead of human-readable dates (e.g., `2026-06-24`). This makes exported reports unusable for accounting, client billing, or any downstream data processing.

## Severity

**High** -- This bug affects a core business feature (report exports). Exported CSV files opened in a spreadsheet show meaningless numbers in the Date column, and PDF reports display the same raw timestamps. Users relying on exports for billing or record-keeping would receive incorrect, unreadable data.

## How to Reproduce

1. Log in to the application.
2. Create a client and add work entries with specific dates.
3. Navigate to **Reports**, select the client.
4. Click **Export as CSV** or **Export as PDF**.
5. Open the downloaded file -- the Date column shows a number like `1782259200000` instead of a date.

## Root Cause

The bug originates from a type mismatch in the data pipeline:

### 1. Validation layer converts date strings to Date objects

In `backend/src/validation/schemas.js`:
```js
date: Joi.date().iso().required()
```
Joi's `date().iso()` validator accepts an ISO date string (e.g., `"2026-06-24"`) but **converts it to a JavaScript `Date` object** before passing it to the route handler.

### 2. SQLite stores Date objects as numeric timestamps

When the `Date` object is inserted into SQLite via a parameterized query:
```js
db.run('INSERT INTO work_entries ... VALUES (?, ?, ?, ?, ?)',
  [clientId, req.userEmail, hours, description, date], ...);
```
SQLite has no native `DATE` type. It stores the JavaScript `Date` object as its numeric representation -- a Unix timestamp in milliseconds (e.g., `1782259200000`).

### 3. Frontend handles this correctly; export routes do not

The frontend UI formats dates properly using `new Date(entry.date).toLocaleDateString()`, so the bug is invisible in the browser. However, the CSV and PDF export routes in `backend/src/routes/reports.js` write `entry.date` directly to the output without any formatting:

**CSV export (line ~124):**
```js
csvWriter.writeRecords(workEntries)  // entry.date is a raw number
```

**PDF export (line ~227):**
```js
doc.text(entry.date, 50, doc.y, { width: 100 });  // renders as "1782259200000"
```

## The Fix

Added a `formatDate()` helper function in `backend/src/routes/reports.js` that converts the numeric timestamp back to a `YYYY-MM-DD` string:

```js
function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    return String(dateValue);
  }
  return date.toISOString().split('T')[0];
}
```

Applied this formatting in both export routes:

- **CSV export**: Map work entries through `formatDate()` before writing to CSV.
- **PDF export**: Wrap `entry.date` with `formatDate()` when rendering to PDF.

## Before vs. After

### Before (CSV)
```
Date,Hours,Description,Created At
1782259200000,8,Backend API development,2026-06-24 07:17:18
```

### After (CSV)
```
Date,Hours,Description,Created At
2026-06-24,8,Backend API development,2026-06-24 07:21:18
```

### Before (PDF text)
```
Date          Hours   Description
1782259200000   8     Backend API development
```

### After (PDF text)
```
Date          Hours   Description
2026-06-24      8     Backend API development
```

## Files Changed

- `backend/src/routes/reports.js` -- Added `formatDate()` helper; applied it in CSV and PDF export routes.

## Test Results

All 161 existing backend tests continue to pass after the fix.

## Other Bugs Observed During Exploration

While exploring the application, the following additional issues were noted (not fixed in this PR):

1. **MUI Grid deprecation warnings**: Console shows warnings about removed `item`, `xs`, `sm`, `md` props on MUI Grid v2.
2. **MUI Select out-of-range value warning**: The Reports page Select component initializes with value `0`, which triggers MUI warnings.
3. **MUI Tooltip on disabled button**: Disabled export buttons wrapped in Tooltip produce console warnings about event listeners.
