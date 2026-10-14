---
name: testing-timesheet-app
description: How to run and end-to-end test the timesheet-app (Express + in-memory SQLite backend, React/Vite/MUI frontend) locally, including login, validation limits, exports, and known gotchas.
---

# Testing timesheet-app locally

## Services
- Node 20. Backend: `cd backend && npm ci && npm start` → http://localhost:3001 (Express, **in-memory SQLite**, all data is lost on restart).
- Frontend: `cd frontend && npm ci && npm run dev` → http://localhost:5173 (Vite proxies `/api` → `localhost:3001`, see `frontend/vite.config.ts`).
- There is no `/api/health` route; verify the backend by hitting `/api/clients` or watching `npm start` output.

## Auth
- Passwordless: any email logs in and lazily creates the user (`LoginPage.tsx` → `POST /api/auth/login`). Identity is sent via `x-user-email` header (`frontend/src/api/client.ts`).
- Data is scoped per user, so testing isolation just means logging out (header LOGOUT button) and logging in with a second email.

## Validation limits (backend/src/validation/schemas.js)
- Client `email` is validated by Joi's default email rule, which **rejects fake TLDs like `.test`/`.local`** with "Validation error". Use a real-looking TLD such as `@acme.com` in tests.
- Work entry `hours`: positive, max 24 (24 is accepted, 25 and 0 are rejected — rejected client-side with "Hours must be between 0 and 24").
- `description`: max 1000 chars (1000 accepted, 1001+ rejected with a server "Validation error" banner).
- Client-side hour errors show inline in the dialog; server errors show as a red alert on the page behind the dialog.

## UI gotchas
- Long descriptions make the Work Entries table horizontally scrollable, pushing the Actions (edit/delete) column offscreen — scroll the table right before clicking delete.
- Deleting entries/clients uses a native `window.confirm` dialog; accept it by clicking OK.
- Deleting a client cascade-deletes its work entries.
- Typing very long strings with xdotool drops characters; verify the actual field length (e.g. from the DOM dump) before asserting a >N-char boundary.

## Exports
- Reports page: select a client, then the blue CSV icon and red PDF icon (aria-labels "Export as CSV" / "Export as PDF"). Files land in `~/Downloads` as `<Client_Name>_report_<YYYY-MM-DD>.{csv,pdf}`.
- CSV header is `Date,Hours,Description,Created At`. PDF starts with `%PDF-1.3`.
- Known app bug (present on `main` too): the Date column in both CSV and PDF exports renders a raw epoch millisecond value (e.g. `1786320000000`) instead of a formatted date. The UI tables format dates correctly.

## Backend test suite
- `cd backend && npm run test:coverage` (there is no `npm test coverage` script). Expect all suites green with ~99.8% statement coverage.

## Devin Secrets Needed
- None; everything runs locally with no credentials.
