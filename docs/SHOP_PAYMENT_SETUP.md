# Налаштування оплати магазину

Підтримуються три способи оплати: **оплата на ФОП**, **Stripe** (картка), **White Bit** (у майбутньому).

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
   - URL: `https://ваш-домен/api/shop/stripe/webhook`
   - Подія: `checkout.session.completed`
   - Скопіюйте **Signing secret** у `STRIPE_WEBHOOK_SECRET`

3. **Увімкнення в магазині**: Адмінка → Налаштування → Оплата → увімкніть «Увімкнено Stripe (картка)».

4. **Валюти**: Stripe Checkout підтримує EUR та USD. Якщо клієнт обрав UAH, варіант Stripe не підходить (показана помилка або потрібно обрати EUR/USD).

## White Bit

Опція зарезервована в налаштуваннях і в виборі способу оплати. Інтеграція буде додана окремо; зараз вибір White Bit обробляється як оплата на ФОП.

## Міграція БД

Після оновлення коду виконайте міграцію Prisma для нових полів оплати та статусу замовлення:

```bash
npx prisma migrate deploy
```

(Локально: `npx prisma migrate dev --name add_payment_methods`.)

Нові поля:

- **ShopOrder**: `paymentMethod`, `stripeCheckoutSessionId`; статус `PENDING_PAYMENT`.
- **ShopSettings**: `fopCompanyName`, `fopIban`, `fopBankName`, `fopEdrpou`, `fopDetails`, `stripeEnabled`, `whiteBitEnabled`.
