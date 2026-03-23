## Executive summary

This repository is a **Next.js 16 + React 19 + Prisma/Postgres** web app with a public storefront, admin panel, and several unauthenticated API endpoints (shop/cart/checkout, Telegram setup/webhooks). The biggest security risks right now are **a default admin password**, **unsafe HTML rendering**, and **unvalidated redirects**.

Below are evidence-based findings prioritized by impact and exploitability.

---

## Critical

### [C-01] Default admin password fallback enables trivial admin takeover

- **Severity**: Critical
- **Location**: `src/app/api/admin/auth/route.ts` (admin login API)
- **Evidence**:

```7:31:src/app/api/admin/auth/route.ts
// Trim any whitespace/newline characters from environment variable
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').trim();
```

- **Impact**: If `ADMIN_PASSWORD` is not set in production (or is mis-set), an attacker can log in with `admin123` and get an authenticated admin session cookie.
- **Fix**:
  - Remove the insecure fallback. In production, **fail closed** if `ADMIN_PASSWORD` is missing.
  - Add rate limiting and lockout for this endpoint (see [H-03]).
- **Mitigation**:
  - Ensure `ADMIN_PASSWORD` is always set and strong in deployment platform env vars.
  - Add monitoring/alerts on repeated 401s to this endpoint.

---

## High

### [H-01] Potential stored/DOM XSS via `dangerouslySetInnerHTML` in `HeroSection`

- **Severity**: High
- **Location**: `src/components/sections/HeroSection.tsx`
- **Evidence**:

```43:55:src/components/sections/HeroSection.tsx
<h1 
  ref={titleRef}
  className="text-6xl md:text-7xl lg:text-8xl font-light tracking-tight text-white mb-6"
  dangerouslySetInnerHTML={{ __html: title }}
/>
```

- **Impact**: If `title` can be influenced by content editors, query params, CMS, or any external data source, this can allow script execution in users’ browsers.
- **Fix**:
  - Prefer **plain text rendering** (no HTML).
  - If markup is required, sanitize with a vetted sanitizer (e.g. DOMPurify) and strictly allow-list tags/attributes.
- **False positive notes**:
  - If `title` is *hard-coded* and never comes from untrusted sources, the risk is lower. Still, this pattern is fragile and easy to misuse later.

### [H-02] Unvalidated `next` parameter used for navigation (open redirect / UX phishing vector)

- **Severity**: High
- **Location**: `src/app/[locale]/shop/account/components/ShopAccountAuthClient.tsx`
- **Evidence**:

```43:74:src/app/[locale]/shop/account/components/ShopAccountAuthClient.tsx
const nextHref = searchParams.get('next') || `/${locale}/shop/account`;
// ...
router.push(nextHref);
```

- **Impact**: Attackers can craft links to send users to attacker-controlled destinations after login/registration (phishing). Depending on Next.js behavior, this can become a full open redirect.
- **Fix**:
  - Allow only **same-origin relative paths** (e.g. must start with `/` and must not start with `//` or contain a scheme).
  - Optionally restrict to a small allowlist of post-auth destinations.

### [H-03] No rate limiting / brute-force protection on admin auth endpoint

- **Severity**: High
- **Location**: `src/app/api/admin/auth/route.ts`
- **Evidence**:

```10:39:src/app/api/admin/auth/route.ts
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    if (password === ADMIN_PASSWORD) {
      // ...
```

- **Impact**: Enables password guessing/brute force. With [C-01], it becomes immediate compromise.
- **Fix**:
  - Add IP-based + global rate limit (sliding window).
  - Add exponential backoff and/or temporary lockout after repeated failures.

### [H-04] Weak production defaults for NextAuth secret

- **Severity**: High (production)
- **Location**: `src/lib/authOptions.ts`
- **Evidence**:

```66:71:src/lib/authOptions.ts
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'dev-shop-customer-secret',
```

- **Impact**: If production deploy accidentally uses the fallback secret, attackers may be able to forge/modify session tokens depending on configuration and signing algorithms.
- **Fix**:
  - In production, require `NEXTAUTH_SECRET` to be set (fail closed).

---

## Medium

### [M-01] PrismaClient instantiated in many modules (serverless connection exhaustion risk)

- **Severity**: Medium (High if deployed to serverless without pooling)
- **Location**: many files across `src/` (examples below)
- **Evidence** (representative sample):

```1:13:src/lib/authOptions.ts
const prisma = new PrismaClient();
```

and multiple API routes similarly.

- **Impact**: In serverless runtimes, repeated PrismaClient instantiation can cause **too many DB connections**, leading to outages (availability) and knock-on failures in checkout/admin.
- **Fix**:
  - Implement a **singleton prisma client** (global cache) for Node.js runtime.
  - Ensure proper connection pooling strategy for Vercel/Postgres (e.g., Prisma Accelerate or pgbouncer where applicable).

### [M-02] Telegram setup endpoint allows secret in query string

- **Severity**: Medium
- **Location**: `src/app/api/telegram/setup/route.ts`
- **Evidence**:

```7:17:src/app/api/telegram/setup/route.ts
const url = new URL(req.url);
return url.searchParams.get('secret') === ADMIN_API_SECRET;
```

- **Impact**: Query-string secrets can leak via logs, browser history, monitoring tools, and referrers.
- **Fix**:
  - Require `Authorization: Bearer ...` only (no query-param secret).
  - Prefer `POST` for setup actions to reduce accidental link sharing/caching.

### [M-03] `dangerouslyAllowSVG: true` in Next Image config increases XSS foot-gun risk

- **Severity**: Medium
- **Location**: `next.config.ts`
- **Evidence**:

```14:20:next.config.ts
images: {
  dangerouslyAllowSVG: true,
```

- **Impact**: SVG can contain script and risky constructs. While `<img>` generally won’t execute scripts, this is a common future foot-gun (e.g. if SVG is ever inlined or served with incorrect content-type).
- **Fix**:
  - Disable unless strictly needed.
  - If needed, enforce strict sources and sanitize/strip scripts server-side before storage/serving.

### [M-04] Missing site-wide CSP (defense-in-depth)

- **Severity**: Medium
- **Location**: `next.config.ts` headers
- **Evidence**: no `Content-Security-Policy` header is set under `source: '/:path*'` in the global headers list.
- **Impact**: CSP reduces blast radius for XSS and third-party script compromise; without it, XSS becomes easier to exploit.
- **Fix**:
  - Add a baseline CSP compatible with Next.js + analytics usage (ideally nonce-based for inline scripts if any).
- **False positive notes**:
  - CSP may be set at the CDN/edge; verify runtime response headers in production.

---

## Low / hygiene

### [L-01] `X-XSS-Protection` header is obsolete

- **Severity**: Low
- **Location**: `next.config.ts`
- **Evidence**:

```112:123:next.config.ts
{
  key: 'X-XSS-Protection',
  value: '1; mode=block',
},
```

- **Impact**: Modern browsers ignore it; keeping it isn’t a vulnerability but can create a false sense of coverage.
- **Fix**: Remove it; rely on CSP + output encoding.

---

## Recommended next steps

1. **Fix [C-01] + [H-03] immediately** (admin auth hardening).
2. Fix **open redirect [H-02]** by validating `next` target.
3. Remove or sanitize **unsafe HTML render [H-01]**.
4. Require production secrets (NextAuth) **[H-04]**.
5. Add Prisma singleton/pooling **[M-01]**.
6. Tighten Telegram setup auth **[M-02]**.
7. Add CSP baseline **[M-04]**.

