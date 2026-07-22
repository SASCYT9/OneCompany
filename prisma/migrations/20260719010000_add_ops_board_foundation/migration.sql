-- One Company Operations: manual board foundation.
-- Additive only: no existing commerce table is altered.

CREATE TYPE "OpsProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OpsPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "OpsTaskStatus" AS ENUM (
    'INBOX',
    'PLANNED',
    'IN_PROGRESS',
    'AGENT_RUNNING',
    'WAITING_HUMAN',
    'WAITING_EXTERNAL',
    'NEEDS_APPROVAL',
    'REVIEW',
    'BLOCKED',
    'DONE',
    'CANCELLED'
);
CREATE TYPE "OpsExecutorType" AS ENUM ('HUMAN', 'AUTOMATION', 'MIXED');
CREATE TYPE "OpsBlockerType" AS ENUM ('HUMAN', 'EXTERNAL', 'APPROVAL', 'TECHNICAL', 'INFORMATION', 'OTHER');
CREATE TYPE "OpsTaskSourceType" AS ENUM ('ADMIN', 'TELEGRAM', 'AUTOMATION', 'IMPORT');
CREATE TYPE "OpsTaskEventType" AS ENUM (
    'CREATED',
    'UPDATED',
    'STATUS_CHANGED',
    'ASSIGNED',
    'COMMENTED',
    'AUTOMATION_STARTED',
    'AUTOMATION_FINISHED',
    'RETRIED',
    'BLOCKED',
    'APPROVED',
    'UNDONE',
    'REOPENED'
);
CREATE TYPE "OpsAttachmentState" AS ENUM ('PENDING', 'READY', 'QUARANTINED', 'REJECTED', 'DELETED');

CREATE TABLE "OpsMemberProfile" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "telegramUserId" BIGINT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Kyiv',
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsMemberProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsProject" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OpsProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "priority" "OpsPriority" NOT NULL DEFAULT 'NORMAL',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "nextAction" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "OpsProject_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsProject_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "OpsTask" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "projectId" TEXT,
    "shopOrderId" TEXT,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OpsTaskStatus" NOT NULL DEFAULT 'INBOX',
    "priority" "OpsPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "executorType" "OpsExecutorType" NOT NULL DEFAULT 'HUMAN',
    "dueAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "definitionOfDone" TEXT,
    "blockerType" "OpsBlockerType",
    "blockerDescription" TEXT,
    "retryAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "rank" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "sourceType" "OpsTaskSourceType" NOT NULL DEFAULT 'ADMIN',
    "sourceId" TEXT,
    "sourceKey" TEXT,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsTask_attempt_count_check" CHECK ("attemptCount" >= 0),
    CONSTRAINT "OpsTask_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "OpsTask_active_action_or_blocker_check" CHECK (
        "status" = 'INBOX'
        OR "status" IN ('DONE', 'CANCELLED')
        OR (
            "status" IN ('PLANNED', 'IN_PROGRESS', 'AGENT_RUNNING', 'REVIEW')
            AND NULLIF(BTRIM("nextAction"), '') IS NOT NULL
        )
        OR (
            "status" IN ('WAITING_HUMAN', 'WAITING_EXTERNAL', 'NEEDS_APPROVAL', 'BLOCKED')
            AND "blockerType" IS NOT NULL
            AND NULLIF(BTRIM("blockerDescription"), '') IS NOT NULL
        )
    )
);

CREATE TABLE "OpsTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "OpsTaskEventType" NOT NULL,
    "actorId" TEXT,
    "sourceType" "OpsTaskSourceType" NOT NULL DEFAULT 'ADMIN',
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsTaskEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "shopOrderId" TEXT,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "telegramSourceId" TEXT,
    "correctsCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsComment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsComment_single_parent_check" CHECK (
        num_nonnulls("taskId", "projectId", "shopOrderId") = 1
    ),
    CONSTRAINT "OpsComment_text_check" CHECK (NULLIF(BTRIM("text"), '') IS NOT NULL)
);

