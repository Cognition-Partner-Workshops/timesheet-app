# Coding Standards

This document describes the linting, formatting, and code quality tooling configured for the timesheet-app project.

## Overview

| Tool            | Purpose                                | Scope                                                     |
| --------------- | -------------------------------------- | --------------------------------------------------------- |
| **ESLint**      | Static analysis and code quality rules | Frontend (TypeScript/React) and Backend (Node.js/JS)      |
| **Prettier**    | Opinionated code formatter             | All source files (JS, TS, TSX, JSON, MD, YAML, CSS, HTML) |
| **Husky**       | Git hooks manager                      | Pre-commit hook at repo root                              |
| **lint-staged** | Run linters on staged files only       | Triggered by Husky pre-commit hook                        |

## ESLint Configuration

### Frontend (`frontend/eslint.config.js`)

Uses ESLint v9 flat config with:

- **`@eslint/js` recommended** - core JavaScript best practices
- **`typescript-eslint` recommended** - TypeScript-specific rules (no-explicit-any, no-unused-vars, etc.)
- **`eslint-plugin-react-hooks`** - enforces Rules of Hooks (exhaustive-deps, rules-of-hooks)
- **`eslint-plugin-react-refresh`** - ensures components are compatible with Vite HMR
- **`eslint-config-prettier`** - disables ESLint rules that conflict with Prettier formatting

Custom rule overrides:

- `@typescript-eslint/no-unused-vars`: warn (with `_` prefix ignore pattern)
- `@typescript-eslint/no-explicit-any`: warn

### Backend (`backend/eslint.config.js`)

Uses ESLint v9 flat config with:

- **`@eslint/js` recommended** - core JavaScript best practices
- **`globals`** - Node.js, CommonJS, and Jest globals
- **`eslint-config-prettier`** - disables ESLint rules that conflict with Prettier formatting

Custom rules:

- `no-unused-vars`: warn (with `_` prefix ignore pattern)
- `no-console`: off (server-side logging is expected)
- `eqeqeq`: error (always require `===` / `!==`)
- `curly`: error for multi-line blocks
- `no-var`: error (use `const`/`let`)
- `prefer-const`: warn

Test files (`**/__tests__/**/*.js`) additionally get Jest globals (`describe`, `it`, `expect`, etc.).

## Prettier Configuration (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf",
  "bracketSpacing": true,
  "arrowParens": "always",
  "jsxSingleQuote": false
}
```

**Key decisions:**

- **Single quotes** in JS/TS, **double quotes** in JSX - matches community conventions for React projects
- **Trailing commas everywhere** - cleaner git diffs
- **100-char print width** - balances readability with avoiding excessive line wrapping
- **Semicolons** - explicit statement termination for clarity
- **LF line endings** - consistent across platforms

## Pre-commit Hook (Husky + lint-staged)

Every `git commit` triggers the pre-commit hook which runs lint-staged:

- **`frontend/**/*.{ts,tsx}`** files: Prettier format + ESLint fix
- **`backend/**/*.js`** files: Prettier format + ESLint fix
- **`*.{json,md,yml,yaml,css,html}`** files: Prettier format

This ensures no unformatted or lint-violating code enters the repository.

## CI Integration

The `lint` job in `.github/workflows/pr-checks.yml` runs on every pull request to `main`:

1. Installs dependencies for frontend, backend, and root
2. Runs `prettier --check .` (fails if any file is not formatted)
3. Runs ESLint on the frontend
4. Runs ESLint on the backend

The job fails the build if any lint or formatting violation is found.

## Running Locally

```bash
# Run all linting (from repo root)
npm run lint

# Check formatting (from repo root)
npm run format:check

# Auto-fix formatting (from repo root)
npm run format

# Frontend lint only
cd frontend && npx eslint .

# Backend lint only
cd backend && npx eslint .
```

## Adding New Rules

- **Frontend**: Edit `frontend/eslint.config.js` - uses ESM flat config
- **Backend**: Edit `backend/eslint.config.js` - uses CJS flat config
- **Formatting**: Edit `.prettierrc` at the repo root
- Always ensure `eslint-config-prettier` remains the last config entry to avoid conflicts
