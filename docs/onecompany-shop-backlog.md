# One Company SHOP Backlog

## Done
- Urban storefront shell, theme transfer, collections and product pages.
- Catalog admin: products, variants, collections, categories, media.
- Operations admin: inventory, pricing, orders, settings.
- Admin RBAC foundation and audit log.
- Checkout quote/order snapshot flow for guest checkout.
- Customers domain: registration, credentials auth, account page, addresses and order history shell.
- B2B approval flow: customer apply, admin approve/revert, audit log, notification hook.
- B2B pricing policy: percentage-based default discount and per-customer override, with explicit B2B price fields acting as overrides.
- Persistent DB-backed cart with guest token, customer cart merge and item-level cart routes.
- Public shop product APIs with effective pricing, category/collection data and B2B visibility handling.
- Logged-in checkout prefill, customer-linked orders and B2B pricing audience snapshot.
- Bundles domain: linked bundle products, component items, admin CRUD and bundle stock logic based on component availability.
- Shipment domain: order-linked shipments, tracking CRUD, public shipment visibility and shipment-driven order status sync.
- CSV import center: template CRUD, header remapping, dry-run/commit jobs, conflict modes and row-level error reporting.
- Automated shop coverage: unit, integration and API E2E suites, plus optional browser storefront smoke.
- SEO and analytics hardening: collection sitemap coverage, structured data, shop noindex rules for private routes, and cart analytics.

## In Progress
- Optional browser storefront E2E smoke on live dev server (`SHOP_BROWSER_E2E=1`).

## Missing
- No open backlog items in the current One Company SHOP implementation track.
