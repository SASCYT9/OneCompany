import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsTaskScreen } from "@/components/admin/operations/OpsTaskScreen";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { isOpsAutomationsEnabled } from "@/lib/operations/featureFlags";

export default async function OperationsTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
  const { id } = await params;
  const demo = getOpsDemoData();
  return (
    <OpsTaskScreen
      taskId={id}
      initialTask={demo?.tasks.find((task) => task.id === id)}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      canWrite={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE)}
      currentAdminId={access.id}
      canManageAll={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)}
      canReadKnowledge={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ)}
      canLinkKnowledge={
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE) &&
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ)
      }
      automationsEnabled={isOpsAutomationsEnabled()}
      canRunAutomation={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN)}
      canDecideApprovals={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE)}
      initialKnowledge={demo?.articles}
    />
  );
}
