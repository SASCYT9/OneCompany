---
description: Comprehensive codebase + UI audit
---

# System audit

Trigger: user asks for `/system-audit`.

## 1. Static checks
- `npm run lint` — surface the top critical errors.
- `npx prisma validate` and `npx prisma format` — confirm the schema is healthy.

## 2. Dependency tracing
Pick one core flow (e.g. `src/app/api/shop/checkout/route.ts`).
- Trace its imports.
- Flag hardcoded prices, dead imports, or non-localized hard-coded strings that should live in `src/lib/messages/`.

## 3. Live UI check
Use the Claude Preview MCP (`mcp__Claude_Preview__preview_*`) against the running dev server:
- Navigate to `http://localhost:3000/ua/shop`, click through 2–3 product pages, add one item to the cart.
- `preview_console_logs` for hydration errors / runtime warnings.
- `preview_screenshot` for layout regressions.

## 4. Report
Combine the static findings + live-UI observations into one summary for the user. Lead with anything blocking; sort the rest by severity.
