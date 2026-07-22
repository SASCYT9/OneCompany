-- One Company Operations: bounded automation, immutable approval payloads and cost guardrails.
CREATE TYPE "OpsAutomationStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_HUMAN', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "OpsApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "OpsAutomationRun" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "automationType" TEXT NOT NULL,
    "status" "OpsAutomationStatus" NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "inputSnapshot" JSONB NOT NULL,
    "result" JSONB,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "requestedById" TEXT,
    "budget" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsAutomationRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsAutomationRun_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 20)
);

CREATE TABLE "OpsApproval" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "status" "OpsApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OpsApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsUsageBucket" (
    "id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "feature" TEXT NOT NULL,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "audioSeconds" INTEGER NOT NULL DEFAULT 0,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "warningMicros" BIGINT NOT NULL DEFAULT 1500000,
    "hardStopMicros" BIGINT NOT NULL DEFAULT 2000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OpsUsageBucket_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OpsUsageBucket_non_negative_check" CHECK (
        "inputTokens" >= 0
        AND "outputTokens" >= 0
        AND "audioSeconds" >= 0
        AND "costMicros" >= 0
        AND "storageBytes" >= 0
        AND "warningMicros" >= 0
        AND "hardStopMicros" >= "warningMicros"
    )
);

CREATE INDEX "OpsAutomationRun_taskId_createdAt_idx" ON "OpsAutomationRun"("taskId", "createdAt");
CREATE INDEX "OpsAutomationRun_status_createdAt_idx" ON "OpsAutomationRun"("status", "createdAt");
CREATE INDEX "OpsApproval_status_expiresAt_idx" ON "OpsApproval"("status", "expiresAt");
CREATE INDEX "OpsApproval_taskId_createdAt_idx" ON "OpsApproval"("taskId", "createdAt");
CREATE INDEX "OpsApproval_approverId_status_idx" ON "OpsApproval"("approverId", "status");
CREATE UNIQUE INDEX "OpsUsageBucket_month_feature_key" ON "OpsUsageBucket"("month", "feature");
CREATE INDEX "OpsUsageBucket_month_idx" ON "OpsUsageBucket"("month");

ALTER TABLE "OpsAutomationRun"
    ADD CONSTRAINT "OpsAutomationRun_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsAutomationRun_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OpsApproval"
    ADD CONSTRAINT "OpsApproval_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsApproval_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OpsApproval_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION ops_protect_approval_payload()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."action" IS DISTINCT FROM OLD."action"
       OR NEW."payload" IS DISTINCT FROM OLD."payload"
       OR NEW."payloadHash" IS DISTINCT FROM OLD."payloadHash"
       OR NEW."requesterId" IS DISTINCT FROM OLD."requesterId"
       OR NEW."taskId" IS DISTINCT FROM OLD."taskId"
       OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
        RAISE EXCEPTION 'OpsApproval immutable request payload cannot be changed'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "OpsApproval_protect_payload"
BEFORE UPDATE ON "OpsApproval"
FOR EACH ROW EXECUTE FUNCTION ops_protect_approval_payload();
