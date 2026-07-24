-- Remove a deliberately excluded Atomic catalog item while preserving any
-- historical cart/order snapshots that may reference it.
WITH target_products AS (
  SELECT "id"
  FROM "ShopProduct"
  WHERE lower(COALESCE("sku", '')) = 'v-tuv049/1'
     OR "slug" = 'akrapovic-v-tuv049-1'
)
DELETE FROM "ShopBundleItem"
WHERE "componentProductId" IN (SELECT "id" FROM target_products);

WITH target_variants AS (
  SELECT "id", "productId"
  FROM "ShopProductVariant"
  WHERE "productId" IN (
    SELECT "id"
    FROM "ShopProduct"
    WHERE lower(COALESCE("sku", '')) = 'v-tuv049/1'
       OR "slug" = 'akrapovic-v-tuv049-1'
  )
)
UPDATE "ShopCartItem"
SET
  "productId" = NULL,
  "variantId" = NULL
WHERE "productId" IN (SELECT "productId" FROM target_variants)
   OR "variantId" IN (SELECT "id" FROM target_variants);

UPDATE "ShopOrderItem"
SET "productId" = NULL
WHERE "productId" IN (
  SELECT "id"
  FROM "ShopProduct"
  WHERE lower(COALESCE("sku", '')) = 'v-tuv049/1'
     OR "slug" = 'akrapovic-v-tuv049-1'
);

DELETE FROM "ShopProduct"
WHERE lower(COALESCE("sku", '')) = 'v-tuv049/1'
   OR "slug" = 'akrapovic-v-tuv049-1';
