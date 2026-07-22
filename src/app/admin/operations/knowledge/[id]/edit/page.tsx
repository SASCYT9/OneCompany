import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsKnowledgeDetail } from "@/components/admin/operations/OpsKnowledgeDetail";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function EditOperationsKnowledgeArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE);
  const { id } = await params;
  const demo = getOpsDemoData();
  return (
    <OpsKnowledgeDetail
      articleId={id}
      initialArticle={demo?.articles.find((article) => article.id === id)}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      canWrite
      canPublish={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH)}
      editingInitially
    />
  );
}
