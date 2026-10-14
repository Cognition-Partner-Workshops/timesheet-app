# Root Cause Analysis — Bug Fixes

## Bug 1: Date Display Off-by-One Error (Critical)

### Symptoms
Work entry dates display as one day earlier than the actual date in certain timezones (e.g., "2024-01-14" shown instead of "2024-01-15").

### Root Cause
The frontend used `new Date(entry.date).toLocaleDateString()` to display dates. When JavaScript parses a date-only string like `"2024-01-15"`, it interprets it as UTC midnight (`2024-01-15T00:00:00Z`). When `toLocaleDateString()` converts this to the user's local timezone (e.g., EST = UTC-5), the result shifts back to `2024-01-14T19:00:00 EST`, displaying as January 14th instead of January 15th.

### Files Affected
- `frontend/src/pages/WorkEntriesPage.tsx` (line 236)
- `frontend/src/pages/ReportsPage.tsx` (line 235)
- `frontend/src/pages/DashboardPage.tsx` (line 132)

### Fix
Display the date string directly (`entry.date`) since the backend stores dates in ISO format (`YYYY-MM-DD`), which is already human-readable and timezone-independent.

### Impact
All users in timezones west of UTC (Americas, Pacific) would see incorrect dates for every work entry.

---

## Bug 2: PDF Report Table Header Misalignment

### Symptoms
When exporting a client report as PDF, the table header columns ("Date", "Hours", "Description") are vertically misaligned — "Hours" and "Description" render 15px above "Date".

### Root Cause
In `backend/src/routes/reports.js`, the PDF table header used hardcoded y-offset adjustments:
```javascript
doc.text('Hours', 150, doc.y - 15, { width: 80 });
doc.text('Description', 230, doc.y - 15, { width: 300 });
```
The `doc.y - 15` was an attempt to align columns on the same row, but `doc.y` changes after each `text()` call, so the offset is applied to a moving target.

### Fix
Capture `doc.y` into a `headerY` variable before rendering any header text, then use `headerY` for all three columns:
```javascript
const headerY = doc.y;
doc.text('Date', 50, headerY, { width: 100 });
doc.text('Hours', 150, headerY, { width: 80 });
doc.text('Description', 230, headerY, { width: 300 });
```

### Impact
Every PDF export had misaligned headers, making the report look unprofessional.

---

## Bug 3: Delete-All Clients Missing Cascade Warning

### Symptoms
The "Clear All" button on the Clients page warns "delete ALL clients" but does not mention that all associated work entries will also be permanently deleted (due to `ON DELETE CASCADE` in the database schema).

### Root Cause
The confirmation dialog message only said: *"Are you sure you want to delete ALL clients? This action cannot be undone."* — failing to warn about the cascading deletion of work entries.

### Fix
Updated the confirmation message to: *"Are you sure you want to delete ALL clients and their associated work entries? This action cannot be undone."*

### Impact
Users could unknowingly lose all their tracked work hours by clicking "Clear All" on the clients page.

---

## Bug 4: MUI Grid API Type Errors Suppressed

### Symptoms
The DashboardPage used `@ts-expect-error` comments to suppress TypeScript errors on MUI Grid components, hiding a real API usage issue.

### Root Cause
The code used the legacy MUI Grid `item` prop API (`<Grid item xs={12} md={4}>`) which is deprecated in MUI v6+. The project uses MUI v6 which requires the `size` prop API.

### Fix
Replaced deprecated `item`/`xs`/`sm`/`md` props with the MUI v6 `size` prop:
```tsx
// Before (deprecated):
<Grid item xs={12} md={4}>

// After (correct MUI v6 API):
<Grid size={{ xs: 12, md: 4 }}>
```

### Impact
TypeScript errors were being silenced, and the Grid layout relied on backward-compatibility behavior that may break in future MUI versions.
