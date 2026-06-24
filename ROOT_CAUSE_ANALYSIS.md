# Root Cause Analysis: CSV/PDF Export Date Formatting Bug

## Bug Summary

**Severity:** High  
**Impact:** CSV and PDF report exports display raw epoch timestamps (milliseconds since Unix epoch) instead of human-readable dates, making exported reports unusable for business purposes.

**Example:**  
- **Before (broken):** `1782259200000` in the Date column  
- **After (fixed):** `6/24/2026` in the Date column

## Symptoms

When exporting a client's time report as CSV or PDF from the Reports page:
- The **Date** column shows values like `1782259200000` instead of formatted dates like `6/24/2026`
- The **Created At** column in CSV showed raw ISO timestamps without locale formatting
- The PDF export similarly displayed raw epoch values for work entry dates

The in-app Reports page displayed dates correctly because the frontend applied `new Date(entry.date).toLocaleDateString()` formatting.

## Root Cause

The bug spans two layers:

### 1. Joi Validation Converts Date Strings to Date Objects

In `backend/src/validation/schemas.js`, the work entry validation schema uses:
```javascript
date: Joi.date().iso().required()
```

`Joi.date().iso()` accepts an ISO date string (e.g., `"2026-06-24"`) but **converts it into a JavaScript `Date` object** during validation. The validated `value.date` passed to the database INSERT is a Date object, not a string.

### 2. SQLite Stores Date Objects as Epoch Milliseconds

When a JavaScript `Date` object is passed as a parameter to SQLite's parameterized queries:
```javascript
db.run('INSERT INTO work_entries (..., date) VALUES (..., ?)', [..., date], ...)
```

The `sqlite3` Node.js driver serializes the Date object to its numeric representation (epoch milliseconds). So the `date` column in SQLite stores values like `1782259200000`.

### 3. Export Routes Write Raw Database Values Without Formatting

In `backend/src/routes/reports.js`:
- The CSV export passed `workEntries` directly to `csvWriter.writeRecords()` without formatting
- The PDF export wrote `entry.date` directly into the PDF document

Since the database returns the raw epoch millisecond value, the exports produced unreadable numbers.

The frontend Report page did not have this bug because it applied `new Date(entry.date).toLocaleDateString()` before rendering (line 235 of `ReportsPage.tsx`).

## Fix Applied

**File:** `backend/src/routes/reports.js`

### CSV Export Fix
Added date formatting before writing CSV records:
```javascript
const formattedEntries = workEntries.map(entry => ({
  ...entry,
  date: new Date(entry.date).toLocaleDateString('en-US'),
  created_at: entry.created_at ? new Date(entry.created_at).toLocaleString('en-US') : ''
}));

csvWriter.writeRecords(formattedEntries)
```

### PDF Export Fix
Format the date before writing to the PDF document:
```javascript
const formattedDate = new Date(entry.date).toLocaleDateString('en-US');
doc.text(formattedDate, 50, doc.y, { width: 100 });
```

## Verification

- All 161 existing backend tests continue to pass
- CSV export now shows `6/24/2026` instead of `1782259200000`
- PDF export now shows formatted dates
- Frontend report display remains unaffected (was already correct)

## Prevention

To prevent similar issues in the future:
1. Add integration tests for CSV/PDF export content validation
2. Consider storing dates as ISO strings in SQLite rather than relying on Joi's Date object conversion
3. Alternatively, add a shared date formatting utility used by both frontend and backend export logic
