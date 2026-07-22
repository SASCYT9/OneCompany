import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsBrandDirectory } from "@/components/admin/operations/OpsBrandDirectory";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsDirectoryPage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
  return <OpsBrandDirectory permissions={access.permissions} />;
}
