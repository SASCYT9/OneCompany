import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsKnowledge } from "@/components/admin/operations/OpsKnowledge";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsKnowledgePage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ);
  const demo = getOpsDemoData();
  return (
    <OpsKnowledge
      initialArticles={demo?.articles}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      canWrite={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE)}
    />
  );
}
