# Quality Gates

This document describes the six quality gates enforced by the **Continuous Quality Pipeline** on every pull request targeting `main`. All gates must pass before a PR can be merged.

---

## Gate 1: Linting (ESLint + Prettier)

| Check | Scope | Command |
|-------|-------|---------|
| ESLint | `frontend/` | `cd frontend && npx eslint .` |
| Prettier | `frontend/src/` | `cd frontend && npm run format:check` |

**Threshold:** Zero errors.

**How to fix:**

```bash
# Auto-fix ESLint issues
cd frontend && npx eslint . --fix

# Auto-fix formatting
cd frontend && npx prettier --write "src/**/*.{ts,tsx,css}"
```

---

## Gate 2: Unit Tests

| Check | Scope | Command |
|-------|-------|---------|
| Jest | `backend/` | `cd backend && npm test` |

**Threshold:** All tests must pass.

**How to fix:**
- Run `cd backend && npm test` locally to see failing tests.
- Fix the test or the code it covers, then re-run.

---

## Gate 3: Code Coverage

| Check | Scope | Command |
|-------|-------|---------|
| Jest --coverage | `backend/` | `cd backend && npx jest --coverage` |

**Threshold:** All four metrics (statements, branches, functions, lines) must be **>= 80%**.

**How to fix:**
1. Run `cd backend && npx jest --coverage` to view the per-file coverage table.
2. Add or improve tests in `backend/src/__tests__/` for files below threshold.
3. Do **not** lower thresholds or exclude files to work around the gate.

---

## Gate 4: Security Audit (npm audit)

| Check | Scope | Command |
|-------|-------|---------|
| npm audit | `frontend/` | `cd frontend && npm audit` |
| npm audit | `backend/` | `cd backend && npm audit` |

**Threshold:** Zero **high** or **critical** severity vulnerabilities.

Moderate and low severity issues are logged but do not block the pipeline.

**How to fix:**

```bash
# Try the automatic fix first
npm audit fix

# If that doesn't resolve it, check for major version bumps
npm audit fix --force   # review changes carefully

# For transitive dependencies, override the vulnerable package
# in package.json "overrides" (npm 8+)
```

---

## Gate 5: TypeScript Type Check

| Check | Scope | Command |
|-------|-------|---------|
| tsc --noEmit | `frontend/` | `cd frontend && npx tsc -b --noEmit` |

**Threshold:** Zero type errors.

**How to fix:**
- Run the command locally to see the exact error locations.
- Fix the type annotations or add missing type declarations.
- Do **not** add `// @ts-ignore` or change `strict` in `tsconfig.json`.

---

## Gate 6: Bundle Size

| Check | Scope | Threshold |
|-------|-------|-----------|
| Vite production build | `frontend/` | **<= 10% increase** vs. base branch |

The pipeline builds the frontend on both the PR branch and the base branch, then compares total `dist/` size.

**How to fix:**
- Use dynamic `import()` to code-split large pages or heavy libraries.
- Remove unused dependencies from `package.json`.
- Replace heavyweight libraries with lighter alternatives when possible.
- Review new asset files (images, fonts) for size optimization.
- Run `cd frontend && npx vite build` and check the output for chunk sizes.

---

## Quality Dashboard

After all gates run, a summary comment is posted (or updated) on the PR with a table showing pass/fail status and metrics for each gate. Look for the **"Quality Pipeline"** comment.

---

## Configuration Files

| File | Purpose |
|------|---------|
| `.github/workflows/quality-pipeline.yml` | CI workflow definition |
| `frontend/eslint.config.js` | ESLint rules (flat config) |
| `.prettierrc` | Prettier formatting options |
| `backend/jest.config.js` | Jest test runner and coverage thresholds |
| `frontend/tsconfig.json` | TypeScript compiler configuration |