CREATE TABLE "OpsAttachment" (
    "id" TEXT NOT NULL,
    "inboxItemId" TEXT,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "fileName" TEXT,
    "telegramFileId" TEXT,
    "telegramFileUniqueId" TEXT,
    "state" "OpsAttachmentState" NOT NULL DEFAULT 'PENDING',
    "retentionAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "quarantineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsAttachment_size_check" CHECK ("sizeBytes" >= 0 AND "sizeBytes" <= 20971520)
);

CREATE TABLE "OpsTaskAttachment" (
    "taskId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "attachedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsTaskAttachment_pkey" PRIMARY KEY ("taskId", "attachmentId")
);

CREATE TABLE "OpsIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseBody" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpsMemberProfile_adminUserId_key" ON "OpsMemberProfile"("adminUserId");
CREATE UNIQUE INDEX "OpsMemberProfile_telegramUserId_key" ON "OpsMemberProfile"("telegramUserId");
CREATE INDEX "OpsMemberProfile_telegramEnabled_idx" ON "OpsMemberProfile"("telegramEnabled");

CREATE UNIQUE INDEX "OpsProject_externalId_key" ON "OpsProject"("externalId");
CREATE INDEX "OpsProject_status_archivedAt_idx" ON "OpsProject"("status", "archivedAt");
CREATE INDEX "OpsProject_ownerId_status_idx" ON "OpsProject"("ownerId", "status");
CREATE INDEX "OpsProject_priority_dueDate_idx" ON "OpsProject"("priority", "dueDate");

CREATE UNIQUE INDEX "OpsTask_externalId_key" ON "OpsTask"("externalId");
CREATE UNIQUE INDEX "OpsTask_sourceKey_key" ON "OpsTask"("sourceKey");
CREATE INDEX "OpsTask_status_archivedAt_rank_idx" ON "OpsTask"("status", "archivedAt", "rank");
CREATE INDEX "OpsTask_assigneeId_status_dueAt_idx" ON "OpsTask"("assigneeId", "status", "dueAt");
CREATE INDEX "OpsTask_projectId_status_idx" ON "OpsTask"("projectId", "status");
CREATE INDEX "OpsTask_shopOrderId_idx" ON "OpsTask"("shopOrderId");
CREATE INDEX "OpsTask_parentTaskId_idx" ON "OpsTask"("parentTaskId");
CREATE INDEX "OpsTask_sourceType_sourceId_idx" ON "OpsTask"("sourceType", "sourceId");

CREATE INDEX "OpsTaskEvent_taskId_createdAt_idx" ON "OpsTaskEvent"("taskId", "createdAt");
CREATE INDEX "OpsTaskEvent_actorId_createdAt_idx" ON "OpsTaskEvent"("actorId", "createdAt");
CREATE INDEX "OpsTaskEvent_sourceType_sourceId_idx" ON "OpsTaskEvent"("sourceType", "sourceId");

CREATE INDEX "OpsComment_taskId_createdAt_idx" ON "OpsComment"("taskId", "createdAt");
CREATE INDEX "OpsComment_projectId_createdAt_idx" ON "OpsComment"("projectId", "createdAt");
CREATE INDEX "OpsComment_shopOrderId_createdAt_idx" ON "OpsComment"("shopOrderId", "createdAt");
CREATE INDEX "OpsComment_authorId_createdAt_idx" ON "OpsComment"("authorId", "createdAt");

CREATE UNIQUE INDEX "OpsAttachment_storageKey_key" ON "OpsAttachment"("storageKey");
CREATE INDEX "OpsAttachment_inboxItemId_idx" ON "OpsAttachment"("inboxItemId");
CREATE INDEX "OpsAttachment_checksum_idx" ON "OpsAttachment"("checksum");
CREATE INDEX "OpsAttachment_state_retentionAt_idx" ON "OpsAttachment"("state", "retentionAt");
CREATE INDEX "OpsAttachment_telegramFileId_idx" ON "OpsAttachment"("telegramFileId");
CREATE INDEX "OpsTaskAttachment_attachmentId_idx" ON "OpsTaskAttachment"("attachmentId");

