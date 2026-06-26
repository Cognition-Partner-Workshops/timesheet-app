# Root Cause Analysis: Orphaned Work Entries After Client Deletion

## Bug Summary

When a client is deleted, their associated work entries are **not deleted** from the database. The work entries become orphaned: invisible in the UI but still present in the database. This causes silent data loss from the user's perspective -- hours and entries they previously tracked simply vanish without explanation.

## Symptoms

1. **Dashboard totals drop unexpectedly** -- After deleting a client, "Total Work Entries" and "Total Hours" decrease without the user explicitly deleting any work entries.
2. **Work entries silently disappear** -- Entries that were visible before the client deletion are no longer shown anywhere in the UI.
3. **Data integrity violation** -- Orphaned `work_entries` rows reference a `client_id` that no longer exists in the `clients` table.

### Reproduction Steps

1. Create two clients (e.g., "Acme Corporation" and "Beta Inc")
2. Add work entries for both clients (e.g., 3 entries / 18.5h for Acme, 2 entries / 8h for Beta)
3. Observe dashboard: 5 entries, 26.50 total hours
4. Delete "Beta Inc" from the Clients page
5. Return to dashboard: now shows 3 entries, 18.50 total hours
6. The 2 work entries (8 hours) for Beta Inc have vanished

## Root Cause

The database schema in `backend/src/database/init.js` correctly defines `ON DELETE CASCADE` foreign key constraints:

```sql
CREATE TABLE IF NOT EXISTS work_entries (
  ...
  FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
  ...
)
```

However, **SQLite does not enforce foreign key constraints by default**. Foreign key support must be explicitly enabled per-connection with:

```sql
PRAGMA foreign_keys = ON;
```

Without this pragma, the `ON DELETE CASCADE` clause is parsed but never executed. When a client row is deleted, SQLite does not cascade the delete to the `work_entries` table. The work entry rows remain in the database with a now-invalid `client_id`.

The entries then become invisible because the work entries API query uses an `INNER JOIN`:

```sql
SELECT we.*, c.name as client_name
FROM work_entries we
JOIN clients c ON we.client_id = c.id
WHERE we.user_email = ?
```

Since the referenced client no longer exists, the `INNER JOIN` excludes the orphaned rows from results. The data is still in the database but completely inaccessible through any API endpoint.

## Impact

- **Data integrity**: Orphaned rows accumulate in `work_entries` over time
- **Incorrect reporting**: Dashboard totals and reports silently become inaccurate after any client deletion
- **User confusion**: Users see their tracked hours disappear with no error message or explanation
- **No recovery path**: The orphaned entries cannot be viewed, edited, or deleted through any UI or API action

## Fix

Added `PRAGMA foreign_keys = ON` at the start of `initializeDatabase()` in `backend/src/database/init.js`, before any table creation statements:

```js
database.serialize(() => {
  // Enable foreign key enforcement (SQLite has this OFF by default)
  database.run('PRAGMA foreign_keys = ON');

  // Create users table
  // ...
});
```

This single line enables SQLite's foreign key enforcement for the database connection, making the existing `ON DELETE CASCADE` constraints work as intended. When a client is deleted, all associated work entries are now properly cascade-deleted in the same transaction.

## Verification

**Before fix:**
- Create 2 clients with 5 total work entries (26.50 hours)
- Delete one client
- Result: 3 work entries visible (18.50 hours), but 2 orphaned entries remain in database

**After fix:**
- Same scenario
- Delete one client
- Result: 3 work entries (18.50 hours), orphaned entries are properly cascade-deleted
- Attempting to fetch the deleted entries by ID returns "Work entry not found" (truly deleted, not just hidden)

## Other Bugs Noted During Exploration

1. **Date stored as epoch milliseconds**: Joi's `Joi.date().iso()` converts date strings to JavaScript Date objects, which SQLite stores as epoch milliseconds (e.g., `1781913600000` instead of `"2026-06-20"`). This works for display but complicates direct database queries and CSV exports.

2. **CORS origin mismatch in `.env.example`**: The backend `.env.example` sets `FRONTEND_URL=http://localhost:3000` but the Vite frontend runs on port 5173. The Vite proxy mitigates this for API calls, but the mismatch could cause issues for direct browser-to-backend requests.
