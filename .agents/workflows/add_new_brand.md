---
description: Scaffold a new shop brand storefront.
---

# Add a new shop brand

Trigger: user asks for `/add-brand {BrandName}`.

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
- If static products are involved, register the brand in `src/lib/shopCatalog.ts`.
- Add UA + EN strings to `src/lib/messages/` — both locales are mandatory.

## 4. Verify
- Open `http://localhost:3000/ua/shop/{slug}` in the running dev server (use Claude Preview MCP).
- Check both UA and EN locales render, hero image loads, product grid prices via `ShopPrimaryPriceBox`, no console errors.
