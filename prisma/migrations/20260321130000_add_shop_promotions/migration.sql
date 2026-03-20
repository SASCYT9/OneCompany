-- CreateEnum
CREATE TYPE "ShopPromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateTable
CREATE TABLE "ShopPromotion" (
    "id" TEXT NOT NULL,
    "storeKey" TEXT NOT NULL DEFAULT 'urban',
    "code" TEXT,
    "titleUa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionUa" TEXT,
    "descriptionEn" TEXT,
    "promotionType" "ShopPromotionType" NOT NULL,
    "discountValue" DECIMAL(12,2),
    "currency" TEXT,
    "minimumSubtotal" DECIMAL(12,2),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "customerGroup" "CustomerGroup",
    "appliesToAll" BOOLEAN NOT NULL DEFAULT true,
    "productSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPromotion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ShopOrder"
ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "promotionId" TEXT,
ADD COLUMN "promotionCode" TEXT,
ADD COLUMN "promotionSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "ShopPromotion_storeKey_code_key" ON "ShopPromotion"("storeKey", "code");

-- CreateIndex
CREATE INDEX "ShopPromotion_storeKey_isActive_idx" ON "ShopPromotion"("storeKey", "isActive");

-- CreateIndex
CREATE INDEX "ShopPromotion_storeKey_startsAt_endsAt_idx" ON "ShopPromotion"("storeKey", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ShopOrder_promotionId_idx" ON "ShopOrder"("promotionId");

-- AddForeignKey
ALTER TABLE "ShopPromotion" ADD CONSTRAINT "ShopPromotion_storeKey_fkey" FOREIGN KEY ("storeKey") REFERENCES "ShopStore"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOrder" ADD CONSTRAINT "ShopOrder_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "ShopPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
