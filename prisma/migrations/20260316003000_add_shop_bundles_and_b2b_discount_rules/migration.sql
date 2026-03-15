-- AlterTable
ALTER TABLE "ShopSettings"
ADD COLUMN "defaultB2bDiscountPercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "ShopCustomer"
ADD COLUMN "b2bDiscountPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "ShopBundle" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "componentVariantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopBundle_productId_key" ON "ShopBundle"("productId");

-- CreateIndex
CREATE INDEX "ShopBundle_createdAt_idx" ON "ShopBundle"("createdAt");

-- CreateIndex
CREATE INDEX "ShopBundleItem_bundleId_position_idx" ON "ShopBundleItem"("bundleId", "position");

-- CreateIndex
CREATE INDEX "ShopBundleItem_componentProductId_idx" ON "ShopBundleItem"("componentProductId");

-- CreateIndex
CREATE INDEX "ShopBundleItem_componentVariantId_idx" ON "ShopBundleItem"("componentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopBundleItem_bundleId_position_key" ON "ShopBundleItem"("bundleId", "position");

-- AddForeignKey
ALTER TABLE "ShopBundle"
ADD CONSTRAINT "ShopBundle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopBundleItem"
ADD CONSTRAINT "ShopBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ShopBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopBundleItem"
ADD CONSTRAINT "ShopBundleItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopBundleItem"
ADD CONSTRAINT "ShopBundleItem_componentVariantId_fkey" FOREIGN KEY ("componentVariantId") REFERENCES "ShopProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
