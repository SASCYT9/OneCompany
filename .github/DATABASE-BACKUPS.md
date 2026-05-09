# Database backups

The OneCompany production database lives on **Prisma Postgres** (`db.prisma.io`).
We rely on **Prisma's built-in snapshot system** as the primary backup. We do
**not** maintain a custom `pg_dump`-based backup workflow in GitHub Actions —
it duplicates Prisma's snapshots, ages out as `pg_dump` versions drift, and
puts the production `DATABASE_URL` into a second secret store (extra attack
surface for no benefit).

## Where to find snapshots

1. Open the [Prisma Cloud console](https://console.prisma.io/).
2. Select the OneCompany project → **Postgres** → the production database.
3. **Backups / Snapshots** tab — daily snapshots are listed by date.
4. Restore via the UI (creates a new database from the chosen snapshot, which
   you can then promote, or compare against the live DB).

Reference: [Backups in Prisma Postgres](https://www.prisma.io/docs/postgres/database/backups).

## Snapshot policy (Prisma-side)

- Snapshots are created **daily**, only on days with database activity.
- The number of retained snapshots depends on the active plan (Pro / Business).
- **Point-in-time recovery is NOT currently available** — recovery point is
  the last snapshot, so changes between the latest snapshot and an incident
  may be lost.

## When to consider an independent backup

Add a vendor-independent backup if any of these become true:

- Regulatory or contractual requirement to keep data outside Prisma.
- RPO requirement tighter than ~24 hours (current Prisma snapshots cap RPO at
  one day).
- Business continuity plan requires the ability to restore without Prisma's
  console (e.g., for migration to another provider).

In that case, do **not** put it in GitHub Actions. Better options:

1. A scheduled job on a small VM or Fly.io machine running `pg_dump` and
   uploading to Cloudflare R2 / Backblaze B2 / S3 with bucket-level
   versioning + lifecycle expiry.
2. A managed backup service: [SimpleBackups](https://simplebackups.com/),
   [SnapShooter](https://snapshooter.com/), or similar — they handle
   `pg_dump` version drift, encryption-at-rest, and retention policies.

## Manual on-demand dump (rare cases)

If you need a one-off local snapshot for testing or analysis, run from a
trusted workstation with `DATABASE_URL` in your environment:

```bash
# Custom format, max compression — restore with pg_restore -j 4
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  --format=custom \
  --compress=9 \
  --file="onecompany-$(date -u +%Y%m%d-%H%M%S).dump"
```

**Never** commit dumps to git or share them in chat — they contain customer
data subject to GDPR. Treat dumps as production secrets: encrypt in transit,
delete promptly when done.
