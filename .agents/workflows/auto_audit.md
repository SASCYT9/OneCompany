---
description: Run a quick code-health check (types + lint) when the user asks for an audit.
---

# Auto-audit

Trigger: user asks "run an audit", "check if everything is ok", or "verify your code".

1. Run `npx tsc --noEmit` for full-repo type safety.
2. Run `npm run lint`.
3. If either reports errors, read the failing files, fix them, and re-run step 1.
4. Stop and report only when both pass cleanly, or when the failure is unfixable from the code (missing dep, external API outage) — in that case explain what's blocking.
