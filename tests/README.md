# Test Automation Framework

Comprehensive test automation for the Employee Time Tracking application, covering API integration tests and end-to-end (E2E) browser tests.

## Architecture

```
tests/
├── api/                     # API integration tests (Jest + Supertest)
│   ├── auth.api.test.js     # Authentication endpoints
│   ├── clients.api.test.js  # Client CRUD operations
│   ├── work-entries.api.test.js  # Work entry CRUD operations
│   ├── reports.api.test.js  # Reports & export (CSV/PDF)
│   └── health.api.test.js   # Health check endpoint
├── e2e/                     # E2E browser tests (Playwright)
│   ├── login.spec.js        # Login page & authentication flow
│   ├── dashboard.spec.js    # Dashboard stats & navigation
│   ├── clients.spec.js      # Client management (create/edit/delete)
│   ├── work-entries.spec.js # Work entry management
│   └── reports.spec.js      # Report generation & exports
├── fixtures/                # Reusable test data
│   └── test-data.js         # User, client, and work entry fixtures
├── helpers/                 # Test infrastructure
│   ├── api-client.js        # Authenticated API request wrapper
│   └── test-server.js       # Express app factory with real SQLite
├── jest.config.js           # Jest configuration for API tests
├── playwright.config.js     # Playwright configuration for E2E tests
└── README.md                # This file
```

## Prerequisites

- Node.js 18+
- Backend and frontend dependencies installed (`cd backend && npm install`, `cd frontend && npm install`)

## Setup

From the project root:

```bash
npm install                     # Install test dependencies
npx playwright install chromium # Install browser for E2E tests
```

## Running Tests

### All Tests

```bash
npm test
```

### API Integration Tests

Tests run against the Express app with a real in-memory SQLite database (no mocks). Each test file gets a fresh database.

```bash
npm run test:api          # Run all API tests
npm run test:api:verbose  # With detailed output
```

### E2E Browser Tests

Playwright tests start the backend and frontend dev servers automatically.

```bash
npm run test:e2e          # Run headless
npm run test:e2e:headed   # Run with visible browser
npm run test:e2e:debug    # Run in debug mode with Playwright Inspector
npm run test:e2e:report   # Open the HTML report from the last run
```

## Test Coverage

### API Tests

| Module       | Tests | Coverage                                          |
|-------------|-------|---------------------------------------------------|
| Auth        | 7     | Login (new/existing), validation, auth header      |
| Clients     | 10    | Full CRUD, data isolation, validation              |
| Work Entries| 11    | Full CRUD, client validation, data isolation       |
| Reports     | 6     | Report generation, CSV export, PDF export          |
| Health      | 1     | Health check endpoint                              |

### E2E Tests

| Page         | Tests | Coverage                                          |
|-------------|-------|---------------------------------------------------|
| Login       | 4     | Form display, validation, login flow               |
| Dashboard   | 5     | Stats cards, quick actions, navigation             |
| Clients     | 4     | Create, edit, delete clients                       |
| Work Entries| 2     | Page display, create entry with client             |
| Reports     | 3     | Page display, client selector, report generation   |

## Design Decisions

- **API tests use a real SQLite in-memory database** instead of mocks to catch integration issues at the DB layer.
- **E2E tests auto-start servers** via Playwright's `webServer` config, making them self-contained.
- **Data isolation**: Each API test file gets a fresh database. E2E tests use unique email addresses per test suite.
- **TestApiClient helper**: Wraps supertest with auth-aware convenience methods, reducing boilerplate.
- **Fixtures**: Centralized test data for consistency across test suites.
