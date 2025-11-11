# Automation & n8n Integration Guide

This document explains how the OneCompany project connects to the self-hosted n8n instance and how to extend the workflow automation.

## 1. Architecture Overview

- **n8n container** is defined in `docker-compose.yml` and exposed on `http://localhost:5678`.
- **Premium features** are enabled through the environment variable `N8N_API_KEY` (already configured in the compose file).
- **Workflow trigger**: The Next.js contact API forwards every submission to an n8n webhook defined by `AUTOMATION_ENDPOINT`.
- **Fallback logic**: Even if n8n is unavailable, the existing Telegram + Resend email notifications still run.

```
Client Form (/auto) → Next.js API (/api/contact)
        │
        ├─> n8n webhook (leads automation)
        ├─> Telegram alert
        └─> Resend email (optional)
```

## 2. Environment Variables

Add the following entries to your `.env.local` (or production secrets manager):

```
# n8n webhook endpoint (adjust host when running remotely)
AUTOMATION_ENDPOINT=http://localhost:5678/webhook/contact-request

# Optional shared secret for webhook authentication
AUTOMATION_API_KEY=<same key configured in n8n webhook credentials>

# Existing notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_AUTO_CHAT_ID=...
TELEGRAM_MOTO_CHAT_ID=...
RESEND_API_KEY=...
EMAIL_AUTO=...
EMAIL_MOTO=...
EMAIL_FROM=...
```

> Keep the webhook host reachable from the Next.js container. When deploying to production, use the public domain or private network URL of your n8n instance.

## 3. n8n Configuration Steps

1. **Open n8n** at [http://localhost:5678](http://localhost:5678) and sign in with the configured credentials.
2. **Create Credentials** (use the `Credentials` menu):
   - `Slack` Bot token (if needed)
   - `Telegram` credentials (bot token)
   - `Google` Service Account (for Sheets)
   - `HubSpot` or other CRM tokens (optional extensions)
3. **Import the workflow template** located at `automation/workflows/contact-lead-template.json` (n8n → *Create Workflow* → *Import from File*). Після імпорту:
  - Признач **Header Auth** credential із вашим `AUTOMATION_API_KEY` у вузлі «Contact Webhook».
  - «Normalize Payload» залишає лише ключові поля й додає `rawBody` для лагодження.
  - Гілка «Missing Email?» повертає `400`, якщо email відсутній; інакше все переходить у вузол «Respond Success», який віддає `{ "ok": true, "forwarded": true }`.
  - Від вузла «Respond Success» можна підключати будь-які наступні інтеграції (Sheets, CRM, Slack тощо) — просто додавай нові вузли у свою версію workflow.
4. **Activate the workflow** (toggle in the top-right corner of the editor).
5. **Test** by submitting the `/auto` form or calling the API directly:

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "type": "auto",
    "name": "Test User",
    "email": "test@example.com",
    "subject": "n8n integration",
    "message": "Please confirm the automation."
  }'
```

The request should:
- Append a row in Google Sheets (if configured)
- Send Slack/Telegram notifications
- Create a CRM entry (optional)
- Reply with `{ "ok": true }`

## 4. Updating the Workflow

- Add or reorder nodes in n8n without touching the Next.js code as long as the webhook URL stays the same.
- If you create a new webhook path, update `AUTOMATION_ENDPOINT` accordingly.
- Use the premium nodes unlocked by your key (e.g. additional SaaS integrations, concurrency controls).

## 5. Deployment Notes

- On production, secure n8n behind HTTPS (reverse proxy + SSL) and restrict access to the webhook.
- Update `AUTOMATION_ENDPOINT` to the public URL (`https://automation.onecompany.com/webhook/contact-request`).
- Ensure the `AUTOMATION_API_KEY` matches the secret set inside the n8n webhook node.
- Back up `n8n_data/` volume regularly (`docker run --rm -v onecompany_n8n_data:/data busybox tar czf - /data > backup.tar.gz`).

## 6. Troubleshooting

- **n8n container not running:** `docker ps` should list `onecompany-n8n`. Start with `docker-compose up -d n8n`.
- **Webhook failing:** Check logs via `docker logs onecompany-n8n`. Look for auth errors or missing credentials.
- **Next.js errors:** The API route logs automation failures to the server console. Ensure the endpoint and key are correct.
- **Timeouts:** The automation request uses a 5s timeout. Increase by editing `triggerAutomation` in `src/app/api/contact/route.ts` if workflows take longer.

---

With this setup the OneCompany site automatically syncs new leads into your internal tooling while keeping the legacy Telegram/email notifications as a fallback. Update the n8n workflow to extend capabilities (e.g. scoring, assignment, reminders) without additional deployment steps.
