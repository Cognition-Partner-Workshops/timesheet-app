# Coding Standards

This document describes the linting and formatting setup for the timesheet app and the reasoning
behind each choice.

## Overview

| Concern          | Tool                           | Config                                    |
| ---------------- | ------------------------------ | ----------------------------------------- |
| Formatting       | Prettier                       | `.prettierrc.json`, `.prettierignore`     |
| Backend linting  | ESLint (flat config)           | `backend/eslint.config.js`                |
| Frontend linting | ESLint (flat config)           | `frontend/eslint.config.js`               |
| Staged-file gate | Husky + lint-staged            | `.husky/pre-commit`, `.lintstagedrc.json` |
| CI gate          | GitHub Actions `Lint & Format` | `.github/workflows/pr-checks.yml`         |

Tooling that applies to the whole repository (Prettier, Husky, lint-staged) lives in the root
`package.json`. ESLint stays inside `backend/` and `frontend/` so each package keeps a config
matched to its runtime, and so `npm run lint` works from either package directory.

## Commands

```bash
npm install              # root tooling + installs the git hook (prepare script)
npm run lint             # ESLint over backend and frontend, zero warnings allowed
npm run lint:fix         # ESLint with --fix over both packages
npm run format           # Prettier write over the repo
npm run format:check     # Prettier check only (what CI runs)
```

Per package: `npm run lint` / `npm run lint:fix` inside `backend/` or `frontend/`.

## Prettier

Prettier owns all formatting; ESLint owns correctness. `eslint-config-prettier` is the last entry in
both ESLint configs, so no stylistic ESLint rule can conflict with the formatter.

| Option                  | Reason                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| `semi: true`            | Matches the existing code in both packages.                                |
| `singleQuote: true`     | Matches the existing code in both packages.                                |
| `trailingComma: "all"`  | Smaller diffs when arguments or properties are added.                      |
| `printWidth: 100`       | Fits the wide MUI/JSX and Express route code without excessive wrapping.   |
| `tabWidth: 2`           | Existing convention.                                                       |
| `arrowParens: "always"` | Consistent arrow signatures, minimal diff when a type annotation is added. |
| `endOfLine: "lf"`       | Avoids CRLF churn between contributors.                                    |

`.prettierignore` excludes `node_modules`, build output (`dist`, `build`), `coverage`, lock files,
generated assets, and `backend/test-results.txt`.

## Backend ESLint (`backend/eslint.config.js`)

The backend is CommonJS JavaScript on Node 20. The config uses `typescript-eslint` as parser and
rule source, which gives the backend the same rule set the frontend uses (and TypeScript-aware
linting later if the backend is migrated), while `sourceType: 'commonjs'` and `globals.node` keep it
correct for the current runtime.

Layers:

1. `@eslint/js` recommended — baseline JavaScript correctness.
2. `typescript-eslint` recommended (non type-checked) — the backend has no `tsconfig.json`, so
   type-aware rules are not available here.
3. `eslint-plugin-jest` recommended, scoped to `src/__tests__/**` — catches focused/disabled tests,
   identical-title mistakes, and callback-style async tests.
4. `eslint-config-prettier` — disables formatting rules.

Notable rule choices:

- `@typescript-eslint/no-require-imports: off` — the backend is intentionally CommonJS.
- `@typescript-eslint/no-unused-vars` — errors, but `_`-prefixed names are allowed. Express requires
  a 4-argument error handler signature, so unused parameters are named `_next` rather than removed.
- `caughtErrors: 'all'` — an unused caught error usually means a swallowed failure.
- `eqeqeq: ['error', 'smart']` — allows `== null` for the null/undefined check, rejects other
  coercions.
- `no-console: off` — the server logs to stdout on purpose.

## Frontend ESLint (`frontend/eslint.config.js`)

The frontend is TypeScript + React 19 + Vite, so the config uses **type-checked** rules
(`tseslint.configs.recommendedTypeChecked` with `projectService: true`). That is the main reason
this setup catches real bugs rather than style issues: unsafe `any` flow out of API calls, floating
promises, and misused promises are only detectable with type information.

Layers: `@eslint/js` recommended, `typescript-eslint` recommendedTypeChecked,
`eslint-plugin-react-hooks` recommended, `eslint-plugin-react-refresh` (Vite preset), then
`eslint-config-prettier`.

Notable rule choices:

- `@typescript-eslint/consistent-type-imports` — keeps type-only imports erasable, which matters
  with `verbatimModuleSyntax` in `tsconfig.app.json`.
- `@typescript-eslint/no-misused-promises` with `checksVoidReturn.attributes: false` — passing an
  `async` handler to a JSX prop (`onSubmit`, `onClick`) is idiomatic React and the rule would
  otherwise flag every form and button. Floating promises in statement position are still errors.
- `@typescript-eslint/no-floating-promises` — kept on. Fire-and-forget calls such as
  `queryClient.invalidateQueries(...)` or `navigate(...)` must be marked explicitly with `void`.
- `no-console: warn` (`warn`/`error` allowed) — with `--max-warnings=0` in the lint script, a stray
  `console.log` fails the build.

### Why the API client is typed

Type-checked linting flagged ~90 `no-unsafe-*` errors that all traced back to one cause:
`src/api/client.ts` returned `any` from every method, so every page consumed untyped data. The fix
was to type the axios calls with the interfaces already declared in `src/types/api.ts`
(`this.client.get<ClientsResponse>(...)`) instead of suppressing the rules. Pages now get real
types, and redundant inline parameter annotations were removed.

## Pre-commit hook

`.husky/pre-commit` runs `lint-staged`. Configuration is in `.lintstagedrc.json`:

- `backend/**/*.js` → `prettier --write`, then `eslint --fix --max-warnings=0`
- `frontend/**/*.{ts,tsx}` → `prettier --write`, then `eslint --fix --max-warnings=0`
- JSON/Markdown/YAML/CSS → `prettier --write`

Formatting is applied automatically and re-staged; anything ESLint cannot fix aborts the commit.
ESLint is invoked through each package's local binary with an explicit `--config` because the hook
runs from the repository root while each package owns its own ESLint installation and flat config
(ESLint 9 resolves `eslint.config.js` from the working directory, not from the linted file).

The hook is installed by the root `prepare` script, so `npm install` at the root is enough. Run
`git commit --no-verify` only when a commit genuinely must bypass the hook — CI enforces the same
checks anyway.

## CI

`.github/workflows/pr-checks.yml` has a `Lint & Format` job that installs the root, backend, and
frontend dependencies and then runs `npm run format:check`, backend `npm run lint`, and frontend
`npm run lint`. Both lint scripts use `--max-warnings=0`, so warnings fail the build exactly like
errors — the project has no lint debt to inherit, and this keeps it that way.

## Conventions when adding code

- Do not add ESLint disable comments without a short reason on the same line.
- Prefer fixing types over silencing type-aware rules; an `any` in the API layer becomes dozens of
  errors in the pages.
- Mark intentionally unawaited promises with `void`.
- Prefix deliberately unused parameters with `_`.
- Run `npm run format` before pushing if you skipped the hook.
