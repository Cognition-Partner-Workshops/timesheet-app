# Root Cause Analysis: Raw Timestamps in Report Exports

## Bug Summary

The CSV and PDF export features on the Reports page display raw Unix timestamps (e.g., `1782259200000`) in the Date column instead of human-readable dates (e.g., `2026-06-24`).

## Impact

- **Severity**: High
- **Affected Features**: CSV export, PDF export (Reports page)
- **User Impact**: Exported reports are unusable for clients or accounting purposes since dates appear as meaningless 13-digit numbers. Users relying on exported data for billing, invoicing, or record-keeping would receive incorrect/unreadable documents.

## Root Cause

The bug stems from a type mismatch in the data pipeline between validation, storage, and export:

1. **Frontend** sends dates as ISO strings (e.g., `"2026-06-24"`) via `formData.date.toISOString().split('T')[0]`.

2. **Backend validation** (`validation/schemas.js`) uses `Joi.date().iso()` which **converts** the ISO date string into a JavaScript `Date` object.

3. **Database insertion** (`workEntries.js`) passes this `Date` object directly to the SQLite `INSERT` statement. Since SQLite has no native Date type and the node-sqlite3 driver coerces `Date` objects to their numeric value, the database stores the date as a Unix timestamp in milliseconds (e.g., `1782259200000`).

4. **Frontend display** handles this correctly by wrapping the value in `new Date(entry.date).toLocaleDateString()`, which converts the timestamp back to a readable date.

5. **Export code** (`routes/reports.js`) writes `entry.date` directly to CSV and PDF **without any formatting**, outputting the raw numeric timestamp.

### Data Flow Diagram

```
Frontend: "2026-06-24" (ISO string)
    |
    v
Joi.date().iso(): Date object (Tue Jun 24 2026 00:00:00 GMT+0000)
    |
    v
SQLite INSERT: 1782259200000 (Date.getTime() coercion)
    |
    v
SELECT query: 1782259200000 (raw number)
    |
    +---> Frontend: new Date(1782259200000).toLocaleDateString() => "6/24/2026" (correct)
    |
    +---> CSV/PDF export: entry.date => "1782259200000" (BUG - raw timestamp)
```

## Fix Applied

Added a `formatDate()` helper function in `backend/src/routes/reports.js` that converts Unix timestamps back to `YYYY-MM-DD` format before writing to CSV and PDF exports:

```javascript
function formatDate(dateValue) {
  if (!dateValue) return '';
  const d = new Date(typeof dateValue === 'number' ? dateValue : dateValue);
  if (isNaN(d.getTime())) return String(dateValue);
  return d.toISOString().split('T')[0];
}
```

Applied in two places:
- **CSV export**: Maps work entries through `formatDate()` before writing records
- **PDF export**: Wraps `entry.date` with `formatDate()` when rendering text

## Why This Approach

- **Minimal change**: Only modifies the export route, not the validation or storage layer
- **Backward compatible**: Existing data in the database remains valid
- **Defensive**: Handles both numeric timestamps and potential string dates gracefully
- **No frontend changes needed**: The frontend already handles the timestamp format correctly

## Before / After

### Before (Bug)
- CSV output: `1782259200000,8,Frontend development work,2026-06-24 14:00:23`
- PDF shows: `1782259200000` in the Date column

### After (Fix)
- CSV output: `2026-06-24,8,Frontend development work,2026-06-24 14:06:35`
- PDF shows: `2026-06-24` in the Date column

## Preventive Recommendations

1. **Store dates as ISO strings**: Change `Joi.date().iso()` to `Joi.string().isoDate()` to preserve the string format through to SQLite, avoiding the type coercion entirely.
2. **Add integration tests for exports**: Validate that exported CSV/PDF files contain properly formatted dates.
3. **Add a date formatting utility**: Centralize date formatting logic to avoid inconsistencies across different parts of the application.
