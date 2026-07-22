ALTER TABLE "OpsTask"
ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "OpsTask_isShared_status_idx"
ON "OpsTask"("isShared", "status")
WHERE "archivedAt" IS NULL;
