# Root Cause Analysis: Orphaned Work Entries on Client Deletion

## Bug Summary

When a client is deleted, its associated work entries are **not** cascade-deleted from the database. The work entries become orphaned — invisible to the user through the UI and API but still occupying space in the database. This results in silent data loss from the user's perspective: logged hours simply vanish with no warning or recovery path.

## Symptoms

1. User creates a client and logs work entries against it
2. User deletes the client (single delete or "Clear All")
3. Work entries page shows no entries (appears as if time tracking data was lost)
4. Dashboard shows 0 total hours (previously tracked hours silently disappear)
5. Orphaned work entry rows remain in the database but are completely inaccessible

## Root Cause

**SQLite does not enforce foreign key constraints by default.** The `PRAGMA foreign_keys` setting defaults to `OFF` in SQLite. Without explicitly enabling it, the `ON DELETE CASCADE` clause in the schema definition is completely ignored.

The `work_entries` table is defined with:
```sql
FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
```

However, in `backend/src/database/init.js`, the database connection was created without ever running:
```sql
PRAGMA foreign_keys = ON;
```

This means the CASCADE constraint was declared but never enforced. When a client is deleted, SQLite simply removes the client row and leaves all referencing work_entries rows intact.

## Why the Bug Was Hidden

The work entries API queries all use `INNER JOIN clients c ON we.client_id = c.id`. When a client is deleted, the JOIN condition fails for orphaned entries, so they are filtered out of all query results. The data appears to be gone from the user's perspective, but the rows still exist in the `work_entries` table.

This creates a particularly insidious pattern:
- `GET /api/work-entries` returns empty (INNER JOIN hides orphans)
- `GET /api/work-entries/:id` returns 404 (INNER JOIN hides orphans)
- `DELETE /api/work-entries/:id` returns 200 (uses a query without JOIN, proving the row exists)

## Impact

- **Data Integrity**: Work entries become permanently inaccessible through normal operations
- **Silent Data Loss**: Users lose all time tracking records for a deleted client with no warning
- **Database Bloat**: Orphaned rows accumulate over time with no cleanup mechanism
- **Incorrect Reporting**: Total hours and work entry counts become inaccurate after any client deletion
- **Affects "Clear All" feature**: The bulk delete on the Clients page orphans ALL work entries at once

## Fix

Added `PRAGMA foreign_keys = ON` in two locations in `backend/src/database/init.js`:

1. **In `getDatabase()`** — Immediately after creating a new database connection, ensuring foreign keys are always enforced regardless of how the database is accessed.

2. **In `initializeDatabase()`** — As the first statement in the serialized block, ensuring foreign keys are active before any table creation or subsequent operations.

This ensures that SQLite properly enforces all foreign key constraints, including `ON DELETE CASCADE`, so deleting a client now correctly removes all associated work entries.

## Verification

**Before fix:**
```
POST /api/clients          → Creates client (id=1)
POST /api/work-entries     → Creates entry (id=1, client_id=1)
DELETE /api/clients/1      → "Client deleted successfully"
GET /api/work-entries      → {"workEntries": []}        ← appears empty
DELETE /api/work-entries/1 → "Work entry deleted successfully" ← ORPHAN EXISTS!
```

**After fix:**
```
POST /api/clients          → Creates client (id=1)
POST /api/work-entries     → Creates entry (id=1, client_id=1)
DELETE /api/clients/1      → "Client deleted successfully"
GET /api/work-entries      → {"workEntries": []}        ← truly empty
DELETE /api/work-entries/1 → "Work entry not found"     ← CASCADE worked!
```

## Lessons Learned

- SQLite's foreign key support is opt-in per-connection; always enable it explicitly
- INNER JOINs can mask data integrity issues by hiding orphaned records
- Schema declarations alone (like `ON DELETE CASCADE`) are not sufficient without runtime enforcement
- Testing should verify both the visible API response AND the underlying database state
