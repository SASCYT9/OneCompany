---
tags: [bot, telegram, integrations, backend]
aliases: [TG Bot]
---

# 🤖 Telegram Bot

Частиною інфраструктури One Company є Telegram бот, створений для комунікації з клієнтами, підтримки (Customer Support) та, потенційно, менеджменту замовлень. 

Бот побудований на базі фреймворку **Grammy** (`grammy`, `@grammyjs/*`) і тісно інтегрований з основною базою даних через **Prisma**.

## 🏗️ Архітектура та Запуск

У кодовій базі є скрипт `scripts/telegram-bot-polling.js`. Він використовується для запуску бота в режимі Polling (постійного опитування серверів Telegram). Цей метод часто використовується для локальної розробки або як фоновий воркер.

Для запуску бота:
```bash
npm run bot
```

У production середовищі, як правило, налаштовуються Webhooks через Next.js Route Handlers (в папці `src/app/api/webhooks/telegram/`), щоб не тримати окремий Node.js процес.

## 🗄️ Prisma Моделі (Database)

Бот має власний набір таблиць у [[Database ERD Schema]], які зберігають стан користувачів та діалогів:

1. **`TelegramUser`**:
   - Основна інформація: `telegramId` (BigInt), `username`, `firstName`, `languageCode`.
   - Права доступу: `isAdmin`, `isBlocked`.
   - Відстеження: `lastActiveAt`.

2. **`TelegramSession`**:
   - Зберігає сесійні дані (`data` як Json). Потрібно для збереження стану (наприклад, на якому кроці замовлення знаходиться користувач), використовуючи механізм сесій Grammy.

3. **`TelegramConversation`**:
   - Для складних багатоекранних діалогів. Використовує плагін `@grammyjs/conversations`.
   - Зберігає `state` (Json), `conversationType` та зв'язок з `chatId` та `messageId`.

4. **`TelegramAdmin`**:
   - Окремі адміністратори, які можуть отримувати сповіщення або відповідати на тікети прямо з Telegram.

5. **`Message` та `Reply`**:
   - Загальна система повідомлень (Inbox/Тікети). Повідомлення від користувачів з Telegram (або сайту) потрапляють у `Message`. Відповіді адміністраторів — у `Reply`.

## 🔌 Використані Плагіни Grammy
Згідно з `package.json`, бот використовує потужний набір мідлварів:
- `@grammyjs/conversations`: Для створення багатоетапних діалогів (наприклад, "Введіть ім'я" -> "Введіть телефон").
- `@grammyjs/menu`: Для створення inline-клавіатур.
- `@grammyjs/runner`: Надійний механізм запуску в production.
- `@grammyjs/ratelimiter` & `@grammyjs/transformer-throttler`: Захист від спаму та уникнення лімітів Telegram API (429 Too Many Requests).
- `@grammyjs/hydrate`: Додає зручні методи безпосередньо до об'єктів (наприклад, `ctx.msg.reply()`).
