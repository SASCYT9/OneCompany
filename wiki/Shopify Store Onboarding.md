---
tags: [playbook, shopify, whitepay, onboarding]
created: 2026-04-12
---

# 🏪 Shopify Store Onboarding — Crypto Whitepay

Покрокова інструкція для підключення **нового Shopify магазину** до системи крипто-оплати Whitepay через наш централізований додаток.

---

## Архітектура

```
┌──────────────┐    Webhook     ┌──────────────────┐   API    ┌──────────┐
│  Shopify     │ ──────────────>│  One Company      │ ──────> │ Whitepay │
│  Store       │                │  Vercel Backend   │         │ Commerce │
│  (Eventuri)  │ <──────────────│  /api/shopify/*   │ <────── │ (Crypto) │
└──────────────┘   Email+Link   └──────────────────┘  URL    └──────────┘
```

**Один додаток** обслуговує **всі магазини**. Кожен магазин отримує:
- Свій брендований email-шаблон (назва, домен, стилі)
- Локалізовані листи (UA/EN) на основі мови клієнта
- Окремий запис у БД (`ShopifyStore`) з власним access token

---

## Крок 1: Реєстрація магазину в STORE_BRANDING

**Файл:** `src/app/api/shopify/webhooks/order-create/route.ts`

Додайте новий рядок у маппінг `STORE_BRANDING`:

```typescript
const STORE_BRANDING: Record<string, { displayName: string; publicDomain: string }> = {
  '1t4mqk-bv.myshopify.com': { displayName: 'Eventuri Shop Ukraine', publicDomain: 'eventuri.shop' },
  'eventuri-ua.myshopify.com': { displayName: 'Eventuri Shop Ukraine', publicDomain: 'eventuri.shop' },
  // ↓↓↓ Новий магазин ↓↓↓
  'new-store.myshopify.com': { displayName: 'Brand Name', publicDomain: 'brand-domain.com' },
};
```

> **Як знайти Shopify домен:** Админка магазину → Settings → Domains → домен що закінчується на `.myshopify.com`

---

## Крок 2: OAuth Авторизація

Мерчант переходить за посиланням для встановлення додатку:

```
https://onecompany.global/api/shopify/auth/init?shop=NEW-STORE.myshopify.com
```

> Для тестування на Preview використовуйте відповідний Vercel URL замість `onecompany.global`

Після натискання "Install" → Shopify видасть access token → він автоматично збережеться у таблицю `ShopifyStore` в БД.

---

## Крок 3: Налаштування вебхука в Shopify

В адмінці нового магазину:

1. **Settings** → **Notifications** → прокрутити до **Webhooks**
2. **Create webhook:**
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://onecompany.global/api/shopify/webhooks/order-create`
   - Version: найновіша стабільна
3. **Зберегти.** Скопіювати Webhook Signing Secret.

---

## Крок 4: Webhook Secret у Vercel

> ⚠️ **УВАГА:** Наразі ми використовуємо один `SHOPIFY_WEBHOOK_SECRET` для всіх магазинів. Якщо новий магазин має **інший** signing secret, потрібно або:
> - (A) Вимкнути HMAC перевірку для нових магазинів (менш безпечно)
> - (B) Зберігати per-store секрети в БД (правильний шлях, TODO)

---

## Крок 5: Створити спосіб оплати Crypto

В адмінці нового магазину:

1. **Settings** → **Payments** → **Manual payment methods**
2. **Create custom payment method**
3. Назва ОБОВ'ЯЗКОВО має містити одне з слів: `Crypto`, `WhiteBIT`, або `Whitepay`
   - Приклад: `Crypto WhiteBIT (USDT, BTC, ETH)`

Наш бекенд фільтрує замовлення за назвою способу оплати. Якщо назва не містить цих ключових слів — замовлення ігнорується.

---

## Крок 6: Налаштувати App URL (опційно)

Якщо хочете, щоб мерчант бачив красивий дашборд при натисканні на "Whitepay Crypto" в Shopify Admin:

1. **Shopify Partners Dashboard** → Apps → Whitepay Crypto → App setup
2. **App URL:** `https://onecompany.global/api/shopify/app`
3. **Allowed redirection URLs:** `https://onecompany.global/api/shopify/auth/callback`

---

## Крок 7: Деплой і тест

```bash
git add -A
git commit -m "feat: onboard <brand-name> store"
git push origin feature/shop
```

Після деплою:
1. Зайдіть на вітрину нового магазину як покупець
2. Додайте товар у кошик
3. Оберіть `Crypto WhiteBIT` у способах оплати
4. Введіть свій email
5. Оформіть замовлення
6. Перевірте пошту — має прийти брендований лист з кнопкою оплати

---

## Чеклист онбордингу

- [ ] Додано запис у `STORE_BRANDING`
- [ ] Мерчант пройшов OAuth авторизацію
- [ ] Вебхук `Order creation` додано в Shopify
- [ ] Webhook Secret оновлено/підтверджено у Vercel
- [ ] Ручний спосіб оплати "Crypto" створено
- [ ] App URL налаштовано в Shopify Partners (опційно)
- [ ] Тестове замовлення успішно оброблено
- [ ] Email прийшов з правильним брендингом


---

## Поточні підключені магазини

| Shopify Domain | Brand | Public Domain | Status |
|---|---|---|---|
| `1t4mqk-bv.myshopify.com` | Eventuri Shop Ukraine | eventuri.shop | ✅ Active |
| `eventuri-ua.myshopify.com` | Eventuri Shop Ukraine | eventuri.shop | ✅ Active |

---

*Останнє оновлення: 2026-04-12*
