---
name: nextjs-architect
description: Next.js 16 App Router rules for OneCompany.
---

# Next.js 16 App Router

Repository-specific reference. Read `AGENTS.md` and the owning route before applying
it.

## Routing and rendering

- Server Components are the default. Add `"use client"` at the smallest interactive
  boundary that needs state, effects, context, or browser APIs.
- Public localized routes live in `src/app/[locale]/`; canonical PDP and paginated
  routes may live in `src/app/(strict-http)/[locale]/`.
- `src/proxy.ts`, not `src/middleware.ts`, owns request normalization and locale
  handling. Use `src/i18n/routing.ts` and `src/navigation.ts` for localized links.
- Follow Next.js 16 async request APIs and the parameter shape already used by
  neighboring routes.
- Fetch server-owned data directly in Server Components or server helpers. Do not
  add a client request to an internal API only to retrieve data already available on
  the server.

## Mutations

- This repository intentionally uses Route Handlers for admin, cart, checkout,
  webhook, cron, and integration mutations. Extend the existing boundary instead of
  converting flows to Server Actions by default.
- Reuse local parsing and validation helpers. `zod` is not currently a dependency;
  do not add it solely to satisfy generic guidance.
- Preserve authentication, narrow RBAC, CSRF/origin checks, idempotency, status-code
  semantics, transaction boundaries, and audit logs.
- After a successful catalog mutation, use the established revalidation helper for
  canonical UA/EN routes. Do not rely on `window.location.reload()` as cache repair.

## Types

- Prefer current domain and Prisma types. Avoid introducing `any`; when an external
  boundary is unknown, validate and narrow it explicitly.
- Keep server-only modules out of client bundles.

## Caching and verification

- Storefront catalog code combines ISR, in-process caching, optional Prisma
  Accelerate cache options, generated indexes, and fallback shards. Trace the owning
  helper before adding `cache`, `unstable_cache`, or `no-store` behavior.
- Parallelize independent server reads when useful; use route loading or `Suspense`
  only where it improves real streaming behavior.
- Verify both `ua` and `en`, expected HTTP/cache behavior, and the browser console for
  user-visible changes.
