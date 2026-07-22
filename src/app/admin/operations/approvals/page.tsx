import { requireOpsPageAccess } from "@/app/admin/operations/requireOpsPageAccess";
import { OpsApprovals } from "@/components/admin/operations/OpsApprovals";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

export default async function OperationsApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireOpsPageAccess(ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE);
  const query = await searchParams;
  const initialTaskId =
    typeof query.taskId === "string" && query.taskId.trim() ? query.taskId.trim() : undefined;

  return <OpsApprovals permissions={access.permissions} initialTaskId={initialTaskId} />;
}
