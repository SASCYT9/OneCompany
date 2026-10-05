-- Null means unresolved. Legacy prices are not assigned a guessed base currency.
ALTER TABLE "ShopProduct"
  ADD COLUMN "priceSourceCurrency" TEXT,
  ADD COLUMN "compareAtSourceCurrency" TEXT,
  ADD COLUMN "b2bPriceSourceCurrency" TEXT,
  ADD COLUMN "b2bCompareAtSourceCurrency" TEXT;
ALTER TABLE "ShopProductVariant"
  ADD COLUMN "priceSourceCurrency" TEXT,
  ADD COLUMN "compareAtSourceCurrency" TEXT,
  ADD COLUMN "b2bPriceSourceCurrency" TEXT,
  ADD COLUMN "b2bCompareAtSourceCurrency" TEXT;
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_price_source_codes" CHECK (
  ("priceSourceCurrency" IS NULL OR "priceSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("compareAtSourceCurrency" IS NULL OR "compareAtSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("b2bPriceSourceCurrency" IS NULL OR "b2bPriceSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("b2bCompareAtSourceCurrency" IS NULL OR "b2bCompareAtSourceCurrency" IN ('EUR','USD','UAH'))
);
ALTER TABLE "ShopProductVariant" ADD CONSTRAINT "ShopProductVariant_price_source_codes" CHECK (
  ("priceSourceCurrency" IS NULL OR "priceSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("compareAtSourceCurrency" IS NULL OR "compareAtSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("b2bPriceSourceCurrency" IS NULL OR "b2bPriceSourceCurrency" IN ('EUR','USD','UAH')) AND
  ("b2bCompareAtSourceCurrency" IS NULL OR "b2bCompareAtSourceCurrency" IN ('EUR','USD','UAH'))
);
