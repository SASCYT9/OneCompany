ALTER TABLE "ShopCart"
ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';

ALTER TABLE "ShopOrder"
ADD COLUMN "storeKey" TEXT NOT NULL DEFAULT 'urban';

ALTER TABLE "ShopCart"
ADD CONSTRAINT "ShopCart_storeKey_fkey"
FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ShopOrder"
ADD CONSTRAINT "ShopOrder_storeKey_fkey"
FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "ShopCart_storeKey_updatedAt_idx" ON "ShopCart"("storeKey", "updatedAt");
CREATE INDEX "ShopCart_storeKey_customerId_idx" ON "ShopCart"("storeKey", "customerId");
CREATE INDEX "ShopOrder_storeKey_createdAt_idx" ON "ShopOrder"("storeKey", "createdAt");
CREATE INDEX "ShopOrder_storeKey_status_idx" ON "ShopOrder"("storeKey", "status");
