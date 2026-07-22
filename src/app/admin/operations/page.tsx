import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsOverview } from "@/components/admin/operations/OpsOverview";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsOverviewPage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
  const demo = getOpsDemoData();
  return (
    <OpsOverview
      initialData={demo ?? undefined}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      currentAdminId={access.id}
      canReadInbox={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_INBOX_READ)}
      canReadKnowledge={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ)}
    />
  );
}
