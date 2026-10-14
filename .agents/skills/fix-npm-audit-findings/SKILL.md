---
name: fix-npm-audit-findings
description: Remediate npm audit vulnerabilities in timesheet-app without making the tree worse. Use for CVE issues, Dependabot alerts, or the automated CVE auto-fix workflow.
---

# Fix npm audit findings

## Do not run `npm audit fix`

On this repo it makes things worse. Measured on the backend: 10 high → **27
high**, because it upgrades `jest`/`nodemon` subtrees and pulls in a wider set
of flagged transitive packages. Never run `npm audit fix --force` — it proposes
the breaking `sqlite3@6` upgrade.

If you already ran it, `git checkout package-lock.json` and start over.

## Preferred approach: targeted overrides

Most findings are transitive with no fixed parent release. Pin the fixed
version in `package.json`:

```json
"overrides": {
  "jws": "^3.2.3",
  "qs": "^6.15.3"
}
```

Then `npm install` and confirm with `npm ls <pkg>` that it resolves and is
marked `overridden`.

Rules:
- Only override the packages named in the issue/advisory. Scope creep here
  causes unrelated breakage.
- Check the fixed version was published **at least 7 days ago**
  (`npm view <pkg> time --json`) — freshly published versions are unvetted and
  yanked supply-chain attacks are usually caught within days.
- Verify the override is semver-compatible with what the parent expects (e.g.
  `body-parser` wants `qs@6.14`; `6.15.x` is API-compatible).

## Verify

```bash
cd backend
npm audit --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['metadata']['vulnerabilities'])"
npm test   # must stay green
```

Confirm the specific advisory packages no longer appear at any severity.

## Known pre-existing baseline

`npm audit` will **not** be clean afterwards, and that is expected. The
following predate any current change and need a breaking `sqlite3@6` upgrade to
clear — do not chase them unless explicitly asked:

- `sqlite3@5` native build chain: `node-gyp`, `tar` (critical), `cacache`,
  `make-fetch-happen`
- `path-to-regexp`, `form-data`, `js-yaml`, `minimatch`, `picomatch`,
  `brace-expansion`

State this baseline explicitly in the PR description so the remaining findings
are not mistaken for regressions.

## Context

`.github/workflows` triggers a Devin session for CVE remediation with an
explicit **one-time attempt** guard (it counts prior "Devin CVE Auto-Fix"
comments and skips if any exist). Do not add retry loops that defeat it.
