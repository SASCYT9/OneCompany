# Database backup and recovery

Reviewed against the repository on 2026-08-14.

OneCompany uses PostgreSQL through Prisma, but the active Production database
provider, plan, retention window, and point-in-time-recovery capability are external
account settings and cannot be established from this repository. Verify them in the
intended provider dashboard before relying on any recovery claim.

## Required operating model

- Treat the provider's managed backups/PITR as the primary continuous recovery
  mechanism only after confirming they are enabled and testing access.
- Before a production migration or high-risk bulk data change, take an independent
  custom-format PostgreSQL dump and restore it into a disposable database.
- Record the source environment, exact Git SHA, migration hashes, archive checksum,
  schema/table counts, operator, and verification time without recording credentials.
- Store backups outside the repository in approved encrypted storage with restricted
  access, retention, and deletion controls.
- Define and review business RPO/RTO separately. The repository does not currently
  prove an approved RPO, RTO, retention policy, or disaster-recovery owner.

A backup is not verified merely because a file exists. `pg_restore --list` and a
successful isolated restore are minimum evidence.

## Repository tooling

The Operations Phase 0 tooling implements a guarded PostgreSQL 17 dump and restore
check. Despite the historical command names, it is the current in-repository
independent-backup implementation:

- `npm run ops:phase0:audit` reads the configured database, hashes migrations/schema,
  and writes a sanitized manifest;
- `npm run ops:phase0:backup` runs `pg_dump` in `postgres:17`, creates a compressed
  custom archive, verifies its listing, and writes a SHA-256 manifest;
- `npm run ops:phase0:verify-restore` restores the archive to a disposable
  `postgres:17` container and records table/migration counts.

These commands are not permission to connect to Production. They require Docker and
an explicitly selected ignored environment file. `DIRECT_URL` is preferred, with
`DATABASE_URL` as fallback. Never put a pooled/Accelerate URL into `pg_dump` if the
provider requires a direct PostgreSQL endpoint.

Example shape after the owner has separately approved the exact source database:

```bash
npm run ops:phase0:audit -- \
  --env=.env.production.local \
  --label=production-pre-migration

npm run ops:phase0:backup -- \
  --env=.env.production.local

npm run ops:phase0:verify-restore -- \
  --archive=backups/ops-preflight/<timestamp>/onecompany-pre-operations.dump \
  --expected-tables=<audited-table-count> \
  --expected-migrations=<audited-migration-count>
```

The scripts deliberately restrict output to ignored `backups/ops-preflight/`. Copy
the resulting archive and manifests to approved encrypted storage, verify the copied
checksum, then remove local copies according to the approved retention procedure.
Do not commit, upload to a PR artifact, paste into chat, or place a production dump
in ordinary cloud-drive sharing.

## Production migration gate

Before applying migrations:

1. Confirm the target hostname/database from a redacted read-only inspection.
2. Confirm the exact clean, reviewed commit and pending migration SQL.
3. Verify provider-managed backup/PITR status in the provider dashboard.
4. Create the independent dump and complete a disposable restore.
5. Review the migration plan for drops, rewrites, long locks, and commerce impact.
6. Obtain separate owner approval for the production migration.
7. Apply only tracked forward migrations through `prisma migrate deploy`.
8. Re-check migration status and smoke-read catalog, pricing, customers/orders,
   admin RBAC, Operations, and One AI state.

Never use `prisma db push`, manually edit `_prisma_migrations`, or run destructive
repair SQL on a shared environment to bypass a failed gate.

## Recovery procedure

During an incident:

1. Stop or disable the writer that is worsening data loss.
2. Preserve logs, deployment SHA, migration state, and timestamps.
3. Choose the recovery point using the confirmed provider backup/PITR inventory and
   independent archives.
4. Restore to an isolated target first; never overwrite the only live copy as the
   first recovery step.
5. Validate schema history, record counts, critical relational integrity, and sampled
   catalog/order/admin flows.
6. Decide whether to promote the restored database or apply a reviewed forward data
   repair.
7. Rotate any credentials exposed during the incident and record the final recovery
   evidence outside Git.

Customer and order data in a dump is sensitive personal/commercial data. Apply least
privilege, encryption in transit and at rest, audit logging, and secure deletion.