CREATE UNIQUE INDEX "OpsIdempotencyRecord_scope_key_key" ON "OpsIdempotencyRecord"("scope", "key");
CREATE INDEX "OpsIdempotencyRecord_expiresAt_idx" ON "OpsIdempotencyRecord"("expiresAt");
CREATE INDEX "OpsIdempotencyRecord_resourceType_resourceId_idx" ON "OpsIdempotencyRecord"("resourceType", "resourceId");

ALTER TABLE "OpsMemberProfile"
    ADD CONSTRAINT "OpsMemberProfile_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpsProject"
    ADD CONSTRAINT "OpsProject_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsTask"
    ADD CONSTRAINT "OpsTask_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OpsProject"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTask_shopOrderId_fkey"
    FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTask_parentTaskId_fkey"
    FOREIGN KEY ("parentTaskId") REFERENCES "OpsTask"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTask_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OpsTaskEvent"
    ADD CONSTRAINT "OpsTaskEvent_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTaskEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsComment"
    ADD CONSTRAINT "OpsComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsComment_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OpsProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsComment_shopOrderId_fkey"
    FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsComment_correctsCommentId_fkey"
    FOREIGN KEY ("correctsCommentId") REFERENCES "OpsComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OpsTaskAttachment"
    ADD CONSTRAINT "OpsTaskAttachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTaskAttachment_attachmentId_fkey"
    FOREIGN KEY ("attachmentId") REFERENCES "OpsAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsTaskAttachment_attachedById_fkey"
    FOREIGN KEY ("attachedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION ops_reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "OpsTaskEvent_append_only"
BEFORE UPDATE OR DELETE ON "OpsTaskEvent"
FOR EACH ROW EXECUTE FUNCTION ops_reject_append_only_mutation();

CREATE TRIGGER "OpsComment_append_only"
BEFORE UPDATE OR DELETE ON "OpsComment"
FOR EACH ROW EXECUTE FUNCTION ops_reject_append_only_mutation();

-- Seed composable role templates. Existing custom permissions are preserved.
INSERT INTO "AdminRole" ("id", "key", "name", "permissions", "createdAt", "updatedAt")
VALUES
    (
        md5('ops-role:owner'),
        'owner',
        'Owner',
        ARRAY['*']::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        md5('ops-role:task_member'),
        'task_member',
        'Task member',
        ARRAY['ops.tasks.read', 'ops.tasks.write', 'ops.knowledge.read']::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        md5('ops-role:task_manager'),
        'task_manager',
        'Task manager',
        ARRAY[
            'ops.tasks.read',
            'ops.tasks.write',
            'ops.tasks.assign',
            'ops.knowledge.read',
            'ops.knowledge.publish',
            'ops.inbox.read',
            'ops.inbox.review',
            'ops.automation.run'
        ]::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        md5('ops-role:knowledge_editor'),
        'knowledge_editor',
        'Knowledge editor',
        ARRAY['ops.knowledge.read', 'ops.knowledge.write']::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        md5('ops-role:knowledge_publisher'),
        'knowledge_publisher',
        'Knowledge publisher',
        ARRAY['ops.knowledge.read', 'ops.knowledge.write', 'ops.knowledge.publish']::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        md5('ops-role:catalog_editor'),
        'catalog_editor',
        'Catalog editor',
        ARRAY[
            'shop.products.read',
            'shop.products.write',
            'shop.categories.read',
            'shop.collections.read'
        ]::TEXT[],
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("key") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "permissions" = ARRAY(
        SELECT DISTINCT permission
        FROM unnest("AdminRole"."permissions" || EXCLUDED."permissions") AS merged(permission)
        ORDER BY permission
    ),
    "updatedAt" = CURRENT_TIMESTAMP;
