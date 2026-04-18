---
description: Comprehensive codebase and UI audit macro
---

# 🕵️ Workflow: System Audit

When the user asks you to `/system-audit`, execute the following strict sequence.

## 1. Static Analysis
Run automated tools against the codebase:
- Run `npm run lint` and output the top 10 most critical errors.
- Run `npx prisma validate` and `npx prisma format` to ensure the core database schema is healthy.

## 2. Dependency Tracing
Pick one core flow (e.g. `src/app/api/shop/checkout/route.ts`).
- Trace all its imports.
- Look for hardcoded prices, dead imports, or non-localized text strings.

## 3. Visual UI Audit
Spawn the `browser_subagent`.
- Task it to open `http://localhost:3000/ua/shop`.
- Tell it to click through 3 random product pages and add one to the Cart.
- Return the visual screenshot and console logs to check for Hydration Errors or misaligned components.

## 4. Report Generation
- Combine the static analysis and subagent visual check into a walkthrough artifact.
- Present it to the user.

