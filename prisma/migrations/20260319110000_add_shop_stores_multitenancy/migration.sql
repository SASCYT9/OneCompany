-- Multi-store foundation for shop catalog/imports.
CREATE TABLE "ShopStore" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopStore_pkey" PRIMARY KEY ("key")
);

INSERT INTO "ShopStore" ("key", "name", "description", "isActive", "sortOrder")
VALUES ('urban', 'Urban Automotive', 'Default store for the current catalog', true, 0)
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "ShopProduct" ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';
ALTER TABLE "ShopCollection" ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';
ALTER TABLE "ShopCategory" ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';
ALTER TABLE "ShopImportTemplate" ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';
ALTER TABLE "ShopImportJob" ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';

ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_storeKey_fkey"
  FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCollection" ADD CONSTRAINT "ShopCollection_storeKey_fkey"
  FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopCategory" ADD CONSTRAINT "ShopCategory_storeKey_fkey"
  FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopImportTemplate" ADD CONSTRAINT "ShopImportTemplate_storeKey_fkey"
  FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShopImportJob" ADD CONSTRAINT "ShopImportJob_storeKey_fkey"
  FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ShopProduct_slug_key";
CREATE UNIQUE INDEX "ShopProduct_storeKey_slug_key" ON "ShopProduct"("storeKey", "slug");
CREATE INDEX "ShopProduct_storeKey_slug_idx" ON "ShopProduct"("storeKey", "slug");
CREATE INDEX "ShopProduct_storeKey_updatedAt_idx" ON "ShopProduct"("storeKey", "updatedAt");

DROP INDEX IF EXISTS "ShopCollection_handle_key";
CREATE UNIQUE INDEX "ShopCollection_storeKey_handle_key" ON "ShopCollection"("storeKey", "handle");
CREATE INDEX "ShopCollection_storeKey_handle_idx" ON "ShopCollection"("storeKey", "handle");

DROP INDEX IF EXISTS "ShopCategory_slug_key";
CREATE UNIQUE INDEX "ShopCategory_storeKey_slug_key" ON "ShopCategory"("storeKey", "slug");
CREATE INDEX "ShopCategory_storeKey_slug_idx" ON "ShopCategory"("storeKey", "slug");

CREATE INDEX "ShopStore_isActive_sortOrder_idx" ON "ShopStore"("isActive", "sortOrder");
CREATE INDEX "ShopImportTemplate_storeKey_createdAt_idx" ON "ShopImportTemplate"("storeKey", "createdAt");
CREATE INDEX "ShopImportJob_storeKey_createdAt_idx" ON "ShopImportJob"("storeKey", "createdAt");
