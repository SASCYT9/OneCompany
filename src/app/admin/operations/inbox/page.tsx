import { getOpsDemoData } from "@/app/admin/operations/demoData";
import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsInbox } from "@/components/admin/operations/OpsInbox";
import { currentAdminHasPermission } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_INBOX_READ);
  const query = await searchParams;
  const demo = getOpsDemoData();
  return (
    <OpsInbox
      initialItems={demo?.inbox}
      demoMode={Boolean(demo)}
      permissions={access.permissions}
      canReview={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW)}
      canApply={
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_INBOX_REVIEW) &&
        currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE)
      }
      canAssign={currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN)}
      initialSelectedId={typeof query.selected === "string" ? query.selected : undefined}
    />
  );
}
