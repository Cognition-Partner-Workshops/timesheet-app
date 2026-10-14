# Root Cause Analysis: Raw Timestamps in CSV and PDF Exports

## Bug Summary

When exporting client time reports as CSV or PDF, the **Date column displays raw Unix timestamps** (e.g., `1782432000000`) instead of human-readable dates (e.g., `2026-06-26`). This affects all exported reports, making them unusable for sharing with clients or management.

## Impact

- **Severity:** High
- **Affected features:** CSV export, PDF export (Reports page)
- **User impact:** Exported reports contain unreadable date values, rendering them useless for billing, invoicing, or client-facing deliverables

### Before (bug)

CSV output:
```
Date,Hours,Description,Created At
1782432000000,8,Frontend development work,2026-06-26 10:14:02
```

PDF output also displayed `1782432000000` in the Date column.

### After (fix)

CSV output:
```
Date,Hours,Description,Created At
2026-06-26,8,Frontend development work,2026-06-26 10:21:30
```

PDF output now displays `2026-06-26` in the Date column.

## Root Cause

The bug stems from a **type conversion mismatch** between the Joi validation layer and the SQLite storage layer.

### Data Flow (showing where the bug occurs)

```
Frontend                    Backend Validation         SQLite Storage          Export Route
────────                    ──────────────────         ──────────────          ────────────
"2026-06-26"  ──POST──>  Joi.date().iso()          INSERT INTO ...          SELECT date FROM ...
(ISO string)              converts to JS Date       stores as numeric        reads raw value
                          object internally    ──>  timestamp: 1782432000000  ──> outputs 1782432000000
                                                                                 directly to CSV/PDF
```

1. **Frontend sends an ISO date string:** `formData.date.toISOString().split('T')[0]` produces `"2026-06-26"` (`WorkEntriesPage.tsx:160`)

2. **Joi validation converts it to a Date object:** The schema `date: Joi.date().iso()` parses the ISO string and returns a JavaScript `Date` object (`validation/schemas.js:14`)

3. **SQLite stores it as a numeric timestamp:** When the `Date` object is passed to the SQLite `INSERT` statement via parameterized query, SQLite stores it as the numeric value `1782432000000` (milliseconds since epoch)

4. **Export routes read and output the raw value:** Both the CSV export (`reports.js:124`) and PDF export (`reports.js:227`) read `entry.date` from the database and write it directly to the output without any formatting

### Why the UI displays correctly

The frontend pages handle this correctly by wrapping dates in `new Date(entry.date).toLocaleDateString()` (e.g., `WorkEntriesPage.tsx:236`, `ReportsPage.tsx:235`), which converts the numeric timestamp back to a readable date. The export routes lacked this conversion.

## Fix

Added a `formatDate()` helper function in `backend/src/routes/reports.js` that converts the raw database value to an ISO date string (`YYYY-MM-DD`):

```javascript
function formatDate(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toISOString().split('T')[0];
}
```

Applied in two places:
- **CSV export:** Work entries are mapped through `formatDate()` before being written by csv-writer
- **PDF export:** `formatDate(entry.date)` is called when writing each row to the PDF document

## Verification

- All 161 existing backend tests pass (8 test suites)
- Manual testing confirmed CSV now shows `2026-06-26` instead of `1782432000000`
- Manual testing confirmed PDF now shows `2026-06-26` instead of `1782432000000`
- No regressions in the UI display or other functionality

## Other Bugs Observed During Exploration

While exploring the application, the following additional issues were noted (not fixed in this PR):

1. **README claims JWT authentication** but the actual implementation uses simple `x-user-email` header-based auth with no tokens or passwords
2. **No data isolation between users** - the README mentions "No user roles" as a known limitation, but users can potentially see other users' data depending on how the email header is trusted
3. **`.env.example` has wrong default** for `FRONTEND_URL` (`http://localhost:3000` instead of `http://localhost:5173` which is the Vite default)
