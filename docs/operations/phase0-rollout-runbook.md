# One Company Operations — Phase 0 migration gate

This runbook is intentionally fail-closed. It does not authorize a production
deployment, a Telegram webhook registration, or a production bot restart.
Run it against staging first, using a direct PostgreSQL connection supplied
through the environment. Never paste connection strings or tokens into logs.

## Why normal `prisma migrate deploy` is currently blocked

The live schema, Git migration directory, and `_prisma_migrations` history are
not yet identical:

- the database already contains the objects introduced by
  `20260710190000_add_shop_ai_knowledge`,
  `20260717143000_add_shop_ai_knowledge_v2`, and
  `20260717170000_add_shop_knowledge_catalog_state`, but those three migration
  names are absent from `_prisma_migrations`;
- the stored checksum for
  `20260415000000_remove_hutko_payment_id` does not match the SQL bytes currently
  available in Git;
- `20260719009000_reconcile_existing_schema_history` is designed to execute on a
  fresh database, but must be recorded as already applied on a verified existing
  database.

Do not run `prisma migrate deploy` on an existing environment until every gate
below passes.

## Gate A — backup and independent restore

1. Confirm the intended Git SHA and a clean deployment worktree.
2. Run `npm run ops:phase0:audit` and retain the sanitized manifest.
3. Run `npm run ops:phase0:backup`.
4. Restore the custom-format dump into a disposable PostgreSQL 17 instance and
   run `npm run ops:phase0:verify-restore`.
5. Compare table and migration counts with the source. A dump that cannot be
   listed and restored is not an acceptable backup.

The generated `backups/ops-preflight/` directory is ignored by Git and must be
copied to the approved encrypted backup location outside the repository.

## Gate B — recover the true applied migration bytes

Recover the exact SQL used for
`20260415000000_remove_hutko_payment_id` from the deployment artifact, original
workstation, or trusted backup. Its SHA-256 must match the checksum stored in
`_prisma_migrations`.

Do not edit `_prisma_migrations` manually and do not replace the stored checksum
with the checksum of a newly reconstructed file. If the original bytes cannot
be recovered, stop and agree a separately reviewed Prisma history-repair
procedure before staging.

Line endings are pinned by `.gitattributes`:

```text
prisma/migrations/**/migration.sql text eol=lf
```

## Gate C — prove the three existing-object migrations

For each of the three migration directories that is missing from history:

1. Read its SQL.
2. Verify every table, column, enum, index, constraint, and trigger exists with
   compatible types in the target database.
3. Save the comparison output in the sanitized Phase 0 report.
4. If any object is missing or incompatible, stop and create a forward-only
   repair migration. Do not mark the migration applied.

Only after all objects match, record the migration in staging using Prisma's
supported history command:

```powershell
npx prisma migrate resolve --applied 20260710190000_add_shop_ai_knowledge
npx prisma migrate resolve --applied 20260717143000_add_shop_ai_knowledge_v2
npx prisma migrate resolve --applied 20260717170000_add_shop_knowledge_catalog_state
```

## Gate D — reconcile the existing schema

Generate a read-only diff from the verified existing database to
`prisma/schema.prisma`. It must contain only the new Ops objects. It must not
drop or alter an existing commerce table, column, enum, index, or constraint.

When the existing database already contains every legacy object represented by
the reconciliation migration, record that migration as applied:

```powershell
npx prisma migrate resolve --applied 20260719009000_reconcile_existing_schema_history
```

On a fresh empty database, do not resolve it. The migration must execute
normally so a fresh replay remains reproducible.

## Gate E — stage the Ops migrations

Keep all Ops rollout flags disabled, then run in staging:

```powershell
npx prisma migrate status
npx prisma migrate deploy
```

The deploy should apply only the Ops migrations that are not already recorded:

1. `20260719010000_add_ops_board_foundation`
2. `20260719011000_add_ops_knowledge_base`
3. `20260719012000_add_ops_telegram_intake_jobs`
4. `20260719013000_add_ops_automation_approvals_usage`
5. `20260720123000_simplify_ops_human_task_workflow`
6. `20260720180000_add_ops_telegram_batches`
7. `20260720183000_remove_ops_telegram_batch_item_limit`
8. `20260722010000_add_ops_shared_tasks`
9. `20260722020000_default_ops_task_deadline`

