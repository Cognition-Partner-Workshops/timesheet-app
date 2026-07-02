# Dependency Upgrade Report

**Date:** 2026-07-02
**Scope:** Minor and patch version updates only (no major version jumps)

## Backend

### Successfully Upgraded

| Dependency | Type | Previous Version | New Version |
|---|---|---|---|
| `cors` | Production | 2.8.5 | 2.8.6 |
| `express` | Production | 4.22.1 | 4.22.2 |
| `joi` | Production | 17.13.3 | 17.13.4 |
| `jsonwebtoken` | Production | 9.0.2 | 9.0.3 |
| `morgan` | Production | 1.10.1 | 1.11.0 |
| `nodemon` | Dev | 3.1.11 | 3.1.14 |

### Skipped (Major Version Jump Required)

| Dependency | Current | Latest | Reason |
|---|---|---|---|
| `express` | 4.22.2 | 5.2.1 | Major version jump (4.x to 5.x) |
| `express-rate-limit` | 7.5.1 | 8.5.2 | Major version jump (7.x to 8.x) |
| `helmet` | 7.2.0 | 8.2.0 | Major version jump (7.x to 8.x) |
| `jest` | 29.7.0 | 30.4.2 | Major version jump (29.x to 30.x) |
| `joi` | 17.13.4 | 18.2.3 | Major version jump (17.x to 18.x) |
| `pdfkit` | 0.13.0 | 0.19.1 | Breaking minor in 0.x series (^0.13.0 range) |
| `sqlite3` | 5.1.7 | 6.0.1 | Major version jump (5.x to 6.x) |
| `supertest` | 6.3.4 | 7.2.2 | Major version jump (6.x to 7.x) |

## Frontend

### Successfully Upgraded

| Dependency | Type | Previous Version | New Version |
|---|---|---|---|
| `@eslint/js` | Dev | 9.39.1 | 9.39.4 |
| `@mui/icons-material` | Production | 7.3.6 | 7.3.11 |
| `@mui/material` | Production | 7.3.6 | 7.3.11 |
| `@mui/x-date-pickers` | Production | 8.19.0 | 8.29.0 |
| `@tanstack/react-query` | Production | 5.90.11 | 5.101.2 |
| `@types/node` | Dev | 24.10.1 | 24.13.2 |
| `@types/react` | Dev | 19.2.7 | 19.2.17 |
| `@vitejs/plugin-react` | Dev | 5.1.1 | 5.2.0 |
| `axios` | Production | 1.13.2 | 1.18.1 |
| `date-fns` | Production | 4.1.0 | 4.4.0 |
| `eslint` | Dev | 9.39.1 | 9.39.4 |
| `eslint-plugin-react-hooks` | Dev | 7.0.1 | 7.1.1 |
| `eslint-plugin-react-refresh` | Dev | 0.4.24 | 0.4.26 |
| `react` | Production | 19.2.0 | 19.2.7 |
| `react-dom` | Production | 19.2.0 | 19.2.7 |
| `react-router-dom` | Production | 7.10.0 | 7.18.1 |
| `typescript-eslint` | Dev | 8.48.1 | 8.62.1 |

### Skipped (Major Version Jump Required)

| Dependency | Current | Latest | Reason |
|---|---|---|---|
| `@mui/icons-material` | 7.3.11 | 9.1.1 | Major version jump (7.x to 9.x) |
| `@mui/material` | 7.3.11 | 9.1.2 | Major version jump (7.x to 9.x) |
| `@mui/x-date-pickers` | 8.29.0 | 9.7.0 | Major version jump (8.x to 9.x) |
| `@types/node` | 24.13.2 | 26.1.0 | Major version jump (24.x to 26.x) |
| `@vitejs/plugin-react` | 5.2.0 | 6.0.3 | Major version jump (5.x to 6.x) |
| `eslint-plugin-react-refresh` | 0.4.26 | 0.5.3 | Breaking minor in 0.x series |
| `globals` | 16.5.0 | 17.7.0 | Major version jump (16.x to 17.x) |
| `typescript` | 5.9.3 | 6.0.3 | Major version jump (5.x to 6.x) |
| `vite` | 7.3.6 | 8.1.3 | Major version jump (7.x to 8.x) |

## Verification

- Backend: All 161 tests pass (`npm test`) after upgrade
- Frontend: TypeScript compilation and Vite build pass (`npm run build`), ESLint passes (`npm run lint`)
