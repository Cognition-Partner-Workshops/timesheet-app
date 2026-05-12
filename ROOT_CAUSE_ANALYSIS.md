# Root Cause Analysis: Missing SQLite Foreign Key Enforcement

## Bug Summary

Deleting a client does **not** cascade-delete its associated work entries, causing orphaned rows in the `work_entries` table and silent data loss from the user's perspective.

## Symptoms

1. User creates a client and logs work entries against it.
2. User deletes the client.
3. Work entries **disappear** from the UI (Work Entries page, Dashboard, Reports).
4. The work entry data still exists in the database but is invisible because the `INNER JOIN` with the now-deleted client filters them out.
5. Orphaned rows accumulate in the database over time.

## Before Fix

**Work entries visible before client deletion:**

![Before: work entries visible](https://app.devin.ai/attachments/2a63a235-03ea-47ff-a889-9582cc127257/before_bug_work_entries_visible.png)

**After deleting the client — entries silently vanish from the UI while orphaned rows remain in the database:**

![Before fix: entries disappeared](https://app.devin.ai/attachments/fcc9bca7-9fee-48d3-8140-23ad68ac8a33/before_bug_entries_disappeared.png)

## Root Cause

SQLite **disables foreign key constraint enforcement by default**. The schema correctly declares `ON DELETE CASCADE` on the `work_entries.client_id` foreign key:

```sql
FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
```

However, without explicitly enabling the enforcement via `PRAGMA foreign_keys = ON`, SQLite ignores all foreign key constraints — including cascading deletes. This is a well-documented SQLite behavior ([SQLite Foreign Key Support](https://www.sqlite.org/foreignkeys.html#fk_enable)).

The database initialization in `backend/src/database/init.js` never set this pragma, so:
- `ON DELETE CASCADE` was silently ignored.
- Deleting a client row left all its work entries orphaned in the `work_entries` table.
- The application's `INNER JOIN` queries hid these orphaned entries from API responses, making them appear deleted to the user.

### Impact

- **Data integrity violation**: Orphaned `work_entries` rows with references to non-existent `client_id` values.
- **Silent data loss**: Users lose visibility of their time tracking records when they delete a client, with no warning or error.
- **Database pollution**: Over time, orphaned entries accumulate and waste storage.
- **Potential data leakage**: If autoincrement IDs wrap around or a database migration reuses IDs, orphaned entries could reappear under the wrong client.

## Fix Applied

Added `PRAGMA foreign_keys = ON` to the `initializeDatabase()` function in `backend/src/database/init.js`, executed within the `serialize()` block before any table creation:

```javascript
database.serialize(() => {
  // Enable foreign key enforcement (SQLite disables it by default)
  database.run('PRAGMA foreign_keys = ON');

  // Create users table ...
  // Create clients table ...
  // Create work_entries table ...
});
```

This ensures:
1. Foreign key constraints are enforced for the lifetime of the database connection.
2. `ON DELETE CASCADE` works as declared — deleting a client automatically deletes all associated work entries.
3. Inserts with invalid foreign key references are properly rejected.

## After Fix

**After the fix, deleting a client properly cascade-deletes its work entries — no orphaned rows remain:**

![After fix: clean cascade delete](https://app.devin.ai/attachments/1a6a447e-e5b4-4d00-92e1-7250e9cb5470/after_fix_clean_cascade.png)

## Verification

- All 161 existing backend tests pass.
- Manual testing confirms cascade delete works correctly.
- Frontend lint passes cleanly.

## Other Bugs Found During Exploration

| Bug | Severity | Description |
|-----|----------|-------------|
| **Date stored as timestamp** | Medium | Joi's `date().iso()` converts date strings to JS Date objects, which SQLite stores as millisecond timestamps (e.g., `1778544000000`) instead of ISO date strings. Works in practice because the frontend reconstructs dates from timestamps, but semantically wrong and fragile. |
| **CORS misconfiguration in .env** | Low | `.env` sets `FRONTEND_URL=http://localhost:3000` but the Vite dev server runs on port `5173`. Not a problem in development (Vite proxy handles it), but would break direct API access or production builds. |
| **`DELETE /api/clients` (bulk) doesn't clean up work entries** | High | The "Clear All" endpoint relies on the same broken CASCADE. Fixed by this PR (PRAGMA fix covers all delete operations). |
