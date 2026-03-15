-- CreateEnum
CREATE TYPE "ShopCatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShopMediaType" AS ENUM ('IMAGE', 'VIDEO', 'EXTERNAL_VIDEO');

-- CreateEnum
CREATE TYPE "ShopInventoryPolicy" AS ENUM ('DENY', 'CONTINUE');

-- AlterTable
ALTER TABLE "ShopProduct"
ADD COLUMN "vendor" TEXT,
ADD COLUMN "productType" TEXT,
ADD COLUMN "productCategory" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "status" "ShopCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "bodyHtmlUa" TEXT,
ADD COLUMN "bodyHtmlEn" TEXT,
ADD COLUMN "seoTitleUa" TEXT,
ADD COLUMN "seoTitleEn" TEXT,
ADD COLUMN "seoDescriptionUa" TEXT,
ADD COLUMN "seoDescriptionEn" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "ShopProduct"
SET "publishedAt" = "createdAt"
WHERE "isPublished" = true AND "publishedAt" IS NULL;

-- CreateTable
CREATE TABLE "ShopProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaType" "ShopMediaType" NOT NULL DEFAULT 'IMAGE',
    "src" TEXT NOT NULL,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT,
    "sku" TEXT,
    "position" INTEGER NOT NULL DEFAULT 1,
    "option1Value" TEXT,
    "option1LinkedTo" TEXT,
    "option2Value" TEXT,
    "option2LinkedTo" TEXT,
    "option3Value" TEXT,
    "option3LinkedTo" TEXT,
    "grams" INTEGER,
    "inventoryTracker" TEXT,
    "inventoryQty" INTEGER NOT NULL DEFAULT 0,
    "inventoryPolicy" "ShopInventoryPolicy" NOT NULL DEFAULT 'CONTINUE',
    "fulfillmentService" TEXT,
    "priceEur" DECIMAL(12,2),
    "priceUsd" DECIMAL(12,2),
    "priceUah" DECIMAL(12,2),
    "compareAtEur" DECIMAL(12,2),
    "compareAtUsd" DECIMAL(12,2),
    "compareAtUah" DECIMAL(12,2),
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "barcode" TEXT,
    "image" TEXT,
    "weightUnit" TEXT,
    "taxCode" TEXT,
    "costPerItem" DECIMAL(12,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopProductMetafield" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'single_line_text_field',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductMetafield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopProduct_status_idx" ON "ShopProduct"("status");

-- CreateIndex
CREATE INDEX "ShopProductMedia_productId_idx" ON "ShopProductMedia"("productId");

-- CreateIndex
CREATE INDEX "ShopProductMedia_productId_position_idx" ON "ShopProductMedia"("productId", "position");

-- CreateIndex
CREATE INDEX "ShopProductOption_productId_idx" ON "ShopProductOption"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductOption_productId_position_key" ON "ShopProductOption"("productId", "position");

-- CreateIndex
CREATE INDEX "ShopProductVariant_productId_idx" ON "ShopProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ShopProductVariant_sku_idx" ON "ShopProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductVariant_productId_position_key" ON "ShopProductVariant"("productId", "position");

-- CreateIndex
CREATE INDEX "ShopProductMetafield_productId_idx" ON "ShopProductMetafield"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopProductMetafield_productId_namespace_key_key" ON "ShopProductMetafield"("productId", "namespace", "key");

-- AddForeignKey
ALTER TABLE "ShopProductMedia" ADD CONSTRAINT "ShopProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductOption" ADD CONSTRAINT "ShopProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductVariant" ADD CONSTRAINT "ShopProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopProductMetafield" ADD CONSTRAINT "ShopProductMetafield_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
