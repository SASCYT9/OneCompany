-- CreateTable
CREATE TABLE "ShopProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'auto',
    "brand" TEXT,
    "titleUa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "categoryUa" TEXT,
    "categoryEn" TEXT,
    "shortDescUa" TEXT,
    "shortDescEn" TEXT,
    "longDescUa" TEXT,
    "longDescEn" TEXT,
    "leadTimeUa" TEXT,
    "leadTimeEn" TEXT,
    "stock" TEXT NOT NULL DEFAULT 'inStock',
    "collectionUa" TEXT,
    "collectionEn" TEXT,
    "priceEur" DECIMAL(12,2),
    "priceUsd" DECIMAL(12,2),
    "priceUah" DECIMAL(12,2),
    "compareAtEur" DECIMAL(12,2),
    "compareAtUsd" DECIMAL(12,2),
    "compareAtUah" DECIMAL(12,2),
    "image" TEXT,
    "gallery" JSONB,
    "highlights" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopProduct_slug_key" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_slug_idx" ON "ShopProduct"("slug");

-- CreateIndex
CREATE INDEX "ShopProduct_scope_idx" ON "ShopProduct"("scope");

-- CreateIndex
CREATE INDEX "ShopProduct_isPublished_idx" ON "ShopProduct"("isPublished");