Run `npm run ops:migrations:replay` against a disposable fresh database and
confirm the replay matches `prisma/schema.prisma`.

## Gate F — staging acceptance

- run the Ops, admin RBAC, shop unit/integration/E2E, typecheck, and build gates;
- verify checkout, order intake, pricing snapshots, B2C/B2B discounts,
  shipments, and status emails are unchanged;
- enable `OPS_UI_ENABLED` for the owner only;
- keep `OPS_TELEGRAM_MANAGER_ENABLED`,
  `OPS_TELEGRAM_NOTIFICATIONS_ENABLED`,
  `OPS_TELEGRAM_AUTO_CREATE_ENABLED`, `OPS_AUTOMATIONS_ENABLED`, and
  `OPS_JOBS_ENABLED` disabled;
- complete the owner UI canary before registering a new Lab-bot webhook.

Production remains blocked until staging evidence is accepted. Feature flags
are the rollback mechanism for application behavior; the database migrations
are forward-only and must not be rolled back with destructive SQL.

## Gate G — release candidate without merge

Keep the work on `concept/unified-site-performance`. Do not merge it and do not
run `vercel --prod` while storefront changes are still in progress.

Before calling the branch a release candidate:

1. Track every intended Prisma migration and Ops source file in Git.
2. Review the diff by domain: data, access, Ops domain, Ops UI, Telegram/jobs,
   and verification. Do not mix generated backups or local media into commits.
3. Run `npm run typecheck`, `npm run test:ops`, `npm run test:shop`, and
   `npm run build`.
4. Require every suite to be green. Known or unrelated storefront failures are
   still release blockers until the pending storefront work is complete.
5. Deploy a Preview manually because `vercel.json` intentionally ignores
   automatic deployments from non-`master` branches.
6. Keep production Ops variables absent or set to `0`; configure the dedicated
   `OPS_*` values only in Preview/Staging.

The first staging canary must use:

```text
OPS_UI_ENABLED=1
OPS_JOBS_ENABLED=0
OPS_TELEGRAM_MANAGER_ENABLED=0
OPS_TELEGRAM_NOTIFICATIONS_ENABLED=0
OPS_TELEGRAM_AUTO_CREATE_ENABLED=0
OPS_AUTOMATIONS_ENABLED=0
```

Enable jobs only after the owner UI flow passes. Register the Lab webhook last,
with auto-create and automations still disabled.

## Private attachment store

Ops voice messages, images, and documents must use a dedicated **private**
Vercel Blob store. The existing public storefront Blob token is not a valid
substitute.

1. Create a private Blob store for One Company Operations.
2. Connect it to the Preview environment and set its id as
   `OPS_BLOB_STORE_ID`. Vercel runtime uses its short-lived
   `VERCEL_OIDC_TOKEN`; a long-lived Blob token is not required.
3. Do not set `OPS_LOCAL_MEDIA_DIR` in Preview or production.
4. Validate `upload → read → checksum → delete` on the first Preview deployment.
   Local development OIDC tokens are development-scoped and cannot access a
   Preview-only store. `OPS_BLOB_READ_WRITE_TOKEN` remains an optional local
   fallback for an isolated private store and must never be exposed client-side.
5. Open `/admin/operations/system` and verify that the attachment status is
   `Vercel Blob` before enabling Telegram media intake.

The local Lab intentionally keeps `OPS_LOCAL_MEDIA_DIR` enabled and therefore
does not upload test conversations to Vercel.

## Local UI demo without Ops database mutations

To review the approved Operations layout against local demo records, run:

```powershell
npm run ops:demo
```

If another local Next.js process already uses port 3000, use:

```powershell
npm run ops:demo -- -p 3001
```

This runner enables only the development UI/demo flags. Telegram intake,
notifications, auto-create, jobs, and automations are forced off. It must never
be used as staging acceptance evidence or as a substitute for the migration
gates above.
