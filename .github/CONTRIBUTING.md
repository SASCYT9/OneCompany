# Contributing to OneCompany

OneCompany is proprietary software; see [`LICENSE`](../LICENSE). Bug reports are
welcome, while code contributions require an invited collaborator.

Repository behavior and this guide were revalidated on 2026-08-14. Read
[`AGENTS.md`](../AGENTS.md) before changing code or data.

## Reporting

- Bugs: [Bug Report](https://github.com/SASCYT9/OneCompany/issues/new?template=bug_report.yml)
- Features: [Feature Request](https://github.com/SASCYT9/OneCompany/issues/new?template=feature_request.yml)
- Catalog findings: [Brand Audit Finding](https://github.com/SASCYT9/OneCompany/issues/new?template=brand-audit-finding.yml)
- Vulnerabilities: follow [`SECURITY.md`](SECURITY.md); do not open a public issue

Do not include credentials, session cookies, database records, customer information,
private order data, or unredacted provider responses in an issue.

## Prerequisites

- Node.js `>=20 <23`
- npm and Git
- for full-stack work, an explicitly disposable development/test PostgreSQL database
- only the sandbox/non-production integration credentials required by the task

## Setup

Install dependencies with the same peer-dependency behavior used by Vercel:

```bash
git clone https://github.com/SASCYT9/OneCompany.git
cd OneCompany
npm install --legacy-peer-deps
cp .env.example .env.local
```

For a DB-less storefront, leave `DATABASE_URL` and `DIRECT_URL` empty, set
`SHOP_LOCAL_CATALOG_SNAPSHOT=1`, then run:

```bash
npm run catalog:fallback:local
npm run dev
```

For full-stack work, configure a dedicated non-production PostgreSQL database and
unique local auth secrets, then run:

```bash
npm run prisma:generate
npm run db:migrate
npm run dev
```

Never use Production credentials for routine development or tests. Admin editing
requires an active DB user and the relevant roles/permissions.

## Branches and commits

- Branch from current `master`.
- Keep one logical change per branch/PR.
- Common human branch prefixes are `feature/`, `fix/`, `refactor/`, and `chore/`.
- Codex-created branches use the repository's configured `codex/` prefix.
- Do not mix generated catalog files, backups, local media, or environment files
  into a source commit.

Use Conventional Commits:

```text
<type>(<scope>)?: <short summary>
```

Common types are `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
`chore`, and `revert`. Commitlint validates PR commits; release-please manages
release metadata from merged conventional commits.

## Verification

Choose checks based on the change. The normal baseline is:

```bash
npm run typecheck
npm run lint
```

ESLint currently has a warning backlog. Zero errors is required; report warnings
rather than claiming a warning-free run.

Useful scoped checks include:

```bash
npm run test:seo:contracts
npm run test:shop:unit
npm run test:ops
```

For Prisma validation without configured credentials, non-secret placeholder URLs
are sufficient because validation does not connect:

```bash
DATABASE_URL='postgresql://stub:stub@localhost:5432/stub?schema=public' \
DIRECT_URL='postgresql://stub:stub@localhost:5432/stub?schema=public' \
npx prisma validate
```

`npm run test:shop` also runs integration and browser/API E2E suites. Run it only
after confirming a disposable database, a non-production `SHOP_E2E_BASE_URL`,
sandboxed integrations, and the suite's cleanup behavior. Some paths can create
orders and trigger notifications.

`npm run ops:test:persistence` requires an isolated `OPS_TEST_DATABASE_URL`.
`npm run build` generates catalog snapshots/indexes and requires an appropriate
catalog database; it is not a lightweight universal check.

## Pull requests and CI

1. Review the final diff and ensure unrelated work is absent.
2. Describe affected routes/data/integrations and the environment used for testing.
3. List commands actually run and anything intentionally skipped.
4. Add migration and rollback notes for schema or production-behavior changes.
5. Request review from the repository owner.

Normal CI on `master` PRs runs:

- ESLint;
- TypeScript;
- SEO contract tests;
- Prisma schema validation and a non-blocking format warning.

Commitlint, CodeQL, and other security/release workflows run separately. Full unit,
integration, E2E, and production build are not all included in the normal CI job.
Dependabot is not currently configured for automatic update PRs or auto-merge.

Vercel configuration currently skips automatic builds for non-`master` branches, so
a Preview must be created manually when required. Merge, migration, workflow
dispatch, and Production deployment remain separate owner approvals.

## Code and data expectations

- Follow existing files and domain helpers; do not add a framework for one change.
- Preserve UA/EN storefront parity.
- Keep customer auth and DB-backed admin RBAC separate.
- Use forward Prisma migrations; never repair shared environments with `db push` or
  ad hoc destructive SQL.
- Treat payment, email, Telegram, Shopify, Airtable export, Blob, CRM, supplier
  commit, and webhook operations as real external side effects.
- Use approved product/brand imagery only.

Questions can go to the repository Discussions area or `info@onecompany.global`.
