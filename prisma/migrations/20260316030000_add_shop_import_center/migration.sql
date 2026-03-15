-- CreateEnum
CREATE TYPE "ShopImportAction" AS ENUM ('DRY_RUN', 'COMMIT');

-- CreateEnum
CREATE TYPE "ShopImportStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ShopImportConflictMode" AS ENUM ('SKIP', 'UPDATE', 'CREATE');

-- CreateTable
CREATE TABLE "ShopImportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierName" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'shopify_csv',
    "notes" TEXT,
    "fieldMapping" JSONB,
    "defaultConflictMode" "ShopImportConflictMode" NOT NULL DEFAULT 'UPDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopImportJob" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'shopify_csv',
    "sourceFilename" TEXT,
    "supplierName" TEXT,
    "templateId" TEXT,
    "action" "ShopImportAction" NOT NULL,
    "status" "ShopImportStatus" NOT NULL,
    "conflictMode" "ShopImportConflictMode" NOT NULL DEFAULT 'UPDATE',
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "productsCount" INTEGER NOT NULL DEFAULT 0,
    "variantsCount" INTEGER NOT NULL DEFAULT 0,
    "validProducts" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "columns" JSONB,
    "templateSnapshot" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopImportRowError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "handle" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopImportRowError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopImportTemplate_sourceType_createdAt_idx" ON "ShopImportTemplate"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "ShopImportJob_action_createdAt_idx" ON "ShopImportJob"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ShopImportJob_status_createdAt_idx" ON "ShopImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ShopImportJob_sourceType_createdAt_idx" ON "ShopImportJob"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "ShopImportJob_templateId_idx" ON "ShopImportJob"("templateId");

-- CreateIndex
CREATE INDEX "ShopImportRowError_jobId_rowNumber_idx" ON "ShopImportRowError"("jobId", "rowNumber");

-- AddForeignKey
ALTER TABLE "ShopImportJob"
ADD CONSTRAINT "ShopImportJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShopImportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopImportRowError"
ADD CONSTRAINT "ShopImportRowError_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ShopImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
