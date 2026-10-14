# Root Cause Analysis: Silent Data Loss on Client Deletion

## Bug Summary

Deleting a client causes its associated work entries to become permanently invisible to the user. The work entry data remains in the database as orphaned rows but is inaccessible through any API endpoint or UI view. This results in **silent data loss** -- hours tracked against a deleted client simply vanish from the dashboard, work entries list, and reports without any warning.

## Impact

- **Severity**: High
- **Affected features**: Dashboard totals, Work Entries listing, Reports
- **Data loss**: Work entry hours silently disappear when their parent client is deleted
- **User experience**: Users lose tracked billable hours with no indication that data was lost

### Reproduction Steps

1. Create a client (e.g., "TechStart Inc")
2. Log 4.5 hours of work against that client
3. Verify the dashboard shows 3 total entries and 15.50 total hours
4. Delete the "TechStart Inc" client
5. **Observed**: Dashboard now shows 2 entries and 11.00 hours -- the 4.5-hour entry silently vanished
6. **Expected**: Either the work entries should be cascade-deleted (clean removal) or the user should be warned about associated data

## Root Cause

The database schema in `backend/src/database/init.js` correctly declares `ON DELETE CASCADE` foreign key constraints:

```sql
CREATE TABLE work_entries (
  ...
  FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
);
```

However, **SQLite does not enforce foreign key constraints by default**. Foreign key support must be explicitly enabled per-connection by running:

```sql
PRAGMA foreign_keys = ON;
```

Without this pragma, the `ON DELETE CASCADE` clause is parsed but never enforced. When a client row is deleted:

1. The client row is removed from the `clients` table
2. The associated `work_entries` rows are **not** cascade-deleted (FK enforcement is off)
3. The orphaned work entries remain in `work_entries` with a `client_id` pointing to a non-existent client
4. All API queries use `INNER JOIN clients c ON we.client_id = c.id`, which excludes orphaned rows from results
5. The work entries become permanently invisible but still occupy database storage

## Fix

Added `PRAGMA foreign_keys = ON` at the start of `initializeDatabase()` in `backend/src/database/init.js`, before any table creation:

```js
database.serialize(() => {
  // Enable foreign key enforcement (OFF by default in SQLite)
  database.run('PRAGMA foreign_keys = ON');

  // Create users table ...
```

This single line ensures that:
- `ON DELETE CASCADE` is enforced: deleting a client now properly removes all associated work entries
- Foreign key integrity is maintained: inserting a work entry with a non-existent `client_id` will be rejected
- No orphaned data can accumulate in the database

## Verification

- All 161 existing backend tests continue to pass
- Manual testing confirms that deleting a client now properly cascade-deletes its work entries
- Dashboard totals remain consistent after client deletion

## Before / After

### Before Fix (Bug)
- Dashboard shows 2 clients, 3 work entries, 15.50 total hours
- Delete "TechStart Inc" client
- Dashboard drops to 2 work entries, 11.00 hours -- **4.5 hours silently lost**
- The orphaned work entry row still exists in the database but is invisible

### After Fix
- Same starting state: 2 clients, 3 work entries, 15.50 total hours
- Delete "TechStart Inc" client
- Dashboard shows 2 work entries, 11.00 hours -- the TechStart entry was properly cascade-deleted
- No orphaned rows remain in the database
- Data integrity is maintained

## Other Bugs Found During Exploration

1. **`.env.example` CORS mismatch**: The backend `.env.example` sets `FRONTEND_URL=http://localhost:3000` but the frontend runs on port 5173. New developers following setup instructions would get CORS errors.

2. **Date stored as epoch timestamp**: The Joi `date().iso()` validator converts date strings to JavaScript `Date` objects, which SQLite stores as millisecond timestamps (e.g., `1782259200000` instead of `2026-06-24`). While this works, it deviates from the `DATE` column type intention and could cause timezone-related display issues in negative-UTC-offset timezones where `new Date(timestamp).toLocaleDateString()` shows the previous day.
