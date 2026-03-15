CREATE TABLE "ShopCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleUa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionUa" TEXT,
    "descriptionEn" TEXT,
    "parentId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopCategory_slug_key" ON "ShopCategory"("slug");
CREATE INDEX "ShopCategory_slug_idx" ON "ShopCategory"("slug");
CREATE INDEX "ShopCategory_parentId_sortOrder_idx" ON "ShopCategory"("parentId", "sortOrder");
CREATE INDEX "ShopCategory_isPublished_sortOrder_idx" ON "ShopCategory"("isPublished", "sortOrder");

ALTER TABLE "ShopProduct"
ADD COLUMN "categoryId" TEXT;

CREATE INDEX "ShopProduct_categoryId_idx" ON "ShopProduct"("categoryId");

ALTER TABLE "ShopCategory"
ADD CONSTRAINT "ShopCategory_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopProduct"
ADD CONSTRAINT "ShopProduct_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ShopCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
