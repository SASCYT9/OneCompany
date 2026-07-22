-- Existing active tasks without a deadline enter the same 24-hour workflow as
-- newly created tasks. Closed and archived history remains unchanged.
UPDATE "OpsTask"
SET "dueAt" = NOW() + INTERVAL '24 hours'
WHERE "dueAt" IS NULL
  AND "archivedAt" IS NULL
  AND "status" NOT IN ('DONE', 'CANCELLED');
