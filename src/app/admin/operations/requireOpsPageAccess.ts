import "server-only";

import { redirect } from "next/navigation";

import {
  currentAdminHasPermission,
  getCurrentAdminAccess,
  type CurrentAdminAccess,
} from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { getFirstAllowedAdminRoute } from "@/lib/admin/adminNavigation";
import { isOperationsUiEnabled } from "@/lib/operations/featureFlags";
import { getOpsLocalDemoAccess } from "@/lib/operations/localDemoAccess";

export async function requireOpsPageAccess(permission: string): Promise<CurrentAdminAccess> {
  const access = getOpsLocalDemoAccess() ?? (await getCurrentAdminAccess());
  if (!access) redirect("/admin");
  if (!isOperationsUiEnabled()) {
    redirect(
      getFirstAllowedAdminRoute(access.permissions, { operationsUiEnabled: false }) ?? "/admin"
    );
  }
  if (!currentAdminHasPermission(access, permission)) {
    if (currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_READ)) {
      redirect("/admin/operations/tasks");
    }
    if (currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ)) {
      redirect("/admin/operations/knowledge");
    }
    if (currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_INBOX_READ)) {
      redirect("/admin/operations/inbox");
    }
    redirect("/admin");
  }
  return access;
}
