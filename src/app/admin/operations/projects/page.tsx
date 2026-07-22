import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsProjects } from "@/components/admin/operations/OpsProjects";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsProjectsPage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
  const demo = getOpsDemoData();
  return (
    <OpsProjects
      initialProjects={demo?.projects}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      currentAdminId={access.id}
    />
  );
}
