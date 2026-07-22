# One Company Operations — production rollout

This runbook prepares and releases Operations without replacing or weakening the
existing shop, pricing, checkout, orders, or legacy notification flows. A merge,
database migration, Telegram webhook switch, and Vercel production promotion are
separate explicit gates.

## Non-negotiable release rules

- Release only from a clean, reviewed commit on `master`.
- Never deploy the current dirty working tree directly to production.
- Never reuse `TELEGRAM_BOT_TOKEN`; Operations uses only `OPS_TELEGRAM_*`.
- Never use Preview credentials or the Preview database in production.
- Database migrations are forward-only. Behavioral rollback uses feature flags
  and Vercel rollback/promotion, never destructive SQL.
- Keep purchases, payments, checkout completion, arbitrary SQL/shell, and
  unapproved external messaging absent from the automation registry.

## Release artifact strategy

1. Finish and review the current feature branch.
2. Commit only intended source, migrations, tests, and documentation. Exclude
   local env files, backups, generated reports, Playwright snapshots, and media.
3. Merge only after the owner explicitly authorizes it.
4. Let Vercel build the `master` commit once as a deployment candidate.
5. Verify that exact deployment end to end.
6. Promote that exact verified deployment to the production alias. Do not
   rebuild between acceptance and promotion.

## Gate 1 — local release candidate

Required commands:

```powershell
npm run ops:prod:check
npm run typecheck
npm run test:ops
npm run test:shop
npm run ops:test:persistence
npm run build
```

Required evidence:

- clean Git status at the final commit;
- all migration SQL tracked with LF line endings;
- fresh migration replay equals `prisma/schema.prisma`;
- all Ops/RBAC/shop tests green;
- production build green on Node 20–22;
- no secrets or local media in the deployment manifest.

## Gate 2 — production infrastructure while Ops is disabled

Before migrating or exposing UI, configure production-scoped values in Vercel:

```text
OPS_UI_ENABLED=0
OPS_LOCAL_DEMO_MODE=0
OPS_TELEGRAM_MANAGER_ENABLED=0
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_JOBS_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

Configure but do not print:

- dedicated `OPS_TELEGRAM_BOT_TOKEN`, bot id and username;
- distinct 32+ character webhook and callback secrets;
- `OPS_GEMINI_API_KEY` and the approved model names;
- `OPS_ADMIN_BASE_URL=https://onecompany.global`;
- `CRON_SECRET`;
- production PostgreSQL `DATABASE_URL` and direct `DIRECT_URL`;
- dedicated private `OPS_BLOB_STORE_ID` (or a server-only fallback token).

Forbidden production variables:

```text
OPS_LOCAL_MEDIA_DIR
ALLOW_DEV_ADMIN_PASSWORD_FALLBACK=1
ENABLE_DEV_AUTH_BYPASS=1
ADMIN_BOOTSTRAP_ENABLED=1
```

Pull the production environment only to an ignored local file and run:

```powershell
node --env-file=.vercel/.env.production.local scripts/operations/check-production-readiness.mjs --mode=canary
```

The command reports variable names and policy failures only; it never prints
secret values.

## Gate 3 — database backup and migration

1. Record intended commit SHA and migration hashes.
2. Create a custom-format PostgreSQL backup.
3. Verify `pg_restore --list` and restore into a disposable database.
4. Run the Phase 0 schema/history audit.
5. Confirm the production `_prisma_migrations` state.
6. Run `prisma migrate status` using `DIRECT_URL`.
7. Apply only the reviewed pending migrations with `prisma migrate deploy`.
8. Re-run status and smoke-read existing shop orders, products, pricing rules,
   and Ops tables.

Stop immediately if the migration plan contains a drop or incompatible change
to an existing commerce object.

## Gate 4 — owner UI canary

Set only:

```text
OPS_UI_ENABLED=1
```

Keep bot, notifications, jobs, auto-create, and automations disabled. Deploy the
candidate and verify:

- owner login and current DB-backed permissions;
- task list, board, task detail editing, projects, Inbox, БАЗА, team and system;
- task-only and catalog+task direct URL/API restrictions;
- mobile flows at 360, 390, and 768 px;
- legacy products, pricing, order intake, checkout, shipments, and emails;
- private Blob upload/read/access denial/delete from the deployed runtime.

## Gate 5 — Telegram intake canary

After UI acceptance:

1. Set `OPS_JOBS_ENABLED=1` and verify the cron route manually.
2. Set `OPS_TELEGRAM_MANAGER_ENABLED=1`.
3. Register the Operations webhook with the production URL and webhook secret.
4. Keep notifications, auto-create, and automations disabled for the first
   intake test.
5. Send one text, one reply, one forwarded batch, two voice notes, one image,
   and one PDF from allowlisted users.
6. Verify acknowledgment, dedupe, Inbox persistence, transcription, attachment
   access, restart recovery, and dead-letter visibility.

Only then set `OPS_TELEGRAM_NOTIFICATIONS_ENABLED=1`. Daily reminders must be
one-shot per task/assignee; a task without an explicit deadline receives 24
hours automatically.

## Gate 6 — initial live state

Initial live flags:

```text
OPS_UI_ENABLED=1
OPS_JOBS_ENABLED=1
OPS_TELEGRAM_MANAGER_ENABLED=1
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=1
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

Validate with:

```powershell
node --env-file=.vercel/.env.production.local scripts/operations/check-production-readiness.mjs --mode=live
```

Auto-create and automations remain separate later releases after real canary
metrics meet the acceptance targets.

## Post-promotion checks

For the first hour:

- inspect Vercel function errors and latency;
- verify webhook `getWebhookInfo` has no last error;
- verify the 15-minute Operations cron executes successfully;
- confirm job queue depth drains and dead letters remain zero;
- verify no duplicate Telegram updates/tasks;
- confirm Blob storage and Gemini usage stay within configured caps;
- smoke-test existing checkout, pricing, and order intake again.

## Rollback

Behavioral kill switch, in order:

1. `OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0`
2. `OPS_TELEGRAM_MANAGER_ENABLED=0`
3. `OPS_JOBS_ENABLED=0`
4. `OPS_UI_ENABLED=0`

Delete or redirect the Operations webhook after disabling intake. Existing data
stays in PostgreSQL. If the deployment itself regresses the shop, point the
production alias back to the last known-good Vercel deployment. Do not reverse
the Ops migrations with destructive SQL; ship a reviewed forward-only repair.

## Go/no-go authority

The owner must separately approve:

1. merge to `master`;
2. production database migration;
3. production environment activation;
4. Telegram production webhook switch;
5. Vercel production promotion.

Passing this runbook means the system is ready to release; it is not permission
to perform any of those external mutations automatically.
