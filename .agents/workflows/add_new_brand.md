---
description: How to orchestrate the generation of a new Shop Brand via AI automation
---

# 🏭 Workflow: Generating a New Shop Brand

When the user asks you to `/add-brand {BrandName}`, execute the following sequence precisely and autonomously:

## 1. Information Gathering
- If the user did not provide a description of the brand (e.g. its niche, signature color), search online or prompt the user for the "Brand Vibe" (e.g., "Glassmorphism black-and-gold").
- Identify the brand `slug` (e.g., `brand-name` in lowercase).

## 2. Generate Storefront Pages
- **Route**: Create `src/app/[locale]/shop/{slug}/page.tsx`. Use the `Brabus` or `Urban` layout as a standard template. Include a Hero section with a placeholder 16:9 image.
- **Components**: Create `src/app/[locale]/shop/components/{BrandName}CollectionProductGrid.tsx` using `ShopPrimaryPriceBox` for pricing.

## 3. Generate Catalog Content
- Create `src/app/[locale]/shop/data/{slug}HomeData.ts` to export arrays for `FEATURED_MODELS`, `COLLECTIONS`, and a main signature text block.
- Update `src/app/[locale]/shop/data/ourStores.ts` to include the new brand in the Global Shop directory.

## 4. Hook up the Data
- Ensure `src/lib/shopCatalog.ts` understands the new brand if adding static products.
- Ensure the `layout.tsx` or Header components are linked mathematically correctly if they hardcode brand headers.

## 5. Verification
- Use `browser_subagent` to navigate to `http://localhost:3000/ua/shop/{slug}`.
- Make a screenshot of the new Landing Page and present it to the user.
