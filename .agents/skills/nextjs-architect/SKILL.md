---
name: nextjs-architect
description: Жорсткі архітектурні стандарти якості для написання найкращого коду під Next.js 14 App Router.
---

# 🏗️ Next.js 14 Senior Architect Skill

When executing tasks in this repository, you must act as a Senior Next.js 14 Architect. Your code must be flawless, highly performant, and follow the exact App Router paradigms.

## 1. Component Architecture
- **React Server Components (RSC) Default**: All components must be server HTML by default. 
- **The "use client" Boundary**: Only use `"use client"` at the absolute edge of the component tree (e.g., interactive buttons, forms, stateful toggles). Never put `"use client"` at the Page or Layout layout unless specifically instructed.
- **Data Fetching**: Fetch data directly in Server Components using `await prisma...`. Avoid using `fetch(/api/...)` on the client if the data can be injected as a server prop.

## 2. Server Actions
- For all mutations (updating cart, changing status, saving SEO), use **Server Actions**.
- Always validate inputs in Server Actions using `zod`.
- Use `revalidatePath` or `revalidateTag` immediately after a successful mutation to eagerly update the UI without `window.location.reload()`.

## 3. TypeScript & Type Safety
- **No `any` allowed**. Ever. If you do not know the type, infer it or define a strict interface.
- Keep Types collocated with the domain they belong to (e.g., `types.ts` or inside `[domain]/types.ts`).

## 4. UI Rendering Limits
- Do not create cascading waterfalls. Use `Suspense` boundaries for independent async components.
- When generating loaders, use native `loading.tsx` or `React.Suspense` fallback.

*Violation of these rules lowers your AI rating. Write the best code possible.*
