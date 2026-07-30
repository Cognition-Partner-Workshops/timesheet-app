# AGENTS.md — SDLC Agent Configuration

This file provides instructions for AI agents (Devin) working on this repository as part of the SDLC pipeline.

## Repository Overview

- **App**: Employee Time Tracking Application
- **Backend**: Node.js/Express with SQLite in-memory DB, JWT auth (port 3001)
- **Frontend**: React/TypeScript with Vite, Material UI (port 5173)

## Setup Commands

```bash
# Backend
cd backend && npm install && cp -n .env.example .env && npm run dev

# Frontend
cd frontend && npm install && cp -n .env.example .env && npm run dev
```

## Quality Checks

Run these before creating any PR:

```bash
# Lint (frontend)
cd frontend && npm run lint

# Tests (backend)
cd backend && npm test

# Build (frontend)
cd frontend && npm run build
```

## Branch Naming Convention

```
feature/JIRA-TICKET-ID-short-description
```

Example: `feature/PROJ-123-add-export-functionality`

## Commit Message Convention

```
[JIRA-ID] Brief description of change

Optional longer description explaining the "why" behind the change.
```

Example: `[PROJ-123] Add CSV export for work entries`

## Code Conventions

### Backend (Node.js/Express)
- Use `const` / `let` — never `var`
- Use async/await for asynchronous operations
- Validate all inputs with Joi schemas in `backend/src/validation/schemas.js`
- Add new routes in `backend/src/routes/` and register in `server.js`
- Use the `auth` middleware for protected endpoints
- Use the centralized error handler — throw errors, don't return error responses inline

### Frontend (React/TypeScript)
- Functional components with hooks only
- Use Material UI components — do not introduce other UI libraries
- API calls go through `frontend/src/api/client.ts`
- Types/interfaces in `frontend/src/types/api.ts`
- Use React Query for server state (see existing patterns)
- Pages in `frontend/src/pages/`, reusable components in `frontend/src/components/`

## Testing Patterns

### Backend
- Tests use Jest
- Test files: `backend/src/**/*.test.js`
- Run: `cd backend && npm test`

### Frontend
- Lint is the primary quality gate
- Run: `cd frontend && npm run lint`

## File Structure Rules

- New API endpoints: create route file in `backend/src/routes/` → register in `server.js`
- New pages: create in `frontend/src/pages/` → add route in `App.tsx`
- New components: create in `frontend/src/components/`
- New types: add to `frontend/src/types/api.ts`
- Validation schemas: add to `backend/src/validation/schemas.js`

## Security Scanning

### Snyk Vulnerability Scan
```bash
# Install Snyk CLI (if not available)
npm install -g snyk

# Authenticate
snyk auth $SNYK_TOKEN

# Scan backend dependencies
cd backend && snyk test --severity-threshold=high

# Scan frontend dependencies
cd frontend && snyk test --severity-threshold=high

# Fallback: npm audit
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high
```

### Security Remediation Branch Naming
```
fix/snyk-vulnerability-remediation-YYYY-MM-DD
```

## Available Agent Playbooks

| Playbook | Macro | Purpose |
|----------|-------|---------|
| SDLC Agent - Jira Ticket to PR | `!sdlc_agent` | Full SDLC workflow: Jira → Plan → Code → Review → PR |
| Snyk Vulnerability Agent | `!snyk_agent` | Security scanning: Scan → Analyze → Remediate → PR |

## Forbidden Actions

- Do NOT modify the database initialization to use file-based storage without explicit approval
- Do NOT change the JWT authentication mechanism
- Do NOT install new UI component libraries (use Material UI)
- Do NOT commit `.env` files
- Do NOT modify test files to make them pass — fix the source code
- Do NOT commit Snyk API tokens or security scan results containing sensitive paths
- Do NOT apply major dependency version bumps without flagging in the PR
