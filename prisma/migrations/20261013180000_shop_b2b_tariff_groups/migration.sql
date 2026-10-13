-- Additive only: two new tables and one nullable column; nothing existing is
-- altered or rewritten, so code deployed before this migration keeps working.
ALTER TABLE "ShopCustomer" ADD COLUMN "tariffGroupId" TEXT;

CREATE TABLE "ShopB2bTariffGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopB2bTariffGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopB2bTariffGroupBrandDiscount" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "discountPct" DECIMAL(5,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopB2bTariffGroupBrandDiscount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopB2bTariffGroup_name_key" ON "ShopB2bTariffGroup"("name");
CREATE INDEX "ShopB2bTariffGroupBrandDiscount_brand_idx" ON "ShopB2bTariffGroupBrandDiscount"("brand");
CREATE UNIQUE INDEX "ShopB2bTariffGroupBrandDiscount_groupId_brand_key" ON "ShopB2bTariffGroupBrandDiscount"("groupId", "brand");
CREATE INDEX "ShopCustomer_tariffGroupId_idx" ON "ShopCustomer"("tariffGroupId");

ALTER TABLE "ShopCustomer" ADD CONSTRAINT "ShopCustomer_tariffGroupId_fkey" FOREIGN KEY ("tariffGroupId") REFERENCES "ShopB2bTariffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopB2bTariffGroupBrandDiscount" ADD CONSTRAINT "ShopB2bTariffGroupBrandDiscount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ShopB2bTariffGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
