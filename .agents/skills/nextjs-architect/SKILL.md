---
name: nextjs-architect
description: Next.js 16 App Router rules for OneCompany.
---

# Next.js 16 App Router

## Component architecture
- Server Components by default. `"use client"` only at interactive leaves (forms, stateful toggles, components using browser-only APIs). Never on a Page or Layout unless something inside it forces it.
- Fetch data in Server Components (e.g. `await prisma.shopProduct.findMany()`). Don't call internal `/api/...` routes from the client just to get data the server already has.

## Mutations
- Server Actions for internal mutations (cart updates, order state, SEO edits). Validate input with `zod`.
- After a successful mutation, call `revalidatePath()` or `revalidateTag()` — not `window.location.reload()`.
- Route Handlers under `src/app/api/` are for external callers (webhooks, integrations, cron).

## Types
- No `any`. Infer from Prisma types or define an interface next to the domain (`[domain]/types.ts`).

## Loading & rendering
- Avoid request waterfalls — wrap independent async work in separate `Suspense` boundaries.
- Use `loading.tsx` or a `Suspense` fallback for async UI; do not render manual skeleton flags from client state when the route can stream.
