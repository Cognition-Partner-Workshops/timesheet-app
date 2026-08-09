# Quality gates

The pull-request quality pipeline runs six independent gates and publishes one
sticky dashboard comment. All commands below are run from the repository root
unless noted.

## Lint

Checks frontend ESLint plus Prettier checks for both packages. The gate passes
when all checks exit successfully.

```sh
npm run lint --prefix frontend
npm run format:check --prefix backend
npm run format:check --prefix frontend
```

Fix with `npm run format --prefix backend` or `npm run format --prefix frontend`,
then address any ESLint diagnostics.

## Unit tests

Runs all backend Jest tests and frontend Vitest tests. Both suites must pass.

```sh
npm test --prefix backend
npm test --prefix frontend
```

Fix the failing test or implementation and rerun the relevant suite.

## Coverage

Head total line coverage must not be lower than the base branch's total line
coverage. The base is computed by checking out the PR base ref and running the
same commands; if that ref predates the coverage tooling, the comparison is
reported as baseline unavailable and skipped. Lines changed in `frontend/src`
must have at least **80%** coverage; a patch with no coverable changed lines is
N/A and passes.

```sh
npm run test:coverage --prefix backend
npm run test:coverage --prefix frontend
```

Add tests for uncovered changed lines. Do not lower thresholds to make a PR
pass.

## Security

Runs `npm audit --json` in both packages. The exact threshold is **0 high and 0
critical** vulnerabilities.

```sh
npm audit --prefix backend
npm audit --prefix frontend
```

Upgrade affected dependencies, regenerate lockfiles, and rerun the audits.

## Types

The frontend TypeScript project must compile without errors.

```sh
npm run typecheck --prefix frontend
```

Fix the reported type errors; backend is plain JavaScript and has no meaningful
standalone typecheck.

## Bundle size

The gzipped total of `frontend/dist/assets` must not be more than **10% larger**
than the base branch. A base build failure or missing baseline is reported as
baseline unavailable and skipped.

```sh
npm run build --prefix frontend
find frontend/dist/assets -type f -print0 | xargs -0 gzip -c | wc -c
```

Reduce the shipped JavaScript/CSS, split or lazy-load large features, and
inspect the Vite build output.

## Adjusting thresholds

Threshold changes should be deliberate and reviewed in the same change as an
update to this document and the workflow. Prefer improving tests or reducing
bundle output over lowering a gate.

The existing `pr-checks.yml` also runs an npm-audit-based demo gate that
triggers Devin CVE auto-fix, so audit findings may surface twice.
