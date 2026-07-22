ALTER TABLE "OpsTask"
DROP CONSTRAINT IF EXISTS "OpsTask_active_action_or_blocker_check";

ALTER TABLE "OpsTask"
ADD CONSTRAINT "OpsTask_agent_action_check"
CHECK (
  "status" <> 'AGENT_RUNNING'
  OR NULLIF(BTRIM("nextAction"), '') IS NOT NULL
);
