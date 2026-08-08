-- Additive OneAI telemetry and commerce attribution. Existing cart and order
-- rows remain unchanged because all attribution columns are nullable.
ALTER TABLE "ShopAiRun"
  ADD COLUMN IF NOT EXISTS "pipeline" TEXT,
  ADD COLUMN IF NOT EXISTS "retrievalPath" TEXT,
  ADD COLUMN IF NOT EXISTS "providerModel" TEXT,
  ADD COLUMN IF NOT EXISTS "plannerLatencyMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "degradedReason" TEXT;

ALTER TYPE "ShopAiFeedbackSignal" ADD VALUE IF NOT EXISTS 'MANAGER_HANDOFF';

ALTER TABLE "ShopCartItem"
  ADD COLUMN IF NOT EXISTS "oneAiRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "oneAiCandidateDecisionId" TEXT;

ALTER TABLE "ShopOrderItem"
  ADD COLUMN IF NOT EXISTS "oneAiRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "oneAiCandidateDecisionId" TEXT;

CREATE INDEX IF NOT EXISTS "ShopAiRun_pipeline_created_idx"
  ON "ShopAiRun"("pipeline", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopAiRun_degraded_reason_created_idx"
  ON "ShopAiRun"("degradedReason", "createdAt");
CREATE INDEX IF NOT EXISTS "ShopCartItem_oneAiRunId_idx"
  ON "ShopCartItem"("oneAiRunId");
CREATE INDEX IF NOT EXISTS "ShopCartItem_oneAiCandidateDecisionId_idx"
  ON "ShopCartItem"("oneAiCandidateDecisionId");
CREATE INDEX IF NOT EXISTS "ShopOrderItem_oneAiRunId_idx"
  ON "ShopOrderItem"("oneAiRunId");
CREATE INDEX IF NOT EXISTS "ShopOrderItem_oneAiCandidateDecisionId_idx"
  ON "ShopOrderItem"("oneAiCandidateDecisionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopCartItem_oneAiRunId_fkey'
  ) THEN
    ALTER TABLE "ShopCartItem"
      ADD CONSTRAINT "ShopCartItem_oneAiRunId_fkey"
      FOREIGN KEY ("oneAiRunId") REFERENCES "ShopAiRun"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopCartItem_oneAiCandidateDecisionId_fkey'
  ) THEN
    ALTER TABLE "ShopCartItem"
      ADD CONSTRAINT "ShopCartItem_oneAiCandidateDecisionId_fkey"
      FOREIGN KEY ("oneAiCandidateDecisionId") REFERENCES "ShopAiCandidateDecision"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopOrderItem_oneAiRunId_fkey'
  ) THEN
    ALTER TABLE "ShopOrderItem"
      ADD CONSTRAINT "ShopOrderItem_oneAiRunId_fkey"
      FOREIGN KEY ("oneAiRunId") REFERENCES "ShopAiRun"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ShopOrderItem_oneAiCandidateDecisionId_fkey'
  ) THEN
    ALTER TABLE "ShopOrderItem"
      ADD CONSTRAINT "ShopOrderItem_oneAiCandidateDecisionId_fkey"
      FOREIGN KEY ("oneAiCandidateDecisionId") REFERENCES "ShopAiCandidateDecision"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
