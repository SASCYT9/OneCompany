---
description: End-to-end architecture, code, data-flow, and UI audit for OneCompany
---

# System audit

Use this only for a repository-wide or end-to-end audit. Read `AGENTS.md`,
`.agents/PROJECT_CONTEXT.md`, and `.agents/workflows/auto_audit.md` first.

## 1. Reconstruct current architecture

Derive facts from the current checkout, not old documentation:

- versions and commands from `package.json` and the lockfile;
- routes and runtime boundaries from `src/app/`, `src/proxy.ts`, and Next config;
- persistence from `prisma/schema.prisma`, migrations, storage helpers, and generated
  artifact code;
- authentication and permissions from customer auth, admin session, DB identity,
  and route-level guards;
- deploy behavior from `vercel.json`, build scripts, and GitHub workflows;
- environment requirements from actual `process.env` usage and `.env.example`.

Classify `wiki/`, `archive/`, `backups/`, `artifacts/`, `reference/`, generated
snapshots, and one-off scripts as historical/supporting unless active code proves
otherwise.

## 2. Trace critical flows end to end

At minimum inspect:

1. storefront catalog read: PostgreSQL → mapping/overrides/cache → PLP/PDP;
2. product admin write: session → DB RBAC → validation/transaction/audit →
   revalidation;
3. price path: product/variant inheritance → B2C/B2B/Europe/VAT → cart → checkout →
   immutable order snapshot;
4. customer and admin authentication as separate systems;
5. media persistence: tracked `public/`, runtime Blob, and legacy JSON editors;
6. build/deploy snapshots, One AI release guard, cron routes, and external side
   effects.

## 3. Static and test checks

Follow `.agents/workflows/auto_audit.md`. Run broad checks only where the environment
is safe. Never use Production to make an audit pass.

Review security-sensitive boundaries for authentication, authorization, CSRF,
validation, idempotency, secret exposure, logging of personal data, and fail-open
fallbacks. Do not mutate external systems while inspecting them.

## 4. Live UI inspection

If a local or explicitly approved non-production server is available, use the
installed browser-control capability. Verify representative UA and EN pages, the
specific admin flow when suitable test credentials exist, console/network errors,
mobile layout, and cache/revalidation behavior.

Do not use obsolete tool names from old documentation, and do not test login,
checkout, payment, messaging, imports, or destructive admin actions against
Production without separate explicit authorization.

## 5. Documentation reconciliation

When the audit exposes stale instructions, update the canonical files in this order:

1. `AGENTS.md`;
2. `.agents/PROJECT_CONTEXT.md` and `.agents/agents.md`;
3. matching workflow/skill adapters;
4. `README.md`, `.env.example`, contributor/security/operations docs;
5. historical wiki pages only when the user explicitly asked for documentation
   refresh, as in a repository-wide audit.

Do not copy account/provider claims that source code cannot prove. Mark dashboard-
only facts as items to verify in the intended provider console.

## 6. Report

Lead with confirmed blockers or production risks. Separate:

- verified current behavior;
- stale documentation corrected;
- defects or debt still present;
- checks run and checks intentionally skipped;
- external facts that still require provider-dashboard access.
