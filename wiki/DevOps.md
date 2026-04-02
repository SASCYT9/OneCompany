---
tags: [devops, infra]
aliases: [DevOps, Хостінг]
---

# ⚙️ DevOps & Cloud Environment

> [!info] Інфраструктура проекту: де живуть сервери, як деплоїться код і бекапи БД.

---

## ☁️ Cloud Providers

| Ресурс | Провайдер | Деталі |
|---|---|---|
| **Hosting & CDN** | Vercel | Автоматичний CI/CD з GitHub, Edge Network. |
| **Database (PostgreSQL)** | Supabase | Керований Postgres, PgBouncer pooler. |
| **AI Models** | Cloudflare | Cloudflare Workers AI для estimation. |
| **Domain & DNS** | Cloudflare / Vercel | `onecompany.global` |
| **Media Storage** | Vercel Blob / S3 | Зберігання картинок, відео. |

---

## 🚀 Environment Variables (Secrets)

> [!caution] Ніколи не комітьте ці ключі в репозиторій! Всі ключі в Vercel Settings.

Ключові змінні на Production (див. `.env.example` для локальної розробки):
- `DATABASE_URL` — Supabase Transaction mode (для Prisma міграцій)
- `DIRECT_URL` — Supabase Session mode (для Prisma queries)
- `TURN14_CLIENT_ID` / `SECRET` — ключі Turn14 API
- `NEXT_PUBLIC_SITE_URL` — `https://onecompany.global`

---

## 💾 Backups & Database Management

### Prisma Migrations
Ми використовуємо `Prisma Migrate` для зміни схеми БД.
Коли Schema змінюється:
1. Вносиш зміни в `schema.prisma`.
2. Запускаєш `npx prisma migrate dev --name feature_name`.
3. Міграції лежать у `prisma/migrations/` і фіксуються в GIT.
4. На Vercel під час деплою автоматично запускається `npx prisma migrate deploy`.

### Дампи Бази
БД бекапиться силами самого Supabase:
- **Point-in-Time Recovery (PITR)**: Можемо відкататит БД до будь-якої хвилини за останні 7-30 днів (залежно від плану).
- Ручні дампи робить скрипт: `scripts/backup-db.js` (якщо потрібно для локальної розробки).

---

## 🔄 Turn14 Cron Jobs

Зараз у нас є `scripts/turn14-supabase-sync.mjs`.
Для автоматизації на проді нам знадобляться **CRON Jobs**:
1. `Sync Delta` (раз на добу) — оновлення залишків і цін Turn14.
2. `Full Sync` (раз на тиждень) — повне оновлення каталогу.

Може бути налаштовано через **Vercel Cron Jobs** (`vercel.json`) або **Supabase Edge Functions**.

← [[Home]]
