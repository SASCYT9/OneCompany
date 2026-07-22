import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsSystem } from "@/components/admin/operations/OpsSystem";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsSystemPage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE);

  return <OpsSystem permissions={access.permissions} />;
}
