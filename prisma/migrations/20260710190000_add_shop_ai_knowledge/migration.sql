CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ShopProductKnowledge" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "vehicleType" TEXT NOT NULL DEFAULT 'unknown',
    "makes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chassisCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearRanges" JSONB NOT NULL DEFAULT '[]',
    "engines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bodyStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryGroup" TEXT,
    "powerGainHp" INTEGER,
    "torqueGainNm" INTEGER,
    "material" TEXT,
    "opfGpf" TEXT,
    "installationType" TEXT,
    "fitmentStatus" TEXT NOT NULL DEFAULT 'needs_review',
    "fitmentSource" TEXT NOT NULL DEFAULT 'automatic',
    "applications" JSONB NOT NULL DEFAULT '[]',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "searchText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "embeddingModel" TEXT,
    "embedding" vector(768),
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopProductKnowledge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopAiConversation" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ua',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "state" JSONB NOT NULL DEFAULT '{}',
    "shownProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAiConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopProductKnowledge_productId_key" ON "ShopProductKnowledge"("productId");
CREATE INDEX "ShopProductKnowledge_schemaVersion_idx" ON "ShopProductKnowledge"("schemaVersion");
CREATE INDEX "ShopProductKnowledge_vehicleType_idx" ON "ShopProductKnowledge"("vehicleType");
CREATE INDEX "ShopProductKnowledge_categoryGroup_idx" ON "ShopProductKnowledge"("categoryGroup");
CREATE INDEX "ShopProductKnowledge_fitmentStatus_idx" ON "ShopProductKnowledge"("fitmentStatus");
CREATE INDEX "ShopProductKnowledge_contentHash_idx" ON "ShopProductKnowledge"("contentHash");
CREATE INDEX "ShopAiConversation_expiresAt_idx" ON "ShopAiConversation"("expiresAt");

ALTER TABLE "ShopProductKnowledge"
ADD CONSTRAINT "ShopProductKnowledge_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
