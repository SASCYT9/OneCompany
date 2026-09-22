# plata by mono acquiring

The checkout method `MONOBANK` opens mono's hosted payment page for card,
Apple Pay, Google Pay, and payment through the mono application. Wallet visibility
depends on mono and the buyer's device/card. No card details enter OneCompany.

Selecting this method switches the visible billing currency to UAH and requests
a fresh server quote. Submission is blocked until that quote is ready. The server
checks the displayed amount against its own calculation and stores the invoice
amount in integer kopecks. Existing manual-quote, B2B, delivery and tax rules apply.
FOP and Whitepay remain available as before.

## Configuration and release

Set these **server-only** variables in the intended environment:

```dotenv
MONOBANK_ENABLED=0
MONOBANK_TOKEN=
MONOBANK_PUBLIC_URL=https://your-environment.example
```

`MONOBANK_TOKEN` is the acquiring token from the merchant business cabinet, not a
bank password. A test token comes from the mono API portal. Do not paste tokens
into chat, commit them, or prefix them with `NEXT_PUBLIC_`.
`MONOBANK_PUBLIC_URL` must be the explicit HTTPS origin for the same environment
and database. A Preview must have its own token, public origin and disposable DB.

1. Review the focused changes against the existing work in the checkout.
2. After authorization for the target, apply the forward migration
   `20260922120000_add_shop_monobank_payment` using the normal migration runbook.
   Do not use `db push`. Deploy with `MONOBANK_ENABLED=0` initially.
3. Configure the appropriate token and public URL, then set `MONOBANK_ENABLED=1`
   for the approved environment. UAH must be enabled in shop settings.
4. Verify the hosted-page redirect, bank status read and signed webhook together.
   The callback is `POST /api/shop/monobank/callback`; it must be publicly reachable
   over HTTPS without preview protection blocking the bank.
5. Before a live payment test, agree on the amount and payment owner. Verify the
   same invoice in the merchant cabinet and the matching order's paid amount.
   Apple Pay and Google Pay do not appear with mono test tokens; verify them with
   the live integration on compatible devices.

Neither creation of this code nor its local tests applies production migrations,
adds Vercel secrets, deploys the site or charges a card.

## State and recovery

- `ShopMonobankPayment` owns one invoice per order. A hashed checkout UUID prevents
  repeated submissions from creating another order; a separate request hash
  prevents that key from being reused for different order details.
- Concurrent invoice requests claim the DB row before calling mono. A lost or
  timed-out create response leaves `creation_unknown` and does not automatically
  repeat the charge request. A verified callback can bind the invoice by the
  opaque reference and recover its payment state.
- A known rejected creation (`400/403/404/405/429`) can be retried from the same
  order. Existing open payment links are reused. Unknown creation, expired or
  closed invoices need merchant review; this release does not create replacements.
- Returning to the result URL is not payment proof. Webhooks require ECDSA-SHA256
  over the original request bytes, and amount/currency/reference/invoice matching.
  Status queries use the same validation. Only confirmed settlement marks an order
  paid; older or duplicate updates cannot roll it back. Refund amounts update the
  financial state without resetting shipment progress.
- The order page polls briefly and allows a manual status refresh or resuming
  payment. Provider reads are limited by a DB timestamp across app instances.
- Disable `MONOBANK_ENABLED` to stop new invoices. Retain the token, callback and
  table so in-flight payments can still settle. Do not delete payment records to
  retry an uncertain request; inspect the merchant cabinet first.

The integration uses ordinary `debit` payments and sends the basket to mono. It
does not configure holds, card storage, subscriptions, refunds from the admin UI,
or fiscalization settings. If the merchant account uses pRRO, review the fiscal
product/tax mapping before enabling it for these invoices.

## Local verification

Pure and route tests (all provider responses synthetic):

```powershell
npx tsx --test tests/shop/unit/shopMonobank.test.ts tests/shop/unit/shopMonobankRoutes.test.ts tests/shop/unit/shopMonobankCheckout.test.ts tests/shop/unit/shopCheckout.test.ts tests/shop/unit/shopOrderPresentation.test.ts
npm run typecheck
```

Persistence tests require a disposable PostgreSQL DB with the schema and migration
applied. The test refuses non-local hosts and database names outside `monobank_test*`:

```powershell
$env:MONOBANK_TEST_DATABASE_URL='postgresql://test:test@127.0.0.1:55439/monobank_test'
npx tsx --test tests/shop/integration/shopMonobank.persistence.test.ts
```

Recorded local verification on 2026-09-22: forward SQL applied to a disposable
PostgreSQL 17 database; creation races, settlement, replay, refunds and timeout
recovery passed. Browser checks used real local checkout/cart rendering with
synthetic payment responses in UA/EN and at desktop/mobile widths. They do not
prove connectivity to a real merchant account or live wallet availability.

## Provider references

- [Invoice creation](https://monobank.ua/api-docs/acquiring/methods/ia/post--api--merchant--invoice--create)
- [Webhook signatures](https://monobank.ua/api-docs/acquiring/dev/webhooks/verify)
- [Public key](https://monobank.ua/api-docs/acquiring/dev/webhooks/get--api--merchant--pubkey)
- [Test environment and wallet limitations](https://monobank.ua/api-docs/acquiring/dev/test/docs--testing)

The supplied FireShot API and brandbook captures were read as reference material.
The checkout names the method as online card payment and explicitly lists
Apple Pay / Google Pay alongside `plata by mono`.
