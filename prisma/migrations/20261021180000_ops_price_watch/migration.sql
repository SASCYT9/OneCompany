-- Supplier price watch for the Operations bot: state of each price source and
-- the differences found by each check. Additive only: no existing table changes.
-- CreateTable
CREATE TABLE "OpsPriceWatchSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" JSONB,
    "leaseUntil" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "snapshot" JSONB,
    "priceListDate" TIMESTAMP(3),
    "nextReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsPriceWatchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsPriceWatchRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "newFindings" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "findings" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "OpsPriceWatchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpsPriceWatchSource_key_key" ON "OpsPriceWatchSource"("key");

-- CreateIndex
CREATE INDEX "OpsPriceWatchRun_sourceId_finishedAt_idx" ON "OpsPriceWatchRun"("sourceId", "finishedAt");

-- CreateIndex
CREATE INDEX "OpsPriceWatchRun_finishedAt_idx" ON "OpsPriceWatchRun"("finishedAt");

-- AddForeignKey
ALTER TABLE "OpsPriceWatchRun" ADD CONSTRAINT "OpsPriceWatchRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OpsPriceWatchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supplier and competitor facts (price, stock, weight) per item, internal only.
-- CreateTable
CREATE TABLE "OpsSupplierItem" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "supplierKey" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "sku" TEXT,
    "supplierSku" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "price" DECIMAL(12,2),
    "currency" TEXT,
    "available" BOOLEAN,
    "availability" TEXT,
    "weightKg" DECIMAL(10,3),
    "lengthCm" DECIMAL(8,1),
    "widthCm" DECIMAL(8,1),
    "heightCm" DECIMAL(8,1),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsSupplierItem_pkey" PRIMARY KEY ("id")
);

-- Price changes asked for in Telegram (preview, confirmation, undo).
-- CreateTable
CREATE TABLE "OpsPriceChange" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "bigChanges" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "telegramChatId" BIGINT,
    "undoOfId" TEXT,
    "error" TEXT,
    "previousPriceList" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "undoUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsSupplierItem_sku_idx" ON "OpsSupplierItem"("sku");

-- CreateIndex
CREATE INDEX "OpsSupplierItem_productId_idx" ON "OpsSupplierItem"("productId");

-- CreateIndex
CREATE INDEX "OpsSupplierItem_sourceKey_firstSeenAt_idx" ON "OpsSupplierItem"("sourceKey", "firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsSupplierItem_sourceKey_supplierKey_key" ON "OpsSupplierItem"("sourceKey", "supplierKey");

-- CreateIndex
CREATE INDEX "OpsPriceChange_status_createdAt_idx" ON "OpsPriceChange"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OpsPriceChange_requestedById_createdAt_idx" ON "OpsPriceChange"("requestedById", "createdAt");
