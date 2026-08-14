---
description: Scope-aware, non-destructive verification for OneCompany changes
---

# Auto-audit

Use this workflow when the user asks to audit, verify, or check a change. The root
`AGENTS.md` remains authoritative.

## 1. Establish scope and safety

1. Read `git status --short` and preserve unrelated changes.
2. Inspect the actual diff and the files that own the affected flow.
3. Determine whether the current environment is DB-less local, disposable
   development/test, Preview, or Production.
4. Do not turn an audit into a deployment, migration, import, checkout, webhook,
   email, Telegram send, Blob deletion, or other external mutation.

## 2. Baseline checks

For application changes, normally run:

```bash
npm run typecheck
npm run lint
```

ESLint has a known warning backlog. Zero errors is the blocking condition; report
the warning count instead of claiming that lint is warning-free.

Add checks according to the changed area:

- storefront routing, metadata, catalog outage behavior: `npm run test:seo:contracts`;
- Prisma schema: validate with non-secret stubs when no database is configured:

  ```bash
  DATABASE_URL='postgresql://stub:stub@localhost:5432/stub?schema=public' \
  DIRECT_URL='postgresql://stub:stub@localhost:5432/stub?schema=public' \
  npx prisma validate
  ```

- shop application logic: the narrow matching unit files or
  `npm run test:shop:unit`;
- Operations/RBAC: the narrow matching tests or `npm run test:ops`;
- scripts: a script-specific dry run or syntax/runtime check, because the main
  TypeScript config excludes `scripts/`;
- documentation: format only touched files, check relative links, and run
  `git diff --check`.

## 3. Tests that require explicit isolation

Do not blindly run `npm run test:shop`. It includes integration and browser/API E2E
tests that can persist orders and trigger notifications. Before any integration or
E2E run, prove all of the following:

- the database is disposable and not Production;
- `SHOP_E2E_BASE_URL` is a non-production URL;
- required opt-in flags and mock/sandbox integrations are configured;
- the test's cleanup behavior has been read.

`npm run ops:test:persistence` similarly requires an isolated
`OPS_TEST_DATABASE_URL`.

`npm run build` is not a routine quick check: it generates catalog artifacts and
requires a valid catalog database in deployment-like modes. Run it only when the
task warrants it and the required non-production or authorized deployment
environment is available.

## 4. Browser verification

For user-visible changes, use an available browser-control skill against the
already-running local server. Verify the exact UA/EN route, responsive state, console,
and network failures relevant to the change. Do not create a real order or exercise
production write endpoints as a smoke test.

## 5. Report

State exactly:

- what was inspected;
- each command that ran and its result;
- warning counts or known baseline noise;
- what was skipped and why;
- whether any finding remains unresolved.

Never report success for checks that were not run.
