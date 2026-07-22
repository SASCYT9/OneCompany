CREATE TYPE "OpsTelegramBatchStatus" AS ENUM (
  'OPEN',
  'PROCESSING',
  'READY',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "OpsTelegramBatchMode" AS ENUM (
  'ONE_TASK',
  'SPLIT_TASKS'
);

CREATE TABLE "OpsTelegramBatch" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "actorAdminUserId" TEXT NOT NULL,
  "chatId" BIGINT NOT NULL,
  "telegramUserId" BIGINT NOT NULL,
  "status" "OpsTelegramBatchStatus" NOT NULL DEFAULT 'OPEN',
  "mode" "OpsTelegramBatchMode",
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "statusMessageId" INTEGER,
  "inboxItemId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpsTelegramBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpsTelegramBatch_itemCount_check" CHECK ("itemCount" BETWEEN 0 AND 10)
);

CREATE TABLE "OpsTelegramBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "telegramUpdateId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpsTelegramBatchItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpsTelegramBatchItem_ordinal_check" CHECK ("ordinal" BETWEEN 1 AND 10)
);

CREATE UNIQUE INDEX "OpsTelegramBatch_scopeKey_key"
  ON "OpsTelegramBatch"("scopeKey");
CREATE UNIQUE INDEX "OpsTelegramBatch_inboxItemId_key"
  ON "OpsTelegramBatch"("inboxItemId");
CREATE INDEX "OpsTelegramBatch_telegramUserId_status_updatedAt_idx"
  ON "OpsTelegramBatch"("telegramUserId", "status", "updatedAt");
CREATE INDEX "OpsTelegramBatch_status_expiresAt_idx"
  ON "OpsTelegramBatch"("status", "expiresAt");

CREATE UNIQUE INDEX "OpsTelegramBatchItem_telegramUpdateId_key"
  ON "OpsTelegramBatchItem"("telegramUpdateId");
CREATE UNIQUE INDEX "OpsTelegramBatchItem_batchId_ordinal_key"
  ON "OpsTelegramBatchItem"("batchId", "ordinal");
CREATE INDEX "OpsTelegramBatchItem_batchId_createdAt_idx"
  ON "OpsTelegramBatchItem"("batchId", "createdAt");

ALTER TABLE "OpsTelegramBatch"
  ADD CONSTRAINT "OpsTelegramBatch_actorAdminUserId_fkey"
  FOREIGN KEY ("actorAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OpsTelegramBatch_inboxItemId_fkey"
  FOREIGN KEY ("inboxItemId") REFERENCES "OpsInboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsTelegramBatchItem"
  ADD CONSTRAINT "OpsTelegramBatchItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "OpsTelegramBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "OpsTelegramBatchItem_telegramUpdateId_fkey"
  FOREIGN KEY ("telegramUpdateId") REFERENCES "OpsTelegramUpdate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
