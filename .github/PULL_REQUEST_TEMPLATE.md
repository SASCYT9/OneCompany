<!--
PR title must follow Conventional Commits, e.g.:
  feat(shop): add tiered shipping calculator for premium brands
  fix(cart): prevent double-submit on checkout
  chore(deps): bump next from 16.2.4 to 16.3.0

See .github/CONTRIBUTING.md for details.
-->

## Summary

<!-- 1–3 bullets: what changed and why. -->

-
-

## Type of change

<!-- Check one. -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `perf` — performance improvement
- [ ] `refactor` — internal change, no behavior change
- [ ] `docs` — documentation
- [ ] `test` — tests only
- [ ] `build` / `ci` / `chore` — tooling, deps, infra

## Linked issues

<!-- e.g. Closes #123, Refs #456 -->

## Production safety checklist

- [ ] Target environment/database and external side effects are identified
- [ ] No Production data, migration, import, webhook, payment, message, or deploy was
      changed merely for testing
- [ ] Prisma changes use reviewed forward migrations and include backup/rollout notes
- [ ] Product/price changes preserve UA/EN, variant inheritance, B2C/B2B/Europe, and
      storefront revalidation where applicable
- [ ] No secrets, customer/order data, environment files, backups, or local media are
      committed
- [ ] `.env.example` and maintained docs are updated for configuration changes
- [ ] Manual Vercel Preview for the exact commit is linked below, or marked N/A
      (`vercel.json` skips automatic non-`master` builds)

## Test plan

<!-- List exact commands, browser routes, environment type, warning counts, and
anything intentionally skipped. Do not use Production checkout/imports as tests. -->

- [ ]
- [ ]

## Screenshots / recordings

<!-- For UI changes. Drag images here. Delete this section if N/A. -->

## Breaking changes

<!-- If yes, describe the migration path. Otherwise: "None." -->

None.

## Deployment notes

<!-- Anything reviewers / deployers need to know? Feature flags, env-var changes,
     migrations, cache/revalidation, manual Preview, external side effects, ordering,
     and rollback. Otherwise: "None." -->

None.
