---
description: OneCompany production, data, commerce, and integration guardrails
---

# Project guardrails

The root `AGENTS.md` is authoritative. These are the task-level restrictions
that most often prevent production mistakes.

## Environment and production

- Local, Preview, and Production are separate targets. Resolve the target before
  using credentials or interpreting data.
- Never pull Production secrets, edit Production data, run migrations, dispatch
  jobs, register webhooks, or deploy without explicit authorization for that
  exact action.
- Never print connection strings, tokens, passwords, customer data, session
  cookies, or full credential-bearing responses.
- Development auth bypasses and local demo flags must fail closed in Production.

## PostgreSQL and Prisma

- `prisma/schema.prisma` and tracked migrations define the intended schema.
- Use forward migrations. Do not use `prisma db push`, destructive ad hoc SQL,
  or manual edits to `_prisma_migrations` on shared environments.
- A Production migration requires a verified backup/restore, migration status,
  reviewed SQL, and separate owner approval.
- Tests that persist data must use an explicitly disposable database.

## Admin and RBAC

- The admin cookie proves signed identity; current roles and permissions come
  from PostgreSQL.
- Every protected API must enforce the narrow permission from
  `src/lib/admin/adminPermissions.ts`.
- Product writes must preserve relation IDs, validate references, honor deletion
  blockers, write audit logs, and revalidate canonical storefront paths.
- `ADMIN_SECRET` and `ADMIN_API_SECRET` are service/legacy endpoint secrets,
  not replacements for admin RBAC.

## Commerce

- Keep B2C, B2B, Europe pricing, VAT, currency rates, discounts, and quote modes
  explicit.
- Use shop pricing/money helpers end to end. Do not hardcode exchange rates, VAT,
  compare-at values, or “price on request” decisions in UI components.
- Variant price fields may be null and inherit the product price.
- Verify product page, list page, cart, checkout, order pricing snapshot, email,
  and admin effects together for pricing changes.
- Never run checkout E2E tests against Production.

## Catalog and media

- PostgreSQL is the editable catalog. Generated snapshots/indexes are fallback
  artifacts and must not be hand-edited.
- Check `SHOP_PRODUCT_IMAGE_OVERRIDES` before assuming a DB image edit will win.
- Storefront product imagery must be real and approved. No stock filler,
  placeholder, or AI-generated product imagery.
- Runtime uploads use Blob when configured. Deletion must check references first.
- Legacy JSON content/media/video writes are not durable on Vercel; do not claim
  persistence that the storage layer does not provide.

## Airtable and other integrations

- Normal Airtable runtime flows are import/read paths that persist normalized
  records in PostgreSQL.
- Legacy/manual Airtable export scripts can perform POST/PATCH writes. Never run
  them without explicit owner approval and verification of base/table/dry-run
  behavior.
- External writes include payment creation, email/Telegram sends, Shopify
  operations, CRM webhooks, Blob upload/delete, supplier commits, and workflow
  dispatches. Read the exact implementation and confirm authorization first.
- Preserve webhook authentication, rate limits, idempotency, and auditability.

## Application code

- Follow current Next.js 16 and repository patterns. Server Components are the
  default for data rendering, but existing Route Handlers are the normal mutation
  boundary for many domains.
- Do not add a dependency or framework when an existing local helper solves the
  task.
- Avoid direct DOM mutation and full-page reloads when React/Next navigation can
  express the behavior.
- Keep UA/EN customer-facing behavior in parity and use the current
  `src/lib/messages/` or paired localized fields.
- Do not weaken auth, validation, release guards, error semantics, or tests merely
  to make a check pass.

## Git and generated material

- Preserve unrelated dirty-worktree changes.
- Do not edit generated snapshots, `.next`, ignored local catalog shards, build
  output, backups, or archived artifacts as source files.
- Commit, push, merge, workflow dispatch, migration, and deployment are separate
  actions and require explicit user intent.
