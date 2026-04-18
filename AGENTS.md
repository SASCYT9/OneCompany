> Master repo instructions for OneCompany. Keep this file short, factual, and project-specific.

# OneCompany Agent Rules

## 1. Load Order
- Read [`.agents/PROJECT_CONTEXT.md`](D:/OneCompany/.agents/PROJECT_CONTEXT.md) first for the current technical and business snapshot.
- Read only the wiki pages relevant to the task, starting from `wiki/Architecture.md`, `wiki/Codebase Architecture.md`, and `wiki/SOP - Standard Operating Procedures.md`.
- Use `.agents/workflows/` only when the task matches an existing repeatable workflow.
- Use only the curated skills in `.agents/skills/`.

## 2. Operating Model
- Think first, trace dependencies before editing, and follow data flow end-to-end.
- Prefer repo facts over generic framework habits.
- Do not start a new dev server if one is already running on `localhost:3000` or `localhost:3001`.
- Keep repo-level context compact. Do not load large skill packs or broad reference trees unless explicitly needed.

## 3. Source Of Truth
- `wiki/` is the project brain for SOPs, operations, architecture, and domain rules.
- `prisma/schema.prisma` is the database source of truth.
- `src/app/[locale]/shop/components` contains the main storefront building blocks.
- `messages/en.json` and `messages/ua.json` are the translation source of truth for UI copy.

## 4. Technical Guardrails
- Stack: Next.js 14 App Router, React, Tailwind, Framer Motion, Prisma, PostgreSQL/Supabase.
- Prefer Server Components by default. Use Client Components only for interactivity.
- Use Server Actions or Route Handlers according to the existing architecture.
- No general-purpose UI frameworks like Material UI or Chakra.
- Do not write to external systems unless the task explicitly requires it and the repo workflow supports it.
- Never modify production data directly. Use Prisma migrations for schema changes.

## 5. Commerce Rules
- Currency output must go through the shop currency helpers. Do not hardcode taxes, VAT, or regional pricing copy.
- WhitePay is the active payment direction in project architecture. Do not reintroduce removed payment flows without explicit instruction.
- Turn14 and other supplier integrations must be treated carefully and traced through existing local sync logic.
- B2B and B2C logic must stay separated where pricing, accounts, and approvals differ.

## 6. UX And Brand Rules
- Visual direction is premium automotive luxury: obsidian blacks, bronze accents, restrained glassmorphism, clean motion.
- Use real official brand imagery only. No placeholder, stock filler, or AI-generated storefront imagery.
- Preserve UA and EN support for customer-facing UI.

## 7. Repo Hygiene
- Update [`wiki/Tasks Kanban.md`](D:/OneCompany/wiki/Tasks%20Kanban.md) when a major feature or infrastructure change starts or finishes.
- Do not manually edit `wiki/📡 Git Changelog.md`.
- Prefer concise, maintainable local documentation over meta-roleplay files or giant instruction dumps.
