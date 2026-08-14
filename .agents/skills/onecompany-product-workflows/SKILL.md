---
name: onecompany-product-workflows
description: Локальна модель роботи з товарами: каталоги, атрибути, воронка конверсії, доступність, зручність пошуку та менеджмент SKU.
---

# OneCompany Product Workflow Skill

Apply to tasks related to products, variants, catalogs, PDP/PLP, search, filters, merchandising, and inventory visibility.

## 1. Product Data Canon

- PostgreSQL models `ShopProduct`, `ShopProductVariant`, media, categories,
  collections, fitment, and their relations are the editable catalog source.
- Admin writes go through `/api/admin/shop/products` with DB-backed permissions,
  validation, a Prisma transaction, audit logging, and route revalidation.
- Generated `public/catalog-fallback/`, `public/catalog-index/`, and snapshot JSON are
  resilience/build artifacts, not an alternate admin database.
- Keep SKU, relation IDs, paired UA/EN fields, fitment, media, availability, and all
  price bands semantically stable.

## 2. Read path and overrides

- Trace storefront data through `src/lib/shopCatalogServer.ts` before editing a page.
- PostgreSQL normally wins, but `SHOP_PRODUCT_IMAGE_OVERRIDES` is applied after DB
  mapping for listed SKUs and therefore supersedes admin-managed images.
- Product/variant `null` price inheritance must be preserved. A missing variant price
  does not automatically mean “price on request”.
- Account for ISR, in-process/Accelerate cache, and on-demand revalidation when a DB
  edit is not immediately visible.

## 3. Catalog UX and discovery

- PLP/collection pages need stable routing, filters, sort, stock/quote cues, price,
  and a clear primary action.
- PDPs need correct hero/gallery, localized title/description/specs, fitment,
  availability, price inheritance, and purchase/quote controls.
- Use only real approved product imagery. Never replace an unknown image with an
  unrelated collection image, stock placeholder, or AI-generated asset.
- Prefer existing server query builders and generated filter indexes; avoid duplicate
  client-side catalog logic and N+1 reads.

## 4. Admin mutation checklist

- Enforce `shop.products.read`/`shop.products.write` as appropriate.
- Validate category, collection, media, and relation identifiers.
- Preserve stable IDs; do not delete variants referenced by inventory, cart, bundle,
  or order records.
- Keep the audit record and UA/EN canonical plus legacy path revalidation.
- Verify the final PLP/PDP output after the write, not only the API response.

## 5. Operational guardrails

- Supplier/import scripts must default to inspection or dry run where implemented;
  any `--commit`/publish path is an explicit data mutation.
- Schema changes require a forward migration and disposable replay validation.
- Product-facing code changes need UA/EN parity and narrow unit/browser checks.
- Do not verify writes, carts, checkout, or imports against Production without exact
  authorization.
