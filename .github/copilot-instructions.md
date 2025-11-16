# Copilot instructions for OneCompany

## Stack & routing
- App Router on Next.js 16/React 19 with TypeScript + Tailwind; server components dominate (`src/app/[locale]/**`).
- `next-intl` controls locales; middleware in `src/middleware.ts` rewrites `/` to `/ua`, so always use `resolveLocale` helpers in new pages and import links from `src/navigation.ts`.
- `FullScreenVideo` is mounted in `src/app/[locale]/layout.tsx` and streams files from `public/videos`; don1 blow away its `fixed` layering when editing hero sections.

## Content, media & admin flows
- Marketing copy lives in `public/config/site-content.json`; always read/write via `readSiteContent`/`writeSiteContent` (`src/lib/siteContentServer.ts`) so defaults from `src/config/defaultSiteContent.ts` merge correctly.
- Hero video selection lives in `public/config/video-config.json` accessed through `src/lib/videoConfig.ts`; admin routes (`/api/admin/video-config`, `/api/admin/upload-video`) expect the same schema.
- The `/admin` UI mutates content + media via authenticated calls guarded by `lib/adminAuth.ts`; reuse `assertAdminRequest` or `isAdminRequestAuthenticated` for any new privileged endpoints.

## Data & messaging
- Contact form submissions hit `src/app/api/contact/route.ts`: requests are sanitized, written to Postgres via Prisma (`prisma/schema.prisma`), and forwarded to Telegram + Resend; follow the same pattern (rate-limit, sanitize, non-blocking notifications) when extending.
- Admin message dashboard uses `src/app/api/messages/route.ts` to read/update statuses and send reply emails (React Email templates under `src/components/emails/**`).
- Telegram integrations are centralized in `src/lib/telegram.ts` and webhook logic under `src/app/api/telegram/webhook/route.ts`; keep outbound formatting HTML-safe.

## Components & styling
- Core hero and CTA layout is in `src/app/[locale]/page.tsx`; background overlays rely on Tailwind utility gradients and global styles defined in `src/app/globals.css` (custom CSS vars, `text-balance`/`text-pretty`).
- Motion-heavy sections live under `src/components/3d/**` using `@react-three/fiber`, `@react-spring/three`, and `gsap`; prefer hooks already set up in `CinematicHero`, `CinematicCamera`, etc., instead of reconfiguring the canvas each time.
- Shared chrome (header/footer) resides in `src/components/layout` and `src/components/shared`; keep typography consistent with the local font declared in `app/layout.tsx`.

## Scripts, docs & assets
- Brand/logo pipelines are in `scripts/*.ts`; `npm run download-logos-free` (or other `download-*` scripts) update `public/logos/` plus `src/lib/brandLogos.ts` via the instructions in `scripts/README-LOGOS.md`.
- Telegram bot operational guides live in `TELEGRAM_*.md`; automation and workflow exports are under `automation/workflows/`.
- Legacy WordPress theme assets are under `wp-content/`; `npm run build:css` recompiles its Tailwind layer if you touch that area.

## Build, lint & deployment
- Standard routines: `npm run dev`, `npm run lint`, `npm run build && npm start`. Prisma requires `DATABASE_URL`; run `npx prisma migrate dev` before touching schemas.
- Dockerfile builds a standalone Next image (Node 20 Alpine). Vercel deploys run `npm run build` with `--legacy-peer-deps`; keep dependencies compatible with React 19/Three.js combo.
- Secrets: `.env.example` lists required variables (Telegram tokens, Resend, admin credentials); never hardcode fallbacks beyond the provided defaults.

## Gotchas
- `PrismaClient` instances are created per API file; avoid long-running background jobs in the same module or youll leak connections on serverless targets.
- Static JSON stores (`public/config/*.json`) are part of the deployed artifact; server-side writes work on Vercel only if using persistent storage (currently files are mutated in-place, so plan migrations accordingly).
- Image tags often use raw `<img>` for fine-grained styling; before swapping to `next/image`, confirm the asset lives in `/public` and that SSR blur-up isnt required.
