# One Company Operations — production rollout

Last repository review: 2026-08-14.

This is the maintained code-side release procedure. Provider-dashboard state,
database identity, backup availability, and Vercel alias behavior must still be
verified at release time. Passing a check is evidence, not permission to merge,
migrate, change a webhook, or deploy.

## Non-negotiable rules

- Release only an exact clean, reviewed commit.
- Treat merge/push, database backup, migration, environment changes, webhook switch,
  deployment, promotion, and rollback as separate owner approvals.
- Keep customer/shop and Operations Telegram credentials separate.
- Never use Preview credentials/database in Production or Production data as a
  routine test target.
- Use forward migrations. Roll back behavior with flags/deployment rollback; repair
  schema/data with reviewed forward changes, never destructive reverse SQL.
- Keep payments, checkout completion, arbitrary SQL/shell, and unapproved external
  messaging outside the Operations automation registry.

## Gate 0 — resolve exact targets

Before commands that read remote state, record without exposing secrets:

- intended Git commit and branch;
- Vercel team/project and environment;
- whether pushes to `master` automatically receive the Production alias;
- runtime `DATABASE_URL` identity and direct `DIRECT_URL` identity;
- active PostgreSQL provider/project and its backup/PITR policy;
- dedicated Operations bot and private media store.

`vercel.json` skips automatic builds for non-`master` branches. Do not assume a PR
has a Preview. Conversely, do not push an unverified commit to `master` as a
“candidate” until the Vercel dashboard confirms that doing so will not immediately
replace the Production alias.

## Gate 1 — local release evidence

Safe source checks:

```bash
git status --short
npm run ops:prod:check
npm run typecheck
npm run lint
npm run test:seo:contracts
npm run test:ops
npm run test:shop:unit
```

Lint warnings must be reported; zero errors is the blocking condition.

The following require explicit isolated infrastructure:

- `npm run test:shop`: disposable PostgreSQL, non-production
  `SHOP_E2E_BASE_URL`, sandbox/mocked notifications and payments;
- `npm run ops:test:persistence` and `npm run ops:migrations:replay`: disposable
  replay/integration database;
- `npm run build`: an appropriate non-production release catalog database and all
  build-time guards/configuration.

Do not run those broad checks against Production. Read the E2E test and cleanup paths
before execution because API flows can create orders and trigger notifications.

`npm run predeploy-check` is an additional clean-branch/configuration guard and
currently invokes `next build` directly. It does not run the repository's catalog
snapshot wrapper and therefore does not replace a successful `npm run build`/Vercel
build for the exact candidate.

Required evidence:

- clean final diff and Git status;
- reviewed migration SQL with LF line endings;
- migration replay equals `prisma/schema.prisma`;
- relevant test results with exact target environment;
- successful release build for the exact commit;
- no environment files, backups, generated local reports, or private media in the
  deployment manifest.

## Gate 2 — backup and database migration

Follow [the backup guide](../../.github/DATABASE-BACKUPS.md). In order:

1. Record commit SHA and migration file hashes.
2. Confirm provider-managed backup/PITR status.
3. Create an independent custom-format dump through a direct PostgreSQL connection.
4. Verify its listing and restore it into a disposable PostgreSQL 17 target.
5. Run the Phase 0 audit tooling only as a fresh audit; do not trust its historical
   assumptions.
6. Review `prisma migrate status` and every pending SQL file.
7. Obtain separate migration approval.
8. Run `prisma migrate deploy` against the exact approved target.
9. Re-run status and smoke-read catalog, pricing, customers/orders, admin RBAC,
   Operations, and One AI records.

Stop if the plan includes an unapproved drop, rewrite, long lock, or incompatible
commerce change. Never manually edit `_prisma_migrations` to make status green.

## Gate 3 — Production configuration, behavior disabled

Configure Production-scoped secrets without printing or pulling them into a tracked
file. Initial behavior flags:

```text
OPS_UI_ENABLED=0
OPS_LOCAL_DEMO_MODE=0
OPS_TELEGRAM_MANAGER_ENABLED=0
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_JOBS_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

Required sensitive configuration includes distinct 32+ character secrets, the
dedicated `OPS_TELEGRAM_*` bot identity, `OPS_GEMINI_*`, `CRON_SECRET`,
`DATABASE_URL`/`DIRECT_URL`, `OPS_ADMIN_BASE_URL=https://onecompany.global`, and a
dedicated private Operations Blob store.

