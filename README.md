# OneCompany

Premium performance hub built with Next.js 16, React 19, TypeScript, and Tailwind CSS.

## Quick start

1. Install deps
   - Node 18+ recommended.
2. Create local env file:
   - Copy `.env.example` to `.env.local` and fill in values.
3. Run the app
   - `npm run dev` for development
   - `npm run build && npm start` for production

## Environment variables

Create `.env.local` (not committed) with:

- **TELEGRAM_BOT_TOKEN**: Bot token from @BotFather (see `docs/telegram-bot-setup.md`)
- **TELEGRAM_AUTO_CHAT_ID**: Chat ID for auto team inquiries
- **TELEGRAM_MOTO_CHAT_ID**: Chat ID for moto team inquiries
- **RESEND_API_KEY**: API key for email sending via Resend (see `docs/google-workspace-setup.md`)
- **EMAIL_FROM**: Sender address (e.g., `contact@onecompany.com`)
- **EMAIL_AUTO**: Recipient for auto inquiries (e.g., `auto@onecompany.com`)
- **EMAIL_MOTO**: Recipient for moto inquiries (e.g., `moto@onecompany.com`)
- **ADMIN_PASSWORD**: Password required to access the `/admin` panel (set a strong value)
- **ADMIN_SESSION_SECRET**: Secret used to sign encrypted admin session cookies
- **NEXT_PUBLIC_PLAUSIBLE_DOMAIN** (optional): Enables Plausible analytics

Security notes:
- Never commit `.env.local` to git; rotate secrets if leaked.
- On cloud hosts, configure secrets via the platform (e.g., Vercel/Azure App Service env vars).

Setup guides:
- Domain configuration: `docs/godaddy-domain-setup.md`
- Email setup: `docs/google-workspace-setup.md`
- Telegram bot: `docs/telegram-bot-setup.md`

## Media admin

- Visit `/admin` and authenticate with the configured `ADMIN_PASSWORD`.
- Successful logins receive a short-lived, HTTP-only cookie signed with `ADMIN_SESSION_SECRET`.
- Manage the hero autoplay video: upload files to `public/videos/` and switch which asset is active via the UI (config stored at `public/config/video-config.json`).
- If the session expires or is invalid, the UI will prompt you to log in again before calling admin APIs.

## Contact submissions

- Header includes a contact modal. Submissions are validated, rate-limited, persisted to `data/contact-submissions.json`, then forwarded to Telegram.

## Brand Logos

The project includes a free logo downloader that works without API keys:

- **Location**: `scripts/download-logos-free.ts`
- **Documentation**: See `scripts/README-LOGOS.md` for full guide
- **Run**: `npm run download-logos-free`
- **Features**:
  - Searches domains via DuckDuckGo (no API needed)
  - Downloads from 5+ free sources (Clearbit, Logo.dev, Google, website scraping)
  - Supports 250+ automotive and motorcycle brands
  - Auto-generates `src/lib/brandLogos.ts` mapping file

Brand data is stored in:
- `scripts/brands-list.json` - Brand list for parser
- `src/lib/brands.ts` - TypeScript brand definitions
- `src/lib/brandLogos.ts` - Auto-generated logo paths
- `public/logos/` - Downloaded logo files

## License

Proprietary. All rights reserved.