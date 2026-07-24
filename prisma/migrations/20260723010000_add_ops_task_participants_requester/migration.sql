ALTER TABLE "OpsTask"
ADD COLUMN "requestedById" TEXT;

UPDATE "OpsTask"
SET "requestedById" = "createdById"
WHERE "requestedById" IS NULL;

CREATE TABLE "OpsTaskAssignee" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OpsTaskAssignee_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OpsTaskAssignee" (
  "id",
  "taskId",
  "adminUserId",
  "assignedById",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('legacy_', MD5(task."id" || ':' || task."assigneeId")),
  task."id",
  task."assigneeId",
  NULL,
  task."createdAt",
  task."updatedAt"
FROM "OpsTask" AS task
WHERE task."assigneeId" IS NOT NULL;

CREATE INDEX "OpsTask_requestedById_idx" ON "OpsTask"("requestedById");

CREATE UNIQUE INDEX "OpsTaskAssignee_taskId_adminUserId_key"
ON "OpsTaskAssignee"("taskId", "adminUserId");

CREATE INDEX "OpsTaskAssignee_adminUserId_taskId_idx"
ON "OpsTaskAssignee"("adminUserId", "taskId");

CREATE INDEX "OpsTaskAssignee_assignedById_idx"
ON "OpsTaskAssignee"("assignedById");

ALTER TABLE "OpsTask"
ADD CONSTRAINT "OpsTask_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsTaskAssignee"
ADD CONSTRAINT "OpsTaskAssignee_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpsTaskAssignee"
ADD CONSTRAINT "OpsTaskAssignee_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpsTaskAssignee"
ADD CONSTRAINT "OpsTaskAssignee_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "AdminUser"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
