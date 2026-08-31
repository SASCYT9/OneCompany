-- Progressive catalog facets always begin with the published brand aggregate.
-- Keep that first request index-only at hundreds of thousands of products.
CREATE INDEX "ShopCatalogProjection_locale_isPublished_statusKey_brandKey_idx"
ON "ShopCatalogProjection"("locale", "isPublished", "statusKey", "brandKey");

CREATE TABLE "ShopCatalogProjectionFacetCount" (
  "locale" TEXT NOT NULL,
  "dimension" TEXT NOT NULL,
  "prefixKey" TEXT NOT NULL,
  "valueKey" TEXT NOT NULL,
  "valueLabel" TEXT NOT NULL,
  "productCount" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogProjectionFacetCount_pkey"
    PRIMARY KEY ("locale", "dimension", "prefixKey", "valueKey"),
  CONSTRAINT "ShopCatalogProjectionFacetCount_locale_check" CHECK ("locale" IN ('ua', 'en')),
  CONSTRAINT "ShopCatalogProjectionFacetCount_dimension_check" CHECK ("dimension" IN ('BRAND', 'MAKE')),
  CONSTRAINT "ShopCatalogProjectionFacetCount_count_check" CHECK ("productCount" >= 0)
);

CREATE INDEX "ShopCatalogFacetCount_lookup_idx"
ON "ShopCatalogProjectionFacetCount"("locale", "dimension", "prefixKey", "productCount");

-- Forward-safe backfill for installations that already have shadow projections.
INSERT INTO "ShopCatalogProjectionFacetCount"
  ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
SELECT
  "locale", 'BRAND', '', "brandKey", min("brandLabel"), count(*)::integer, CURRENT_TIMESTAMP
FROM "ShopCatalogProjection"
WHERE "isPublished" = true AND "statusKey" = 'ACTIVE' AND "brandKey" <> ''
GROUP BY "locale", "brandKey";

INSERT INTO "ShopCatalogProjectionFacetCount"
  ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
SELECT
  "locale", 'BRAND', concat('scope:', "scopeKey"), "brandKey",
  min("brandLabel"), count(*)::integer, CURRENT_TIMESTAMP
FROM "ShopCatalogProjection"
WHERE "isPublished" = true AND "statusKey" = 'ACTIVE' AND "brandKey" <> ''
GROUP BY "locale", "scopeKey", "brandKey";

WITH make_products AS (
  SELECT DISTINCT
    projection."locale", projection."scopeKey", projection."brandKey",
    constraint_row."productId", lower(constraint_row."textValue") AS value_key,
    constraint_row."textValue" AS value_label
  FROM "ShopCatalogProjectionConstraint" constraint_row
  JOIN "ShopCatalogProjectionClause" clause
    ON clause."targetKey" = constraint_row."targetKey"
   AND clause."clauseKey" = constraint_row."clauseKey"
   AND clause."productId" = constraint_row."productId"
   AND clause."sourceVersion" = constraint_row."sourceVersion"
   AND clause."verification" = 'VERIFIED'
  JOIN "ShopCatalogProjection" projection
    ON projection."productId" = constraint_row."productId"
   AND projection."isPublished" = true
   AND projection."statusKey" = 'ACTIVE'
  WHERE constraint_row."dimension" = 'MAKE'
    AND constraint_row."state" = 'EXACT'
    AND constraint_row."textValue" IS NOT NULL
    AND constraint_row."textValue" <> ''
)
INSERT INTO "ShopCatalogProjectionFacetCount"
  ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
SELECT "locale", 'MAKE', concat('brand:', "brandKey"), value_key,
  min(value_label), count(*)::integer, CURRENT_TIMESTAMP
FROM make_products
GROUP BY "locale", "brandKey", value_key;

WITH make_products AS (
  SELECT DISTINCT
    projection."locale", projection."scopeKey", projection."brandKey",
    constraint_row."productId", lower(constraint_row."textValue") AS value_key,
    constraint_row."textValue" AS value_label
  FROM "ShopCatalogProjectionConstraint" constraint_row
  JOIN "ShopCatalogProjectionClause" clause
    ON clause."targetKey" = constraint_row."targetKey"
   AND clause."clauseKey" = constraint_row."clauseKey"
   AND clause."productId" = constraint_row."productId"
   AND clause."sourceVersion" = constraint_row."sourceVersion"
   AND clause."verification" = 'VERIFIED'
  JOIN "ShopCatalogProjection" projection
    ON projection."productId" = constraint_row."productId"
   AND projection."isPublished" = true
   AND projection."statusKey" = 'ACTIVE'
  WHERE constraint_row."dimension" = 'MAKE'
    AND constraint_row."state" = 'EXACT'
    AND constraint_row."textValue" IS NOT NULL
    AND constraint_row."textValue" <> ''
)
INSERT INTO "ShopCatalogProjectionFacetCount"
  ("locale", "dimension", "prefixKey", "valueKey", "valueLabel", "productCount", "updatedAt")
SELECT "locale", 'MAKE', concat('scope:', "scopeKey", '|brand:', "brandKey"), value_key,
  min(value_label), count(*)::integer, CURRENT_TIMESTAMP
FROM make_products
GROUP BY "locale", "scopeKey", "brandKey", value_key;
