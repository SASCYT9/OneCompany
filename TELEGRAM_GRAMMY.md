# Telegram Bot - grammY Edition 🤖

## Огляд

Повністю переписаний Telegram бот на базі **grammY** з преміум Admin Web App.

## Функції

### 🤖 Bot Features
- **Мультимовність** (UK/EN/RU) з збереженням в БД
- **Conversations** - покрокові діалоги для контактної форми
- **Interactive Menus** - кнопкові меню для навігації
- **Rate Limiting** - захист від спаму
- **Auto-Retry** - автоматичні повторні спроби при помилках
- **Session Storage** - зберігання сесій в PostgreSQL

### 📱 Admin Web App
- Повний список повідомлень з фільтрами
- Пошук по імені, email, тексту
- Фільтрація по статусу та категорії
- Зміна статусу одним натиском
- Надсилання відповідей через Telegram
- Швидкі шаблони відповідей
- Haptic feedback на iOS/Android
- Адаптація до теми Telegram (light/dark)

### 🔔 Notifications
- Сповіщення адмінів про нові повідомлення
- Сповіщення користувачів про відповіді
- Кнопки швидкого реагування

## Структура файлів

```
src/lib/bot/
├── index.ts           # Barrel exports
├── bot.ts             # Main bot instance & middleware
├── types.ts           # TypeScript types
├── storage.ts         # Prisma session storage
├── translations.ts    # i18n translations
├── menus.ts           # Interactive menus
├── notifications.ts   # Admin/user notifications
├── handlers/
│   ├── commands.ts    # /start, /help, etc.
│   └── callbacks.ts   # Callback query handlers
└── conversations/
    └── contact.ts     # Contact form conversation

src/app/api/telegram/
├── webhook-grammy/route.ts     # New grammY webhook
├── verify-admin/route.ts       # Admin verification
└── webhook/route.ts            # Old webhook (legacy)

src/app/telegram-app/admin/
└── page.tsx           # Premium Admin Web App
```

## Налаштування

### 1. Змінні середовища

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=random_secret_string
TELEGRAM_ADMIN_IDS=123456789,987654321

# Site URL (для Web App)
NEXT_PUBLIC_SITE_URL=https://onecompany.global
```

### 2. Міграція бази даних

```bash
# Додати нові таблиці
npx prisma db push

# Або створити міграцію
npx prisma migrate dev --name add_telegram_models
```

### 3. Налаштування Webhook

```bash
# Встановити webhook (передавайте секрет через Authorization, а не через URL)
curl -H "Authorization: Bearer YOUR_ADMIN_API_SECRET" \
  "https://onecompany.global/api/telegram/webhook-grammy?action=set"

# Перевірити статус
curl -H "Authorization: Bearer YOUR_ADMIN_API_SECRET" \
  "https://onecompany.global/api/telegram/webhook-grammy?action=info"
```

### 4. Додати адміністраторів

**Спосіб 1: Через URL (найпростіше)**
```
# Дізнатись свій Telegram ID - напишіть боту @userinfobot
# Потім відкрийте URL:

curl -H "Authorization: Bearer YOUR_ADMIN_API_SECRET" \
  "https://onecompany.global/api/telegram/admins?action=add&id=YOUR_TELEGRAM_ID&name=Your%20Name"
```

**Спосіб 2: Команда в боті**
```
# Якщо ви вже адмін, можете додати інших:

/addadmin 123456789
# або перешліть повідомлення від користувача і дайте відповідь /addadmin
```

**Спосіб 3: .env файл**
```env
TELEGRAM_ADMIN_IDS=123456789,987654321
```

**API для керування адмінами:**
```
GET /api/telegram/admins?action=list&secret=...    # Список адмінів
GET /api/telegram/admins?action=add&id=...&secret=... # Додати
GET /api/telegram/admins?action=remove&id=...&secret=... # Видалити
```

## Команди бота

| Команда | Опис |
|---------|------|
| `/start` | Головне меню |
| `/help` | Довідка |
| `/language` | Зміна мови |
| `/contact` | Надіслати запит |
| `/auto` | Запит по авто |
| `/moto` | Запит по мото |
| `/admin` | Панель адміна |
| `/admins` | Список адмінів |
| `/addadmin` | Додати адміна |
| `/removeadmin` | Видалити адміна |
| `/stats` | Статистика (адмін) |
| `/cancel` | Скасувати діалог |
| `/webapp` | Відкрити сайт |

## Web App URLs

| URL | Опис |
|-----|------|
| `/telegram-app/admin` | Адмін панель |
| `/telegram-app/admin?filter=new` | Тільки нові |
| `/telegram-app/admin/message/[id]` | Деталі повідомлення |
| `/telegram-app/admin/reply/[id]` | Відповідь на повідомлення |

## API Endpoints

### POST `/api/telegram/verify-admin`
Перевірка прав адміністратора.

```json
// Request
{ "initData": "telegram_init_data_string" }

// Response
{ "isAdmin": true, "user": { "id": 123, "name": "Admin", "role": "admin" } }
```

### POST `/api/messages/[id]/reply`
Надіслати відповідь на повідомлення.

```json
// Request
{ "content": "Текст відповіді", "sendToTelegram": true }

// Response
{ "success": true, "reply": { "id": "...", "content": "...", "sentAt": "..." } }
```

## Prisma Schema

```prisma
model TelegramUser {
  id            String    @id @default(cuid())
  telegramId    BigInt    @unique
  username      String?
  firstName     String?
  lastName      String?
  languageCode  String    @default("uk")
  isAdmin       Boolean   @default(false)
  isBlocked     Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastActiveAt  DateTime  @default(now())
}

model TelegramSession {
  id          String   @id @default(cuid())
  telegramId  BigInt   @unique
  data        Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model TelegramAdmin {
  id          String   @id @default(cuid())
  telegramId  BigInt   @unique
  username    String?
  name        String
  role        String   @default("admin")
  permissions Json     @default("[]")
  isActive    Boolean  @default(true)
}
```

## Розробка

### Локальний запуск

```bash
# 1. Встановити залежності
npm install

# 2. Згенерувати Prisma
npx prisma generate

# 3. Запустити dev server
npm run dev

# 4. Для тестування без Telegram - 
#    Admin панель доступна в dev mode
```

### Polling Mode (для розробки)

```typescript
// scripts/telegram-bot-polling.ts
import { getBot } from '../src/lib/bot';

const bot = getBot();
bot.start();
```

## Troubleshooting

### Webhook не працює
1. Перевірте TELEGRAM_BOT_TOKEN
2. Перевірте URL сайту (повинен бути HTTPS)
3. Перевірте логи в Vercel

### Admin панель не відкривається
1. Перевірте NEXT_PUBLIC_SITE_URL
2. Додайте Telegram ID в TELEGRAM_ADMIN_IDS
3. Або додайте через Prisma в TelegramAdmin таблицю

### Сесії не зберігаються
1. Перевірте DATABASE_URL
2. Запустіть `npx prisma db push`
3. Перевірте логи Prisma

## Порівняння з попередньою версією

| Feature | Старий бот | grammY |
|---------|-----------|--------|
| HTTP Client | Raw fetch | grammy API |
| Sessions | Memory Map | PostgreSQL |
| Menus | Inline keyboards | @grammyjs/menu |
| Conversations | Manual state | @grammyjs/conversations |
| Rate Limiting | ❌ | @grammyjs/ratelimiter |
| Auto Retry | ❌ | @grammyjs/auto-retry |
| Type Safety | Partial | Full |
| Admin Panel | Basic | Premium Web App |
