<div align="center">

# OneCompany

**Premium auto & moto performance hub.**
Auto-tuning e-commerce platform powered by Next.js, with multi-locale (UA/EN), Telegram integrations, and 240+ premium brands.

[![Production](https://img.shields.io/badge/prod-onecompany.global-0ea5e9?style=flat-square&logo=vercel&logoColor=white)](https://onecompany.global)
[![CI](https://img.shields.io/github/actions/workflow/status/SASCYT9/OneCompany/ci.yml?branch=master&label=CI&style=flat-square&logo=github)](https://github.com/SASCYT9/OneCompany/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/SASCYT9/OneCompany/codeql.yml?branch=master&label=CodeQL&style=flat-square&logo=github)](https://github.com/SASCYT9/OneCompany/actions/workflows/codeql.yml)
[![Last commit](https://img.shields.io/github/last-commit/SASCYT9/OneCompany/master?style=flat-square&logo=git&logoColor=white)](https://github.com/SASCYT9/OneCompany/commits/master)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red?style=flat-square)](./LICENSE)

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=000)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Three.js](https://img.shields.io/badge/Three.js-r181-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)

</div>

---

## Table of contents

- [Stack](#stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Key features](#key-features)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Stack

| Layer            | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| **Framework**    | [Next.js 16](https://nextjs.org/) (App Router) on Node 20+       |
| **UI**           | React 19 · Tailwind CSS 3.4 · Radix UI · Lucide                  |
| **3D / motion**  | Three.js · @react-three/fiber · GSAP · Framer Motion · Lenis     |
| **State**        | Zustand · Valtio · Immer                                         |
| **Data**         | Prisma 6 · PostgreSQL (Prisma Cloud)                             |
| **Auth**         | NextAuth                                                         |
| **i18n**         | `next-intl` — Ukrainian (default) and English                    |
| **Email**        | React Email · Resend                                             |
| **Bot**          | Grammy (Telegram)                                                |
| **Hosting**      | Vercel (production) · Vercel Blob (media)                        |
| **Analytics**    | Vercel Analytics · Plausible (optional) · Meta Pixel             |

## Quick start

```bash
# 1. Clone
git clone https://github.com/SASCYT9/OneCompany.git
cd OneCompany

# 2. Install — Node 20+ required
npm install

# 3. Configure env
cp .env.example .env.local
# fill in your values

# 4. Generate Prisma client (also runs as postinstall)
npm run prisma:generate

# 5. Run dev server
npm run dev
```

The app starts on <http://localhost:3000>.

## Environment variables

Create `.env.local` (never committed) with at minimum:

| Variable                       | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `DATABASE_URL`                 | PostgreSQL connection string (Prisma Cloud)                       |
| `TELEGRAM_BOT_TOKEN`           | Bot token from [@BotFather](https://t.me/BotFather)               |
| `TELEGRAM_AUTO_CHAT_ID`        | Chat ID for auto team inquiries                                   |
| `TELEGRAM_MOTO_CHAT_ID`        | Chat ID for moto team inquiries                                   |
| `RESEND_API_KEY`               | Email API key — see [docs/google-workspace-setup.md](docs/google-workspace-setup.md) |
| `EMAIL_FROM`                   | Sender address (e.g., `contact@onecompany.global`)                |
| `EMAIL_AUTO`                   | Recipient for auto inquiries                                      |
| `EMAIL_MOTO`                   | Recipient for moto inquiries                                      |
| `ADMIN_SECRET`                 | Shared secret for `/admin` media UI                               |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | (Optional) Plausible analytics domain                             |
| `BLOB_READ_WRITE_TOKEN`        | Vercel Blob token for media migration scripts                     |

Setup guides live in [`docs/`](docs/):

- [`docs/godaddy-domain-setup.md`](docs/godaddy-domain-setup.md) — DNS / domain
- [`docs/google-workspace-setup.md`](docs/google-workspace-setup.md) — email
- [`docs/telegram-bot-setup.md`](docs/telegram-bot-setup.md) — bot

> **Never commit `.env.local`.** On Vercel and other hosts, configure secrets
> via the platform's environment variable UI.

## Project structure

```
OneCompany/
├── src/                       # Next.js App Router source
│   ├── app/                   #   route segments, API routes
│   ├── components/            #   shared React components
│   ├── lib/                   #   utilities, brand data, db client
│   └── messages/              #   i18n catalogs (UA / EN)
├── prisma/
│   └── schema.prisma          # database schema
├── public/                    # static assets, logos, media
├── scripts/                   # build / sync / data scripts
├── tests/shop/                # unit, integration, e2e
├── docs/                      # setup & operational guides
├── .github/                   # CI, templates, policies
└── archive/                   # historical artifacts (excluded from build)
```

## Key features

- **Multi-brand catalog** — 240+ premium auto & moto brands, see [`OneCompany_Brand_Portfolio_2026_EN.pdf`](OneCompany_Brand_Portfolio_2026_EN.pdf)
- **Auto-tuning shop** — per-brand shipping calculators (kg-only, tiered, percent, manual quote)
- **Multi-locale** — Ukrainian (default) and English, fully localized SEO
- **Telegram inquiry bot** — header contact modal forwards to per-team Telegram chats
- **Media admin** — `/admin` UI gated by `ADMIN_SECRET`; uploads to Vercel Blob
- **3D scenes** — interactive product showcases via `@react-three/fiber`
- **SEO-first** — sitemap, structured data, per-locale metadata, OG images
- **Turn14 sync** — read-only inventory sync (weights/dimensions only — never titles, descriptions, or images)

## Scripts

Common tasks; see [`package.json`](package.json) for the full list.

| Command                          | Purpose                                       |
| -------------------------------- | --------------------------------------------- |
| `npm run dev`                    | Start dev server                              |
| `npm run build`                  | Production build (runs prebuild snapshot)     |
| `npm run lint`                   | ESLint                                        |
| `npm run prisma:generate`        | Generate Prisma client                        |
| `npm run db:migrate`             | `prisma migrate deploy` (CI / staging only)   |
| `npm run test:shop`              | Unit + integration + e2e shop tests           |
| `npm run predeploy-check`        | Pre-deploy guardrails                         |
| `npm run deploy:prod`            | Deploy to Vercel production                   |
| `npm run bot`                    | Run Telegram bot in long-poll mode            |
| `npm run download-logos-free`    | Free brand-logo downloader                    |
| `npm run media:migrate:dry`      | Dry-run media migration to Vercel Blob        |

## Deployment

- **Production**: Vercel, deploys on push to `master` → <https://onecompany.global>
- **Previews**: Every PR gets a Vercel preview URL automatically
- **Database**: Single shared Prisma Cloud Postgres — destructive migrations require manual review
- **CI**: `.github/workflows/ci.yml` runs lint, typecheck, and Prisma validate on every PR

## Contributing

We accept bug reports and feature requests from the public. Pull requests
require an invited collaborator.

- Read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) before opening a PR
- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) — enforced by `commitlint` in CI
- Releases and `CHANGELOG.md` are managed by [release-please](https://github.com/googleapis/release-please)

## Security

Found a vulnerability? **Do not open a public issue.** See
[`.github/SECURITY.md`](.github/SECURITY.md) for the private reporting
channels and response timeline.

## License

Proprietary — All Rights Reserved. See [`LICENSE`](./LICENSE) for the full
terms. Public visibility on GitHub does not grant any usage rights.

For licensing inquiries: `contact@onecompany.global`.
