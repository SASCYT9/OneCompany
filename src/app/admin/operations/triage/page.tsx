import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsTriage } from "@/components/admin/operations/OpsTriage";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsTriagePage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
  return (
    <OpsTriage
      currentAdminId={access.id}
      canManageAll={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)}
    />
  );
}
