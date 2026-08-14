---
description: Scaffold a new shop brand storefront.
---

# Add a new shop brand

Trigger: user asks for `/add-brand {BrandName}`.

Read `AGENTS.md`, `.agents/PROJECT_CONTEXT.md`, the storefront route registry, and
one current neighboring brand implementation first. Brand registration is no longer
just a page scaffold.

## 1. Gather context

- Brand niche, signature colors, hero visual direction. Ask the user if not provided — don't guess.
- Pick the URL slug (lowercase, kebab-case).

## 2. Scaffold pages

- Storefront home: `src/app/[locale]/shop/{slug}/page.tsx`. Mirror an existing brand layout — `burger`, `urban`, or `brabus` are good templates depending on the desired style. Use a real brand hero image (no placeholders).
- Per-brand CSS lives next to the page (e.g. `src/app/[locale]/shop/{slug}/{slug}-shop.css`), following the existing brands' pattern.
- Collection grid component: `src/app/[locale]/shop/components/{BrandName}CollectionProductGrid.tsx` — use `ShopPrimaryPriceBox` for pricing.

## 3. Data wiring

- Home data file: `src/app/[locale]/shop/data/{slug}HomeData.ts` exporting `FEATURED_MODELS`, `COLLECTIONS`, and the signature copy block.
- Add the brand to the global directory in `src/app/[locale]/shop/data/ourStores.ts`.
- Register canonical paths and aliases in `src/lib/storefrontRouteRegistry.ts` and
  `src/lib/shopStorefrontRouting.ts` where the current neighboring implementation
  requires them.
- Catalog products belong in PostgreSQL. Extend `src/lib/shopCatalogServer.ts` and
  build/filter mappings only where a genuinely new brand path requires it; do not
  hand-edit generated catalog fallback/index files.
- Add UA + EN strings to `src/lib/messages/` — both locales are mandatory.

## 4. Verify

- Use an available browser-control skill against the already-running local server.
- Check UA and EN, canonical/legacy URL behavior, hero assets, empty and populated
  collections, product cards, pricing audience behavior, mobile layout, and browser
  console/network errors.
- Run the relevant unit and SEO contract tests. Do not use Production product writes
  or checkout as verification.
