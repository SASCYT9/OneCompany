-- One Company Operations: isolated Telegram Manager intake and durable DB jobs.
CREATE TYPE "OpsInboxExtractionStatus" AS ENUM ('RECEIVED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "OpsInboxReviewStatus" AS ENUM ('PENDING', 'APPLIED', 'IGNORED', 'UNDONE');
CREATE TYPE "OpsProposalKind" AS ENUM ('PROJECT', 'TASK', 'NOTE');
CREATE TYPE "OpsProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');
CREATE TYPE "OpsJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_HUMAN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTER');
CREATE TYPE "OpsJobStage" AS ENUM (
    'INGEST',
    'DOWNLOAD_MEDIA',
    'TRANSCRIBE',
    'EXTRACT',
    'RESOLVE_CONTEXT',
    'CREATE_PREVIEW_OR_ENTITIES',
    'EXECUTE_AUTOMATIONS',
    'NOTIFY',
    'WATCHDOG'
);

CREATE TABLE "OpsTelegramUpdate" (
    "id" TEXT NOT NULL,
    "telegramUpdateId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "telegramUserId" BIGINT,
    "messageId" INTEGER,
    "messageThreadId" INTEGER,
    "updateType" TEXT NOT NULL,
    "rawUpdate" JSONB NOT NULL,
    "isUntrustedForward" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsTelegramUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsInboxItem" (
    "id" TEXT NOT NULL,
    "telegramUpdateId" TEXT NOT NULL,
    "originalMessage" TEXT,
    "transcription" TEXT,
    "extractionStatus" "OpsInboxExtractionStatus" NOT NULL DEFAULT 'RECEIVED',
    "reviewStatus" "OpsInboxReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(4,3),
    "summary" TEXT,
    "ambiguities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "processingErrorType" TEXT,
    "processingError" TEXT,
    "appliedTaskIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "undoExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "OpsInboxItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsInboxItem_confidence_check" CHECK (
        "confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)
    )
);

CREATE TABLE "OpsInboxProposal" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "kind" "OpsProposalKind" NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "confidence" DECIMAL(4,3),
    "status" "OpsProposalStatus" NOT NULL DEFAULT 'PENDING',
    "appliedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "OpsInboxProposal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsInboxProposal_confidence_check" CHECK (
        "confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)
    )
);

CREATE TABLE "OpsTelegramContext" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageThreadId" INTEGER,
    "telegramUserId" BIGINT,
    "projectId" TEXT,
    "taskId" TEXT,
    "shopOrderId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsTelegramContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsTelegramDelivery" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT,
    "taskId" TEXT,
    "chatId" BIGINT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsTelegramDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsJob" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inboxItemId" TEXT,
    "taskId" TEXT,
    "type" TEXT NOT NULL,
    "status" "OpsJobStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" "OpsJobStage" NOT NULL DEFAULT 'INGEST',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsJob_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 20)
);

CREATE UNIQUE INDEX "OpsTelegramUpdate_telegramUpdateId_key" ON "OpsTelegramUpdate"("telegramUpdateId");
CREATE INDEX "OpsTelegramUpdate_chatId_messageThreadId_receivedAt_idx" ON "OpsTelegramUpdate"("chatId", "messageThreadId", "receivedAt");
CREATE INDEX "OpsTelegramUpdate_telegramUserId_receivedAt_idx" ON "OpsTelegramUpdate"("telegramUserId", "receivedAt");

CREATE UNIQUE INDEX "OpsInboxItem_telegramUpdateId_key" ON "OpsInboxItem"("telegramUpdateId");
CREATE INDEX "OpsInboxItem_reviewStatus_createdAt_idx" ON "OpsInboxItem"("reviewStatus", "createdAt");
CREATE INDEX "OpsInboxItem_extractionStatus_createdAt_idx" ON "OpsInboxItem"("extractionStatus", "createdAt");

CREATE UNIQUE INDEX "OpsInboxProposal_inboxItemId_payloadHash_key" ON "OpsInboxProposal"("inboxItemId", "payloadHash");
CREATE INDEX "OpsInboxProposal_inboxItemId_status_ordinal_idx" ON "OpsInboxProposal"("inboxItemId", "status", "ordinal");

CREATE UNIQUE INDEX "OpsTelegramContext_chatId_messageThreadId_telegramUserId_key"
    ON "OpsTelegramContext"("chatId", "messageThreadId", "telegramUserId");
-- PostgreSQL treats NULL values as distinct in a regular unique index. This
-- expression index closes that gap for private chats and non-topic messages.
CREATE UNIQUE INDEX "OpsTelegramContext_normalized_scope_key"
    ON "OpsTelegramContext"(
        "chatId",
        COALESCE("messageThreadId", -1),
        COALESCE("telegramUserId", -1)
    );
CREATE INDEX "OpsTelegramContext_taskId_active_idx" ON "OpsTelegramContext"("taskId", "active");
CREATE INDEX "OpsTelegramContext_projectId_active_idx" ON "OpsTelegramContext"("projectId", "active");
CREATE INDEX "OpsTelegramContext_expiresAt_idx" ON "OpsTelegramContext"("expiresAt");

CREATE UNIQUE INDEX "OpsTelegramDelivery_chatId_telegramMessageId_key" ON "OpsTelegramDelivery"("chatId", "telegramMessageId");
CREATE INDEX "OpsTelegramDelivery_inboxItemId_idx" ON "OpsTelegramDelivery"("inboxItemId");
CREATE INDEX "OpsTelegramDelivery_taskId_idx" ON "OpsTelegramDelivery"("taskId");

CREATE UNIQUE INDEX "OpsJob_idempotencyKey_key" ON "OpsJob"("idempotencyKey");
CREATE INDEX "OpsJob_status_availableAt_idx" ON "OpsJob"("status", "availableAt");
CREATE INDEX "OpsJob_leaseExpiresAt_idx" ON "OpsJob"("leaseExpiresAt");
CREATE INDEX "OpsJob_inboxItemId_status_idx" ON "OpsJob"("inboxItemId", "status");
CREATE INDEX "OpsJob_taskId_status_idx" ON "OpsJob"("taskId", "status");

ALTER TABLE "OpsInboxItem"
    ADD CONSTRAINT "OpsInboxItem_telegramUpdateId_fkey"
    FOREIGN KEY ("telegramUpdateId") REFERENCES "OpsTelegramUpdate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OpsInboxProposal"
    ADD CONSTRAINT "OpsInboxProposal_inboxItemId_fkey"
    FOREIGN KEY ("inboxItemId") REFERENCES "OpsInboxItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OpsAttachment"
    ADD CONSTRAINT "OpsAttachment_inboxItemId_fkey"
    FOREIGN KEY ("inboxItemId") REFERENCES "OpsInboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsTelegramContext"
    ADD CONSTRAINT "OpsTelegramContext_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OpsProject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTelegramContext_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTelegramContext_shopOrderId_fkey"
    FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsTelegramDelivery"
    ADD CONSTRAINT "OpsTelegramDelivery_inboxItemId_fkey"
    FOREIGN KEY ("inboxItemId") REFERENCES "OpsInboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTelegramDelivery_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsJob"
    ADD CONSTRAINT "OpsJob_inboxItemId_fkey"
    FOREIGN KEY ("inboxItemId") REFERENCES "OpsInboxItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsJob_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
