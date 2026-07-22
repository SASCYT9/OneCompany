import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsKnowledgeDetail } from "@/components/admin/operations/OpsKnowledgeDetail";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function NewOperationsKnowledgeArticlePage() {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
  const demo = getOpsDemoData();
  return (
    <OpsKnowledgeDetail
      articleId="new"
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      canWrite
      canPublish={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH)}
      editingInitially
    />
  );
}
