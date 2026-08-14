# Claude adapter — OneCompany

This file is a short adapter, not an independent rule set. Read, in order:

1. `AGENTS.md` — canonical safety and implementation rules;
2. `.agents/PROJECT_CONTEXT.md` — current architecture and persistence map;
3. `.agents/agents.md` — task-to-file routing;
4. only the matching workflow under `.agents/workflows/`.

The current application uses Next.js 16/React 19, Tailwind CSS 4, Prisma 6 with
PostgreSQL, `src/proxy.ts`, localized `ua`/`en` routes, customer NextAuth, and a
separate DB-backed admin RBAC system. Do not revive old assumptions about
`src/middleware.ts`, `src/messages/`, Supabase, Tailwind 3, or `ADMIN_SECRET` as the
admin login.

## Project wiki

`wiki/` contains historical decisions, brand research, and incident notes. It is
supporting context only; current code and canonical docs win when they disagree.

- Read the smallest relevant wiki note when historical context is useful.
- Write to `wiki/` only when the user explicitly requests documentation or a
  repository-wide documentation refresh.
- Keep Obsidian wikilinks inside the vault and normal Markdown links for external
  URLs.
- Open the vault by selecting this repository's `wiki/` directory on the current
  machine; no fixed Windows or macOS path is canonical.

## Safety reminders

Local, Preview, and Production are separate. Do not pull Production secrets, mutate
external integrations/data, run migrations, commit, push, or deploy without explicit
authorization for that exact action. Preserve unrelated working-tree changes and
report which checks actually ran.
