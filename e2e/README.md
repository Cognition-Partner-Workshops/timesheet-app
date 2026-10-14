# End-to-end tests

Playwright tests covering login, client management, the work entry lifecycle,
reporting and input edge cases.

## Running

```bash
cd e2e
npm install
npx playwright install chromium
npm test           # starts backend (3001) + frontend (5173) automatically
npm run report     # open the HTML report
```

The Playwright `webServer` config starts the backend with a raised
`RATE_LIMIT_MAX` so a full suite run is not throttled, and reuses servers that
are already listening on those ports. Set `E2E_NO_WEBSERVER=1` to run against
servers you started yourself.

Because the backend uses an in-memory SQLite database keyed by user email, every
test logs in with a unique email and therefore gets isolated data.
