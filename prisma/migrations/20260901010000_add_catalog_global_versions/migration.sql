CREATE TABLE "ShopCatalogGlobalVersion" (
  "entityType" "ShopCatalogPublicationEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "currentVersion" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCatalogGlobalVersion_pkey" PRIMARY KEY ("entityType", "entityId"),
  CONSTRAINT "ShopCatalogGlobalVersion_non_product_check" CHECK ("entityType" IN ('PRICE_BOOK', 'SETTINGS')),
  CONSTRAINT "ShopCatalogGlobalVersion_version_check" CHECK ("currentVersion" >= 0)
);

CREATE INDEX "ShopCatalogGlobalVersion_updatedAt_idx" ON "ShopCatalogGlobalVersion"("updatedAt");

CREATE TRIGGER "ShopCatalogGlobalVersion_no_delete"
  BEFORE DELETE ON "ShopCatalogGlobalVersion"
  FOR EACH ROW EXECUTE FUNCTION catalog_v2_reject_cursor_delete();
