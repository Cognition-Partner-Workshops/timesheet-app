---
name: run-timesheet-app-locally
description: Start the timesheet-app backend and frontend, log in, and seed data so pages are usable. Use before any manual or browser-based verification of the app.
---

# Run timesheet-app locally

Most pages are empty and unusable until a client exists, and login is email-only
(no password). Follow these steps before verifying anything in the browser.

## 1. Start both servers

Run each in its own persistent shell, from the repo root:

```bash
(cd backend && npm start)     # http://localhost:3001
(cd frontend && npm run dev)  # http://localhost:5173, proxies /api to :3001
```

Notes:
- The backend uses an **in-memory SQLite database** — all data is lost on
  restart. Re-seed after every backend restart.
- Vite prints `Node.js 20.19+ required` on the standard snapshot. It is a
  warning only; the dev server works.
- Start the backend with `setsid ... &` (or a persistent `tty: true` shell) so
  it survives the one-shot command that launched it.

Confirm both are up:

```bash
curl -s localhost:3001/health
curl -s -o /dev/null -w '%{http_code}\n' localhost:5173
```

## 2. Seed data via the API

Auth is the `x-user-email` header; the user row is created on first use, so any
address works. Use the same address you later log in with.

```bash
EMAIL=demo@example.com

curl -s -X POST localhost:3001/api/clients \
  -H 'Content-Type: application/json' -H "x-user-email: $EMAIL" \
  -d '{"name":"Acme Corp","email":"acme@example.com"}'

curl -s -X POST localhost:3001/api/projects \
  -H 'Content-Type: application/json' -H "x-user-email: $EMAIL" \
  -d '{"name":"Website Redesign","clientId":1,"startDate":"2026-03-01","status":"on-hold"}'

curl -s -X POST localhost:3001/api/work-entries \
  -H 'Content-Type: application/json' -H "x-user-email: $EMAIL" \
  -d '{"clientId":1,"hours":3.5,"description":"Discovery","date":"2026-03-02"}'
```

Without at least one client, `/work-entries` and `/projects` render only a
"You need to create at least one client" placeholder.

## 3. Log in

Navigate to `http://localhost:5173`, type the same email into the single
`Email Address` field and submit. The app stores it in `localStorage.userEmail`
and the axios interceptor sends it as `x-user-email` on every request.

To skip the form, set the key directly and reload:

```js
localStorage.setItem('userEmail', 'demo@example.com');
```

## Routes

`/login`, `/dashboard`, `/clients`, `/projects`, `/work-entries`, `/reports`.
Anything unmatched redirects to `/dashboard`; unauthenticated users redirect to
`/login`.
