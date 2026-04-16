---
tags: [scripts, automation, maintenance, tools]
aliases: [Scripts]
---

# 📂 Scripts Encyclopedia

Директорія `scripts/` містить величезну кількість інструментів для підтримки, синхронізації, імпорту та перекладу даних у проєкті One Company. Усі скрипти написані на Node.js (JavaScript/TypeScript) і часто запускаються за допомогою `tsx` або `node`.

Багато скриптів використовують прямий доступ до бази даних через Prisma (`import prisma from "../src/lib/prisma"`).

## 📥 Імпорт та Синхронізація (Imports & Sync)

Ці скрипти відповідають за наповнення бази даних товарами з різних джерел.

- **Brabus**: `brabus-import.mjs`, `scrape-brabus.mjs`, `import_brabus.ts`, `reclean-brabus-json.js`, `scrape-brabus-images.mjs`.
- **Burger Motorsports**: `scrape-burger.mjs`, `import-burger-fast.ts`, `update-burger-prices.ts`.
- **do88**: `scrape-do88.mjs`, `scrape-do88-v4.mjs`, `import-do88.ts`, `generate-do88-sql.mjs`, `fix-do88-images.mjs`.
- **Girodisc**: `scrape-girodisc.mjs`, `import-girodisc.ts`, `update-girodisc-pricing.ts`.
- **Racechip**: `scrape-racechip.mjs`, `import-racechip.ts`, `clean-racechip.ts`.
- **Turn14 (B2B)**: `turn14-cron.ts`, `turn14-supabase-sync.mjs`, `test-turn14.ts`. Синхронізує наявність та ціни сотень тисяч товарів.
- **Urban Automotive**: `seed-urban-defender110.ts`.

## 🌐 Переклад (Translations)

ШІ-керовані скрипти для перекладу величезних масивів контенту.

- **Gemini**: `gemini-translate-cli.ts`, `translate-gemini.mjs`, `translate-products.mjs`. Використовує Google Gemini для перекладу. Зберігає прогрес у `.translate-gemini-checkpoint.json`.
- **DeepL**: `translate-brabus-deepl.mjs`, `translate-burger-deepl.mjs`.

## 🧹 Обслуговування та Аудит БД (Maintenance & DB Audit)

Скрипти для виявлення проблем, очищення даних та їх міграції.

- **Аудит**: `check-db.ts`, `check-database-counts.ts`, `check-translations.js`, `audit-images.ts`, `compare-databases.ts`.
- **Очищення**: `clean-burger-descriptions.mjs`, `cleanup-burger.ts`, `delete-akra-mishi-local.js`.
- **Міграції**: `migrate-data.js`, `migrate-inventory.js`, `migrate-missing-data.ts`.
- **Адміністратори**: `add-admin.ts`, `create-admin.ts`, `create-test-accounts.ts`.
- **Supabase**: `kill_supabase_locks.js` (утиліта для розблокування завислих транзакцій).

## 🕷️ Scraping & Медіа (Media & Scraping)

- **Зображення**: `download-shopify-images-to-public.mjs`, `download-premium-photos.mjs`, `migrate-urban-images-to-local.mjs`, `take_screenshots.mjs`.
- **Оптимізація**: `optimize-videos.js`.

## 🤖 ШІ та Інтеграції (AI & Misc Integrations)

- **Telegram Bot**: `telegram-bot-polling.js` — запускає бота локально (без вебхуків) для тестування. Детальніше див. у [[🤖 Telegram Bot]].
- **Airtable**: `airtable-export.mjs`, `airtable-ai-export.mjs`, `turn14-airtable-export.mjs`. Синхронізація з CRM таблицями.
- **SEO**: `seo-structure-audit.ts`. Аналізує структуру сайту.

## 🛠️ Як запускати?
У `package.json` вже є готові команди для деяких найважливіших скриптів:
- `npm run translate:gemini-custom`
- `npm run shop:translate-en`
- `npm run seo:structure-check`

Для ручного запуску:
```bash
# Для .js та .mjs
node scripts/my-script.mjs

# Для TypeScript
npx tsx scripts/my-script.ts
```