Forbidden in Production:

```text
OPS_LOCAL_MEDIA_DIR
ALLOW_DEV_ADMIN_PASSWORD_FALLBACK=1
ENABLE_DEV_AUTH_BYPASS=1
ADMIN_BOOTSTRAP_ENABLED=1
SHOP_LOCAL_CATALOG_SNAPSHOT=1
```

Run `npm run ops:prod:check` for repository/config shape. The `canary` readiness mode
is not a disabled-state check: it intentionally expects the owner UI enabled and is
used in Gate 5.

## Gate 4 — exact deployment candidate

For a One AI V2-enabled release, run the protected GitHub workflow
`One AI V2 Release Evaluation` with the exact full commit SHA. The workflow creates
an isolated Vercel Preview from that checkout, evaluates that URL, and produces a
commit- and catalog-bound signed marker. Bind only non-production credentials to
the Preview and keep every Operations action flag disabled.

Verify the exact deployment SHA, build logs, generated catalog snapshot, One AI
release guard, route health, storefront/admin regressions, and absence of secret
values in logs. A Production deployment from this workflow additionally requires
the exact `DEPLOY EVALUATED COMMIT TO PRODUCTION` confirmation. It updates only the
verified marker/fingerprint, deploys the same checkout, and smoke-checks the
canonical product gallery. If code, catalog fingerprint, or relevant environment
changes, restart the gate.

If the project cannot produce a safe candidate without pushing `master`, stop and
change/confirm the Vercel deployment process with the owner first.

## Gate 5 — owner UI canary

After database and candidate acceptance, set only:

```text
OPS_UI_ENABLED=1
OPS_JOBS_ENABLED=0
OPS_TELEGRAM_MANAGER_ENABLED=0
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

With an explicitly approved ignored Production env file, the readiness shape is:

```bash
node --env-file=<ignored-production-env> \
  scripts/operations/check-production-readiness.mjs --mode=canary
```

Verify owner login/current DB permissions, tasks/board/detail/projects/Inbox/БАЗА/
team/system routes, direct URL/API restrictions, 360/390/768 px layouts, private
attachment upload/read/denial/delete, and unchanged catalog/pricing/cart/checkout/
orders/notifications.

## Gate 6 — jobs and Telegram canary

After UI acceptance:

1. Enable `OPS_JOBS_ENABLED=1` and invoke the cron only with explicit approval.
2. Enable `OPS_TELEGRAM_MANAGER_ENABLED=1`.
3. Register the dedicated Operations webhook with its secret.
4. Keep notifications, auto-create, and automations disabled.
5. Send a bounded allowlisted test set: text, reply, forwarded batch, voice, image,
   and PDF.
6. Verify acknowledgment, dedupe, Inbox persistence, transcription, private media
   access, restart recovery, queue drain, and dead-letter visibility.
7. Only then enable `OPS_TELEGRAM_NOTIFICATIONS_ENABLED=1` and verify one-shot
   reminder behavior.

Auto-create and automations remain separate later releases.

## Gate 7 — initial live state

```text
OPS_UI_ENABLED=1
OPS_JOBS_ENABLED=1
OPS_TELEGRAM_MANAGER_ENABLED=1
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=1
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

Validate the exact environment with `check-production-readiness.mjs --mode=live`,
then obtain the separate approval for Production promotion/alias assignment.

## Post-release monitoring

For the first hour, inspect Vercel errors/latency, webhook status, 15-minute job
execution, queue depth/dead letters, duplicate updates/tasks, private Blob access, AI
usage limits, and existing checkout/pricing/order intake. Record the exact deployment
and database migration state.

## Rollback

Behavioral kill switches, in order:

1. `OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0`
2. `OPS_TELEGRAM_MANAGER_ENABLED=0`
3. `OPS_JOBS_ENABLED=0`
4. `OPS_UI_ENABLED=0`

Disable or redirect the webhook after intake is disabled. If application code
regresses the shop, restore the last known-good exact Vercel deployment/alias.
Preserve PostgreSQL data and ship a reviewed forward repair for schema/data issues.

## Approval record

The owner must separately approve:

1. merge/push to `master`;
2. production backup access;
3. production database migration;
4. production environment changes;
5. Operations webhook switch;
6. deployment or alias promotion;
7. rollback that changes external state.
