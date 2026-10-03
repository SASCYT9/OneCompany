# Site commerce fixes — 2026-10-03

Implementation follows the owner's 23-point audit. Work is isolated in
`OneCompany-site-commerce-fixes`, based on `origin/master` at `094fc184`.
The owner approved release of the prepared package on October 3. Release results
and the exact deployed commit are recorded separately in the output evidence.
No production schema migration or global price-data rewrite is part of this release.

## Production visibility operation

The owner approved hiding hoses/clamps up to USD 200 and confirmed that more
expensive products remain. Read-only selection: 790 candidates; 693 selected
(677 DO88, 12 Mikalor, 4 Burger), 97 above USD 200 retained. The original 34
ambiguous titles were individually reviewed: 31 eligible hoses and 3 expensive
hoses, rather than complete intercoolers/radiators. The final classifier reflects
that distinction.
Maximum variant price is checked. All records and order relations are retained.

Before-image, review CSV, version-checked plan, results and verification are in
ignored `outputs/site-commerce-2026-10-03/`. Fresh dry-run passed. Changes used
batches of 10 and the canonical mutation coordinator with immutable revisions.
All 693 remain ACTIVE and are unpublished; all 693 visibility outbox events were
verified COMPLETED after invoking the existing Vercel recovery cron. No price,
inventory, media or order-history field was changed.

UA/EN editorial notes were also removed from spoiler URB-SPO-25353093-V1.
The English `Images are selected` sentence needed a second, narrowly scoped
pass. Its fresh before-image and completed publication event are retained under
`spoiler-en-apply/`. Projection completion did not refresh the 24-hour static
PDP cache. Vercel CDN/Data cache was refreshed and the visible public EN page
was checked: both editorial sentences are absent, fitment/finish remain.
An unpublished USD 10 test product OC-CHECKOUT-TEST-10USD was created. It has
not been ordered or paid. Before-images and operation results are retained.

## Local implementation

- Product inquiry: canonical title/SKU and selected variant visible in form,
  re-resolved server-side and carried through stored request and notifications.
- Discovery: compact X5M aliases and Defender family/body distinction; complete
  bounded fitment bridge for ordinary free-text discovery, preserving explicit
  native-selector and engine/fuel/emissions gates. Live read-only queries now
  include iPE X5M/X6M and Urban spoiler/decal in the corrected bridge.
- International checkout: manager request before payment; required 24h consent
  outside Ukraine only; consent/version/date stored in pricing snapshot. Admin
  finalizes shipping and the agreed UAH total. Mono checks exact agreement,
  provider status and paid state; open invoices reused, unknown/closed invoices
  retained for merchant review. Original quote/currency/prices remain inspectable.
  The owner explicitly confirmed manager agreement before payment on October 3.
  Legacy admin shipping edits cannot alter a prepared mono amount; optimistic
  order-version checks reject concurrent edits. Whitepay fiat/crypto and mono
  buttons/API calls require the exact international agreement; a prepared mono
  payment cannot receive a second Whitepay provider link.
  Whitepay fiat/crypto claims an eligible unpaid order atomically before calling
  the provider. Existing attempts, partial payments, refunds, closed orders and
  stale amount/version reads reject. Ambiguous provider responses retain the
  claim for merchant reconciliation, preventing another full-total link.
  Prepared Whitepay amounts also block later manual shipping changes.
  The admin form has since been moved into the main Payment section. It shows
  delivery calculation, client agreement and payment-link preparation as three
  steps, with a visible total and explanatory disabled states.
  Delivery accepts an original amount in USD, EUR or UAH independently of the
  product currency. The server converts it to UAH, preserving source amount,
  currency, converted amount and rate in the agreement/audit. An unchanged
  agreement uses its saved rate; edits use the current shop rate and require
  agreement again. Foreign-shipping saves also validate the previewed converted
  delivery amount. A stale quote refreshes the form and clears client consent.
- Currency: initial Ukraine currency UAH, persisted manual preference preserved,
  country defaults/account sync ordered, streamed related prices hydrate before
  showing restored currency. Rates refresh on focus/every ten minutes.
  Browser testing found the same hydration issue in the main PDP price box;
  that box now follows the stable server currency before restoring the choice.
- NBU: raw EUR/USD cross rate, final EUR/UAH ceiling, source/date stored, invalid
  and stale responses rejected. Manual/daily paths share atomic mutation/audit.
  Daily workflow is opt-in via `SHOP_NBU_DAILY_SYNC_ENABLED=1`; not activated yet.

## Remaining dependencies

- Preserve existing independent price fields. Audit source-price provenance
  before treating several saved currencies as derived prices. All 17,785 audited
  records lack an explicit `price_base_currency`; 8,624 store multiple currencies.
  Largest affected brands: Remus 3,849, KW 1,999, Burger 720, OHLINS 486.
  Atomic supplier
  EUR rate 52 and Moto-only 3% discount remain independent from storefront FX.
- US test address, shipping, final total and refund/retention decision are missing.
  Do not create a production test order or charge a card without agreed details.
- Bank confirmation of permitted imported-item wait time for installments is
  outstanding. Prepare terms/margin scenarios; no external messages authorized.
- Decal restrictions are implemented locally in purchase UI, cart and checkout.
  Publish the prepared UA/EN copy together with these code changes. Exact allowed
  bodykit SKUs remain unknown; the local implementation requires manager review.
- Google stock mapping is implemented locally, but none of the 17,785 audited
  public active records has an explicit availability date. A complete backorder
  feed needs real dates, not estimates invented by the application.
- Finish physical stock reconciliation and final UI acceptance. Existing PDF/
  Telegram tools passed targeted regression checks; the public iPE corrections
  were observed. These tools are accepted,
  not rebuilt. Code release remains a separate owner approval.

