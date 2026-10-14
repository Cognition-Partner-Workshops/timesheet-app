# Root Cause Analysis: Date Storage & Foreign Key Cascade Bugs

## Bug Summary

Two critical data integrity bugs were discovered during exploratory testing of the timesheet application:

1. **Work entry dates stored as Unix timestamps instead of date strings** (Primary)
2. **SQLite foreign key constraints not enforced, causing silent data loss on client deletion** (Secondary)

---

## Bug 1: Date Stored as Timestamp (Primary Fix)

### Symptoms

- The API returns dates as Unix timestamps (e.g. `1768435200000`) instead of ISO date strings (e.g. `"2026-01-15"`)
- Users in timezones west of UTC see dates shifted back by one day (e.g. January 15 displays as January 14)

### Root Cause

In `backend/src/validation/schemas.js`, the Joi validation schema for work entries used:

```javascript
date: Joi.date().iso().required()
```

`Joi.date().iso()` validates that the input is an ISO date string, but also **converts** the value from a string to a JavaScript `Date` object. When this `Date` object is passed to SQLite via the parameterized INSERT query, SQLite stores it as its numeric representation (Unix timestamp in milliseconds).

**Chain of events:**
1. Frontend sends `"date": "2026-01-15"` (correct ISO date string)
2. Joi validates and converts to `new Date("2026-01-15")` = `Date(2026-01-15T00:00:00.000Z)`
3. SQLite receives a `Date` object and stores it as `1768435200000` (milliseconds since epoch)
4. API returns `"date": 1768435200000` to the frontend
5. Frontend creates `new Date(1768435200000)` which is `2026-01-15T00:00:00.000Z` (UTC midnight)
6. In timezones west of UTC (EST, PST, etc.), `toLocaleDateString()` renders this as **January 14** instead of January 15

### Impact

- **Every work entry** in the system had its date stored incorrectly
- Users in western hemisphere timezones (Americas) saw dates shifted back by one day
- Date-based sorting in reports used numeric timestamp comparison instead of string comparison
- API responses returned unintuitive timestamp numbers instead of human-readable dates

### Fix

Changed the Joi schema from `Joi.date().iso()` to `Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`, which validates the date format but preserves the value as a string. This ensures SQLite stores the date as a proper `TEXT` value (`"2026-01-15"`), which is timezone-safe for display.

**Before (broken):**
```javascript
date: Joi.date().iso().required()
```

**After (fixed):**
```javascript
date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
    .messages({ 'string.pattern.base': '"date" must be a valid date in YYYY-MM-DD format' })
```

### Verification

```
# Before fix - API returns timestamp:
{"date": 1768435200000}

# After fix - API returns date string:
{"date": "2026-01-15"}
```

---

## Bug 2: Foreign Key CASCADE Not Enforced (Secondary Fix)

### Symptoms

- Deleting a client leaves orphaned work entries in the database
- Orphaned work entries become invisible (hidden by JOIN queries) but still exist
- Dashboard total hours silently decrease when a client is deleted, even though the work was performed
- No error or warning is shown to the user about lost data

### Root Cause

The database schema in `backend/src/database/init.js` correctly defines foreign key constraints with `ON DELETE CASCADE`:

```sql
FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
```

However, **SQLite does not enforce foreign keys by default**. The `PRAGMA foreign_keys` setting defaults to `OFF`, making all `FOREIGN KEY` and `ON DELETE CASCADE` clauses decorative only.

### Impact

- **Silent data loss**: When a user deletes a client, the associated work entries remain in the database but become invisible to all queries (which use `JOIN clients`). The user permanently loses visibility into those tracked hours.
- **Data integrity violation**: Work entries can reference non-existent clients, creating orphaned records that consume storage and could cause issues if foreign keys were later enabled.
- **Incorrect totals**: The dashboard's "Total Hours" and "Total Work Entries" counts silently decrease after client deletion, misrepresenting the user's actual tracked work.

### Reproduction

1. Create a client "Beta Industries"
2. Add a work entry for 4.5 hours to "Beta Industries"
3. Dashboard shows Total Hours: 9.50 (including other entries)
4. Delete "Beta Industries"
5. Dashboard now shows Total Hours: 5.00 -- the 4.5 hours are silently lost

### Fix

Added `PRAGMA foreign_keys = ON` in the database initialization before table creation:

```javascript
database.serialize(() => {
    // Enable foreign key constraints
    database.run('PRAGMA foreign_keys = ON');

    // Create users table...
```

Now when a client is deleted, SQLite properly cascades the delete to associated work entries, preventing orphaned records.

---

## Other Bugs Found (Not Fixed)

During testing, the following additional issues were noted but not addressed in this fix:

1. **Vite proxy doesn't forward `/health` endpoint**: The Vite dev server proxy only proxies `/api` routes, so the frontend's `healthCheck()` method fails in development.

2. **Rate limiter too aggressive for development**: The rate limit of 100 requests per 15 minutes can be hit during active frontend development with hot reloading.

3. **"Delete All Clients" doesn't invalidate work entries query cache**: After bulk-deleting all clients via the "Clear All" button, the TanStack Query cache for work entries is not invalidated, potentially showing stale data until manual refresh.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/validation/schemas.js` | Changed `Joi.date().iso()` to `Joi.string().pattern()` for date fields in both `workEntrySchema` and `updateWorkEntrySchema` |
| `backend/src/database/init.js` | Added `PRAGMA foreign_keys = ON` in `initializeDatabase()` |
