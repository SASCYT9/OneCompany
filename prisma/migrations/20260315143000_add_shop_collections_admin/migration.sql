CREATE TABLE "ShopCollection" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "titleUa" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "brand" TEXT,
    "descriptionUa" TEXT,
    "descriptionEn" TEXT,
    "heroImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "isUrban" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopProductCollection" (
    "productId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductCollection_pkey" PRIMARY KEY ("productId","collectionId")
);

CREATE UNIQUE INDEX "ShopCollection_handle_key" ON "ShopCollection"("handle");
CREATE INDEX "ShopCollection_handle_idx" ON "ShopCollection"("handle");
CREATE INDEX "ShopCollection_isUrban_sortOrder_idx" ON "ShopCollection"("isUrban", "sortOrder");
CREATE INDEX "ShopCollection_isPublished_idx" ON "ShopCollection"("isPublished");
CREATE INDEX "ShopProductCollection_collectionId_sortOrder_idx" ON "ShopProductCollection"("collectionId", "sortOrder");

ALTER TABLE "ShopProductCollection"
ADD CONSTRAINT "ShopProductCollection_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopProductCollection"
ADD CONSTRAINT "ShopProductCollection_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "ShopCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
