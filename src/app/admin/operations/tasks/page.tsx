import { OpsTaskWorkspace } from "@/components/admin/operations/OpsTaskWorkspace";
import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { isOpsAutomationsEnabled } from "@/lib/operations/featureFlags";

const taskScopes = new Set(["all", "mine", "today", "overdue", "waiting"]);

export default async function OperationsTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
  const query = await searchParams;
  const rawScope = typeof query.scope === "string" ? query.scope : "all";
  const initialScope = taskScopes.has(rawScope)
    ? (rawScope as "all" | "mine" | "today" | "overdue" | "waiting")
    : "all";
  const initialStatus = typeof query.status === "string" ? query.status : undefined;
  const initialProjectId = typeof query.projectId === "string" ? query.projectId : undefined;
  const demo = getOpsDemoData();
  return (
    <OpsTaskWorkspace
      initialTasks={demo?.tasks}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      currentAdminId={access.id}
      canWrite={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE)}
      canManageAll={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)}
      initialScope={initialScope}
      initialStatus={initialStatus}
      initialProjectId={initialProjectId}
      initialAssigneeId={
        typeof query.assignee === "string" && query.assignee !== "none" ? query.assignee : undefined
      }
      initialAssigneeNone={query.assignee === "none"}
      initialMissingNextAction={query.missingNextAction === "1"}
      inboxCount={demo?.inbox.filter((item) => item.reviewStatus === "PENDING").length ?? 0}
      canLinkKnowledge={
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ)
      }
      initialKnowledge={demo?.articles}
      automationsEnabled={isOpsAutomationsEnabled()}
      canRunAutomation={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN)}
      canDecideApprovals={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE)}
    />
  );
}
