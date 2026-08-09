# Coding Standards

This repository uses one shared formatting policy and package-local lint
configurations. The frontend and backend retain their independent dependency
trees; the root package only provides repository-level tooling and convenience
commands.

## Configuration locations

- `.prettierrc.json` and `.prettierignore` define formatting for the whole
  repository.
- `frontend/eslint.config.js` contains the frontend flat ESLint configuration.
- `backend/eslint.config.js` contains the backend flat ESLint configuration.
- The root `package.json` delegates linting and formatting to both packages.

## ESLint

The frontend extends ESLint's recommended JavaScript rules,
typescript-eslint's type-aware recommended rules, the React Hooks and React
Refresh rules, and `eslint-config-prettier`. Type-aware linting uses
typescript-eslint project service against the application and Vite
configuration TypeScript projects. Browser globals apply to the application;
Node globals apply to Vite configuration files.

The backend uses ESLint's recommended JavaScript rules and
typescript-eslint's recommended rules that are applicable to JavaScript. It
uses CommonJS parsing and Node globals, with Jest globals enabled separately
for `src/__tests__/**`.

The backend is plain CommonJS JavaScript, not TypeScript. Type-aware
TypeScript rules therefore apply only to the frontend; backend linting does
not require a TypeScript project.

Both packages enforce zero warnings with `--max-warnings=0`. If a rule is
genuinely incompatible with the repository's architecture, disable it in the
nearest ESLint configuration with a one-line justification. Do not use
file-level or inline disables to hide a real issue.

## Prettier

Prettier uses single quotes, semicolons, trailing commas wherever supported,
and a 100-character print width. Generated output, dependencies, coverage,
lockfiles, source maps, and SVG assets are ignored. Run:

```sh
npm run format
npm run format:check
```

## Pre-commit hook

After root dependencies are installed, the `prepare` script initializes Husky.
`.husky/pre-commit` runs lint-staged. Staged frontend TypeScript files and
backend JavaScript files are formatted and then passed through their
package-local ESLint autofix. Staged JSON, Markdown, and YAML files are
formatted with Prettier.

## Local linting

```sh
npm run lint
npm run lint:fix
cd frontend && npm run build
cd ../backend && npm test
```

Keep lint and format checks clean before opening a pull request. The blocking
CI lint job installs root, frontend, and backend dependencies, then runs the
same lint and formatting checks.
