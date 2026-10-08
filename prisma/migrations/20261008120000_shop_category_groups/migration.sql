-- Additive only: nothing existing is altered or rewritten.
ALTER TABLE "ShopProduct" ADD COLUMN "categoryGroupOverride" TEXT;

CREATE TABLE "ShopCategoryGroup" (
  "id" TEXT NOT NULL,
  "titleUa" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShopCategoryGroup_pkey" PRIMARY KEY ("id")
);
