---
name: onecompany-commerce-domain
description: Бізнес-орієнтована навігація рішень для OneCompany: B2B/B2C сегментація, WhitePay, Turn14 та операційна модель магазину.
---

# OneCompany Commerce Domain Skill

Use this whenever product, pricing, order, account, payment, catalog-sync, or fulfillment logic is touched.

## 1. Sources of truth

- PostgreSQL/Prisma owns catalog, customers, carts, orders, inventory, pricing rules,
  RBAC, and Operations state.
- `src/lib/shopPricingAudience.ts` owns audience-aware B2C/B2B/Europe price
  resolution. Use the existing money, conversion, VAT, and discount helpers around
  it.
- Product/variant prices exist per currency and may include Europe, B2B, and
  compare-at values. A variant `null` can intentionally inherit from the product;
  never collapse `null` and zero.
- The immutable order pricing snapshot is the commercial record. Do not recalculate
  historical order amounts from current catalog prices.

## 2. End-to-end change discipline

For a price or checkout change, trace:

1. product/variant database fields and inheritance;
2. B2C/B2B/Europe audience and VAT resolution;
3. list/PDP display;
4. cart calculation and persisted cart line;
5. checkout validation and order snapshot;
6. WhitePay request, emails/Telegram, and admin order display.

Keep customer and admin authentication separate. Preserve current RBAC and audit
boundaries for internal changes.

## 3. Orders and availability

- Preserve stock, supplier, fitment, shipping, and quote constraints before checkout.
- Keep state transitions explicit, validated, and auditable; UI labels do not define
  order state.
- Reuse the domain service and transaction patterns already used by the owning API.
- Keep UA/EN customer copy and currency semantics aligned.

## 4. Integration safety

- WhitePay, Shopify, supplier syncs, Airtable exports, CRM webhooks, Resend,
  Telegram, and Blob operations can mutate external systems.
- Read the exact command/route. Names such as `sync`, `dry`, and `preview` are not a
  safety guarantee unless implementation confirms them.
- Preserve authentication, signature verification, idempotency, retry behavior, and
  observable failure states.
- Never run checkout or order E2E against Production. Use a disposable database and
  sandboxed/non-production integrations.

## 5. Delivery Checklist

- B2C, B2B, Europe, VAT, and quote behavior remain explicit.
- Product fallback and variant inheritance were tested.
- Display, cart, checkout, order snapshot, notifications, and admin stay consistent.
- External failure and user recovery states are concrete.
- No production-capable mutation was used merely for verification.
