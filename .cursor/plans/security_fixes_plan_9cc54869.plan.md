---
name: Security fixes plan
overview: "Fix critical security risks and harden the app for Vercel: remove insecure auth fallbacks, add rate limits and redirect validation, reduce XSS foot-guns, improve Prisma usage for serverless, and tighten webhook/setup endpoints plus baseline security headers/CSP."
todos:
  - id: admin-auth
    content: Remove admin password fallback; add admin auth rate limiting; verify admin cookie settings.
    status: completed
  - id: redirect-validation
    content: Validate/allowlist the `next` redirect target for shop account auth flows.
    status: completed
  - id: xss-hardening
    content: Remove/sanitize dangerouslySetInnerHTML in HeroSection; audit other uses.
    status: completed
  - id: prod-secrets
    content: Require NEXTAUTH_SECRET (and ADMIN_PASSWORD) in production; update docs.
    status: completed
  - id: prisma-singleton
    content: Introduce Prisma singleton and refactor callsites for Vercel serverless stability.
    status: completed
  - id: telegram-setup
    content: Harden Telegram setup auth (no query secrets; POST + bearer auth).
    status: completed
  - id: headers-csp
    content: Add baseline CSP and clean up legacy headers in next.config.ts.
    status: completed
  - id: svg-policy
    content: Reassess/disable dangerouslyAllowSVG unless required; tighten config if kept.
    status: completed
  - id: verification
    content: "Run targeted checks: auth rate limits, redirect validation, CSP headers, and basic storefront/admin flows."
    status: completed
isProject: false
---

# Security fixes on Vercel

## Scope

- Fix **all findings** from `security_best_practices_report.md`.
- Target deploy: **Vercel (serverless)**.

## Guiding principles

- Fail closed in production (no insecure fallbacks).
- Validate all untrusted input at the boundary (API routes, auth flows).
- Keep changes minimal per risk area, verify with targeted runtime checks.
- Do not commit secrets; add env requirements to docs.

## Workstream A — Admin authentication hardening (Critical)

- **Remove default password fallback** in `[src/app/api/admin/auth/route.ts](src/app/api/admin/auth/route.ts)`.
  - In production: if `ADMIN_PASSWORD` missing/blank → return 500 + clear message.
  - In development: allow optional fallback only behind explicit `ALLOW_DEV_ADMIN_PASSWORD_FALLBACK=1` (or similar) to avoid accidental prod drift.
- **Add rate limiting** to admin auth.
  - Reuse existing rate-limit helper patterns (shop endpoints use `consumeRateLimit` in `[src/lib/shopPublicRateLimit.ts](src/lib/shopPublicRateLimit.ts)`).
  - Key by IP + endpoint, windowed; include a small global limiter.
- **Audit admin session cookie settings**.
  - Confirm `httpOnly`, `secure` only in prod, `sameSite=strict` are applied via `[src/lib/adminAuth.ts](src/lib/adminAuth.ts)`.

## Workstream B — Redirect validation (High)

- **Validate `next` param** before navigation in `[src/app/[locale]/shop/account/components/ShopAccountAuthClient.tsx](src/app/[locale]/shop/account/components/ShopAccountAuthClient.tsx)`.
  - Accept only same-origin relative paths:
    - must start with `/`
    - must not start with `//`
    - must not contain a scheme (`http:`, `https:`)
  - Default fallback: `/${locale}/shop/account`.
  - Optionally restrict to a small allowlist (account/cart/checkout) if you want tighter control.

## Workstream C — XSS foot-guns (High)

- **Remove or sanitize `dangerouslySetInnerHTML`** in `[src/components/sections/HeroSection.tsx](src/components/sections/HeroSection.tsx)`.
  - Preferred: render `title` as plain text.
  - If markup is required: add a sanitizer (DOMPurify) and allowlist tags/attributes.
  - Add a small unit-like check ensuring injected `<script>` or `onerror=` does not render.
- **Review other `dangerouslySetInnerHTML` usages**.
  - Most current usages appear to be JSON-LD injection (safe if data is controlled and JSON.stringify is used), but still confirm no user-controlled strings are injected.

## Workstream D — Production secret requirements (High)

- **Require `NEXTAUTH_SECRET` in production** in `[src/lib/authOptions.ts](src/lib/authOptions.ts)`.
  - If `NODE_ENV=production` and secret missing/weak → throw at startup (or during authorize) with clear error.
- Add/extend docs: `.env.example` and relevant docs to list required env vars for prod.

## Workstream E — Prisma on Vercel (Medium/Availability)

- Replace scattered `new PrismaClient()` with a **singleton**.
  - Create `[src/lib/prisma.ts](src/lib/prisma.ts)` exporting `prisma` cached on `globalThis`.
  - Update callsites (API routes + server components) to import singleton.
- Add guidance for Vercel DB connection management.
  - Recommend Prisma Accelerate or a pooler depending on your DB provider.

## Workstream F — Telegram setup endpoint hygiene (Medium)

- In `[src/app/api/telegram/setup/route.ts](src/app/api/telegram/setup/route.ts)`:
  - Remove support for `?secret=` query auth; require `Authorization: Bearer ...` only.
  - Consider changing setup to **POST** (state-changing) and returning 405 for GET.
  - Ensure responses never echo secrets.

## Workstream G — Next.js security headers and CSP (Medium)

- In `[next.config.ts](next.config.ts)`:
  - Add a baseline **Content-Security-Policy** header for `/:path`* compatible with Next + analytics.
  - Re-evaluate `X-XSS-Protection` (obsolete) and remove.
  - Keep `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`.
  - Verify CSP is not already set by Vercel/edge; if it is, align instead of duplicating.

## Workstream H — SVG configuration (Medium)

- Revisit `images.dangerouslyAllowSVG` in `[next.config.ts](next.config.ts)`.
  - If not strictly needed: turn off.
  - If needed: constrain remotePatterns, ensure correct content types, and avoid any SVG inlining.

## Verification plan (fast, high-signal)

- **Unit-ish checks**:
  - Redirect validator: a set of allowed/blocked `next` examples.
  - HeroSection: ensure HTML is not executed (if sanitizer) or rendered (if plain text).
- **Runtime checks (local + Vercel preview)**:
  - Admin auth: missing `ADMIN_PASSWORD` in prod should fail closed.
  - Admin auth: brute-force attempts should hit 429.
  - Login/register: `next=https://evil.com` must not redirect out.
  - Basic pages still load; checkout/cart unchanged.
  - Confirm response headers include CSP and other headers.
- **DB stability**:
  - Confirm Prisma singleton prevents connection churn under concurrent requests.

## Deliverables

- Code changes across the files above.
- Updated documentation for required env vars and deployment notes.
- Optional: follow-up PR to add automated security checks (lint rules / simple tests).

