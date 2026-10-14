---
name: add-crud-entity
description: Add a new CRUD entity (backend API + React page + tests) to timesheet-app following the clients/work-entries/projects conventions. Use when asked to add or extend a managed resource.
---

# Add a CRUD entity to timesheet-app

`clients`, `work_entries` and `projects` all follow one shape. Match it. Use
`backend/src/routes/projects.js` and `frontend/src/pages/ProjectsPage.tsx` as
the reference implementations — they are the most recent and the least
duplicated.

## Backend

1. **Table** — `backend/src/database/init.js`, inside the existing
   `database.serialize()` block:
   - `id INTEGER PRIMARY KEY AUTOINCREMENT`, the domain columns,
     `user_email TEXT NOT NULL`, `created_at`/`updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`.
   - `FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE`, plus
     one per referenced entity.
   - Add `CREATE INDEX IF NOT EXISTS` for `user_email` and every foreign key.
2. **Validation** — `backend/src/validation/schemas.js`: a create schema
   (required fields) and an update schema (all optional, terminated by
   `.min(1)`). Export both. Enumerations go in an exported `const` array used
   via `Joi.string().valid(...)`.
3. **Router** — new file in `backend/src/routes/`, `router.use(authenticateUser)`
   at the top, exported with `module.exports = router`. Mount it in
   `server.js` as `app.use('/api/<entity>', <entity>Routes)`.
4. **Rules that apply to every handler**
   - Scope **every** query by `user_email` — this is the only tenancy boundary.
   - `parseInt` the `:id`; on `NaN` return `400 { error: 'Invalid X ID' }`.
   - Check existence + ownership before update/delete; `404` if absent.
   - Verify referenced entities belong to the caller before insert/update;
     `400 { error: 'Client not found or does not belong to user' }`.
   - Joi failures: `return next(error)` — the shared errorHandler renders 400.
   - DB failures: log and return 500 with a specific message
     (`'Failed to create X'`, `'X created but failed to retrieve'`).
   - Respond with wrapped objects: `{ xs: [...] }`, `{ x: {...} }`,
     `{ message, x }`. Re-`SELECT` after write so the response includes joined
     columns and DB defaults.
   - `Joi.date()` yields a `Date`, not a string. Normalise before insert
     (`new Date(d).toISOString().split('T')[0]`) or the DATE column stores
     epoch milliseconds.

## Frontend

1. `frontend/src/types/api.ts` — entity interface (snake_case, mirroring the SQL
   columns) plus `Create<X>Request` / `Update<X>Request` (camelCase, mirroring
   the Joi schemas).
2. `frontend/src/api/client.ts` — `get<Xs>`, `get<X>`, `create<X>`, `update<X>`,
   `delete<X>` methods on `ApiClient`.
3. `frontend/src/pages/<X>Page.tsx` — `useQuery` for the list, three
   `useMutation`s invalidating the query key, MUI `Table` + `Dialog` form driven
   by a single `formData` object, `CircularProgress` while loading, `Alert` for
   errors, `window.confirm` before delete.
4. Register the route in `App.tsx` and the nav item in `components/Layout.tsx`.

**Every `<Select>` must get both `labelId` and `label`.** Without `label` the
outlined input renders a zero-width notch and the border strikes through the
floating label (fixed once in #891 — do not reintroduce it).

## Tests

Mirror `backend/src/__tests__/routes/clients.test.js`: `jest.mock` both
`database/init` and `middleware/auth`, mount the router on a bare express app
with the Joi error handler, and cover per endpoint — happy path, each
validation failure, invalid id, 404/400 ownership, and **every** DB error
branch (the coverage gate is 80%).

## Avoid duplication

SonarCloud fails the PR at >3% duplicated new code, and copying an existing
route file wholesale will trip it. Extract helpers instead — `projects.js`
demonstrates `parseId`, `handleDbError`, `withOwned<Entity>`, `send<Entity>` and
an `UPDATABLE_COLUMNS` map that replaces the dynamic-update if-chain.

## Before opening the PR

```bash
(cd backend && npm test)
(cd frontend && npm run lint && npm run build)
```