## Verification

Node/tsx ENOMEM was a sandbox OS access failure; pure tests pass outside that
boundary. Initial shared dependencies used Next 16.3.3. Final verification uses
an isolated `npm ci --ignore-scripts` with the repository's `.npmrc`, unchanged
lock-file, Node 22.23.3, Next 16.2.11 and an independently generated Prisma client.
The primary checkout's dependencies/client were not modified.
A labeled disposable local pgvector PostgreSQL 17 container uses
`127.0.0.1:55543`, database `monobank_test_site_commerce`; all 47 migrations passed.
Existing mono persistence tests passed creation races, atomic settlement,
stale/replayed statuses, refunds and unknown-response recovery. Never point
checkout tests at production. Latest run: 117 passed, 0 failed, 0 skipped — 100
targeted unit/route/proforma tests plus 17 payment persistence tests. TypeScript
passed. Final source/test ESLint has 0 errors; warnings remain and are recorded
in the validation artifact. No live bank charge or production checkout E2E ran.
Review fixes also preserve canonical inquiry text and encode it at output sinks,
use atomic local operation manifests, remove the local runtime installer from
the release, create ignored evidence directories when absent and require explicit
portable Vercel CLI/project arguments for publication recovery. Decal inquiry
buttons no longer introduce nested anchors. Google availability and date both
derive from the same resolved warehouse/storefront availability.

Browser checks covered UA/EN checkout, required consent outside Ukraine, manual
currency persistence, product inquiry title/SKU, Urban package inquiry button,
main PDP currency, and Eventuri related prices after a UAH switch and reload.
Generated September 25 fallback shards were copied without editing for local
UI fixtures; they are not evidence of current inventory or public prices.
The matching Next 16.2.11 storefront checks passed without browser errors.

The real local admin form was also tested with a synthetic order/admin in the
disposable DB: EUR 100 converted to UAH 5,300, shipping UAH 500, agreed total
UAH 5,800. Amount, line price, original pricing snapshot and audit/history were
saved; payment remained UNPAID. Before agreement all payment buttons were
disabled. Turbopack's local admin renders timed out (88–95s); Webpack completed
the same flow successfully. No runtime workaround was committed. Full
production build/Preview deployment and real manager notification receipt
remain release acceptance steps. The code is now in the approved release process.

The redesigned form was checked at desktop width 1440 and mobile width 390;
mobile document width matched its viewport. Keyboard agreement, inline invalid
cost errors, saved agreement and payment blocking after an unsaved edit passed.
The original and redesigned forms were also inspected together at matching
625px viewports. Accepted captures are saved in the output directory:
`admin-international-form-preview.jpg`, `02-form-redesigned-desktop.jpg`,
`03-form-agreed-desktop.jpg`, `04-form-redesigned-mobile.jpg` and
`05-form-after-matched-viewport.jpg`.

Currency verification used only the disposable local DB: delivery USD 20 saved
as UAH 921.74 with source USD 20 retained; final order UAH 6,221.74 remained
UNPAID. Changing the local EUR/UAH rate from 53 to 54 did not change that saved
agreement. Selecting EUR began a new calculation and blocked payment. Original
local demo rates were restored afterward. No production prices or bank charges
were changed during this UI/currency work.

## Ordered remaining plan

| Priority | Owner items | Current evidence and next acceptance |
|---|---|---|
| 1 | 1–4: payment and international flow | Local code, route/persistence checks and browser agreement flow passed. Shipping/international-payment bypasses are guarded. Complete release build/Preview gates, approve code release, publish the test product and run Igor's agreed US test. |
| 2 | 6–10: currency and delivery text | Defaults, related prices, shared NBU sync and UA/EN copy prepared. Daily sync remains off. 8,624 records store multiple currencies independently; identify source price/currency before migrating those values or claiming a complete daily recalculation. |
| 3 | 11: hoses/clamps | Production operation complete: 693 hidden, 97 expensive retained, 693 publication events completed. |
| 4 | 12–15: discovery, inquiries, Urban | Local discovery/inquiry/package policy prepared and inquiry UI verified; actual canonical SKU tested through simulated stored/email/bot/Telegram channels. Spoiler copy is clean on the public EN page. Verify actual manager request receipt after release; bodykit SKU mapping and better spoiler photo remain open. |
| 5 | 5: installments | Bank terms, margin examples and questions prepared in the companion document. Need store-specific tariff and written import-wait confirmation before activation. |
| 6 | 16: Akrapovič moto | Weekly workflow success observed. Existing supplier EUR rate 52 and Moto-only 3% discount remain unchanged; reconcile the requested no-discount outcome with the authoritative supplier before changing prices. |
| 7 | 17–18: PDF/pro forma and Telegram | Existing tools inspected; 28 targeted document/draft/image/export regressions passed. Actual operational user acceptance remains separate. |
| 8 | 19–21: iPE, G-Sport, stock carousel | Public iPE photo/price and G-Sport cards observed. Physical warehouse counts and complete iPE/Fi stock reconciliation need the inventory source. Brand carousel links implemented locally. |
| 9 | 22: Google stock | Local feed/schema mapping corrected; obtain real availability dates for backorders and validate Merchant Center after release. |
| 10 | 23: crossed prices | Existing UI guards require a real price difference. Raw audit found 1,357 compare fields at or below current price; this alone does not prove a rendered false discount. Wider rendered sampling remains open. |

The UAH/EUR/USD country defaults are implementation assumptions for review;
no IP-based country detection was introduced. The owner confirmed mandatory
international consent and agreement before payment. Explicit
manual currency choice persists. Advanced landed-cost international quotes
require import-cost review before a payable sum is finalized.
