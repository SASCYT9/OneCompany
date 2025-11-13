# 🤖 Telegram Bot - Локальна Розробка

## 🚨 ВАЖЛИВО: Long Polling для Local Dev

Для **локальної розробки** Telegram бот працює через **Long Polling**, а не webhook!

Webhook працює тільки для production (з публічним HTTPS URL).

---

## 🚀 Швидкий старт

### 1. Запустіть dev server (один термінал):

```bash
npm run dev
```

### 2. Запустіть Telegram bot polling (другий термінал):

```bash
npm run bot
```

### 3. Відкрийте Telegram і надішліть `/start` вашому боту

Ви побачите меню з кнопками! 🎉

---

## 📊 Що ви побачите

### В терміналі бота:

```
╔════════════════════════════════════════╗
║  🤖 Telegram Bot - Local Development  ║
╚════════════════════════════════════════╝

✅ Bot connected: OneCompany (@OneCompanyAutoBot)
✅ Local API available: active

🚀 Bot is ready! Send /start to your bot in Telegram
Press Ctrl+C to stop
═════════════════════════════════════════════════════

📨 New update: 123456789
💬 Message from: Sasha
📝 Text: /start
✅ Update processed: { ok: true }
```

### В Telegram боті:

```
Вітаємо, Sasha! 👋

🏆 OneCompany
Преміум автомобільні та мотоциклетні запчастини

💎 Понад 200 світових брендів
⚡ Швидка доставка по Україні
🔧 Професійна консультація

👇 Оберіть що вас цікавить:

[🏆 Наші бренди] [📱 Контакти]
[🌐 Web3 Dashboard] [❓ Допомога]
[🚗 Авто запчастини] [🏍️ Мото запчастини]
```

---

## 🔧 Як це працює

### Архітектура:

```
Telegram User
    ↓
[Telegram API]
    ↓
Long Polling (scripts/telegram-bot-polling.js)
    ↓ HTTP POST
Local Webhook Handler (localhost:3001/api/telegram/webhook)
    ↓
Bot Logic (inline buttons, commands, etc.)
    ↓
Response to Telegram
```

### Процес:

1. **Bot Polling скрипт** постійно запитує Telegram API про нові повідомлення
2. Отримує updates (повідомлення, натискання кнопок)
3. Відправляє їх на **локальний webhook** endpoint (`/api/telegram/webhook`)
4. Webhook обробляє update і відправляє відповідь назад в Telegram
5. Користувач бачить відповідь з кнопками

---

## 🎮 Тестування функцій

### 1. Головне меню:

```
/start
```

Очікується: 6 кнопок (Бренди, Контакти, Dashboard, Допомога, Авто, Мото)

### 2. Наші бренди:

Натисніть **🏆 Наші бренди** → Оберіть категорію

Очікується: Меню з вибором (Авто/Мото/Всі бренди)

### 3. Web3 Dashboard:

Натисніть **🌐 Web3 Dashboard**

Очікується: Посилання на `http://localhost:3001/messages`

### 4. Заявка:

Натисніть **🚗 Авто запчастини** → Введіть дані

Очікується: 
- Повідомлення збережено в Dashboard
- Відправлено в TELEGRAM_CHAT_ID
- Відповідь з кнопками

---

## 📝 Логи та Debug

### Логи в bot polling терміналі:

```bash
📨 New update: 123456789
💬 Message from: Sasha
📝 Text: /start
✅ Update processed: { ok: true }

📨 New update: 123456790
🔘 Button pressed: btn_brands
👤 By: Sasha
✅ Update processed: { ok: true }
```

### Логи в dev server терміналі:

```bash
Received Telegram Webhook: {
  "callback_query": {
    "id": "123...",
    "data": "btn_brands",
    "from": { "first_name": "Sasha" }
  }
}
✅ Message saved to store: msg_1699888888888_abc123
```

---

## 🛑 Зупинка бота

В терміналі де запущений бот натисніть **Ctrl+C**:

```
^C
🛑 Stopping bot polling...
```

Dev server можна залишити запущеним.

---

## 🔄 Restart після змін коду

### Якщо змінили код в `src/app/api/telegram/webhook/route.ts`:

1. **Dev server** автоматично перезавантажиться (Hot Reload)
2. **Bot polling** НЕ треба перезапускати - він просто шле запити на API

### Якщо змінили код в `scripts/telegram-bot-polling.js`:

1. Зупиніть бот (Ctrl+C)
2. Запустіть знову: `npm run bot`

---

## ⚠️ Типові помилки

### ❌ "Local API not available"

**Проблема:** Dev server не запущений

**Рішення:**
```bash
npm run dev
```

### ❌ "Bot connection failed"

**Проблема:** Неправильний `TELEGRAM_BOT_TOKEN`

**Рішення:** Перевірте `.env.local`:
```bash
TELEGRAM_BOT_TOKEN=8449589510:AAHFS3DVvVd--pCqsFPUIEji1IeJ8MOVJc4
```

### ❌ Бот не відповідає на повідомлення

**Проблема:** Bot polling не запущений

**Рішення:**
```bash
npm run bot
```

### ❌ "Failed to process submission" в формі контактів

**Проблема:** `TELEGRAM_AUTO_CHAT_ID` або `TELEGRAM_MOTO_CHAT_ID` не налаштовані

**Рішення:** Додайте в `.env.local`:
```bash
TELEGRAM_CHAT_ID=-4715426437
TELEGRAM_AUTO_CHAT_ID=-4715426437
TELEGRAM_MOTO_CHAT_ID=-4715426437
```

---

## 🌐 Production Deployment

### Для production використовуйте webhook:

1. Деплойте на сервер з публічним HTTPS URL
2. Налаштуйте webhook:

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/telegram/webhook"}'
```

3. Long polling НЕ потрібен на production!

---

## 📊 Перевірка стану

### Поточний режим бота:

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**Local dev (polling):**
```json
{
  "ok": true,
  "result": {
    "url": "",
    "pending_update_count": 0
  }
}
```

**Production (webhook):**
```json
{
  "ok": true,
  "result": {
    "url": "https://yourdomain.com/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## 🎯 Quick Checklist

- [ ] `npm run dev` - запущений ✅
- [ ] `npm run bot` - запущений ✅  
- [ ] `.env.local` - всі токени налаштовані ✅
- [ ] Відправив `/start` в Telegram ✅
- [ ] Бачу кнопки в боті ✅
- [ ] Кнопки працюють ✅
- [ ] Повідомлення з'являються в Dashboard ✅

---

**Готово! Тепер ваш Telegram бот працює локально! 🚀**

Відкрийте Telegram → знайдіть `@OneCompanyAutoBot` → надішліть `/start` 🎉
