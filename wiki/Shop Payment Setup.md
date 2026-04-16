---
tags: [stripe, payments, whitepay, admin]
aliases: [Payment Setup]
---

# 💳 Налаштування оплати магазину

Підтримуються три способи оплати: **оплата на ФОП**, **Stripe** (картка), **WhitePay** (криптовалюта).

## Оплата на ФОП

У **Адмінка → Налаштування магазину → Оплата** заповніть:

- **ФОП — назва / ПІБ** — отримувач платежу
- **ФОП — IBAN** — рахунок для переказу
- **ФОП — банк** — назва банку
- **ФОП — ЄДРПОУ** — за бажанням
- **ФОП — додаткові реквізити** — вільний текст (МФО, призначення платежу тощо)

Після оформлення замовлення з способом «Оплата на ФОП» клієнт бачить ці реквізити на сторінці успіху та в листі (якщо додати блок у шаблон листа).

## Stripe (картка)

1. **Змінні середовища** (Vercel / .env):
   - `STRIPE_SECRET_KEY` — секретний ключ з Dashboard Stripe (ключі API)
   - `STRIPE_WEBHOOK_SECRET` — signing secret webhook’а

2. **Webhook у Stripe Dashboard**:
   - Developers → Webhooks → Add endpoint
   - URL: `https://onecompany.global/api/webhooks/stripe`
   - Подія: `checkout.session.completed`
   - Скопіюйте **Signing secret** у `STRIPE_WEBHOOK_SECRET`

3. **Увімкнення в магазині**: Адмінка → Налаштування → Оплата → увімкніть «Увімкнено Stripe (картка)».

4. **Валюти**: Stripe Checkout підтримує EUR та USD. Якщо клієнт обрав UAH, варіант Stripe не підходить (показана помилка або потрібно обрати EUR/USD).

## WhitePay (Crypto / Apple Pay)

WhitePay налаштовано як основний платіжний шлюз для прийому криптовалюти (USDT, BTC) та фіату. Налаштування API ключів знаходиться в `.env` (`WHITEPAY_TOKEN`).
Webhook обробник лежить у `src/app/api/webhooks/whitepay/route.ts`.

## База Даних

Поля оплати та статус замовлення:

- **ShopOrder**: `paymentMethod`, `stripeCheckoutSessionId`; статус `PENDING_PAYMENT`, `amountPaid`.
- **ShopSettings**: `fopCompanyName`, `fopIban`, `fopBankName`, `fopEdrpou`, `fopDetails`, `stripeEnabled`, `whiteBitEnabled`.