# timesheet-app E2E tests (Playwright)

End-to-end tests that drive the real frontend + backend in Chromium.

Covered: `tests/work-entries.spec.ts` — log in, create a work entry, verify it in the list, edit it, delete it.
Each run uses a fresh random user email; the required client is seeded through the API (`POST /api/clients`).

## Run

1. Start the app (from repo root, in two terminals):
   ```bash
   cd backend && npm install && npm run dev    # http://localhost:3001
   cd frontend && npm install && npm run dev   # http://localhost:5173
   ```
2. Run the tests:
   ```bash
   cd e2e
   npm install
   npx playwright install --with-deps chromium
   npm test
   ```

Options (env vars):
- `E2E_BASE_URL` — frontend URL (default `http://localhost:5173`)
- `E2E_SLOWMO=500` — slow each action down (ms), useful for watchable videos
- `E2E_VIDEO=off` — disable video recording (on by default; saved to `test-results/`)

HTML report: `npm run report`.

**Note:** the backend rate-limits to 100 requests per 15 minutes per IP (`backend/src/server.js`).
One test run makes ~12 requests; if you start getting `429`, restart the backend.
