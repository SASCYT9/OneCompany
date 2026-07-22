import type { CurrentAdminAccess } from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";

const LOCAL_DEMO_PERMISSIONS = [
  ADMIN_PERMISSIONS.OPS_TASKS_READ,
  ADMIN_PERMISSIONS.OPS_TASKS_WRITE,
  ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN,
  ADMIN_PERMISSIONS.OPS_KNOWLEDGE_READ,
  ADMIN_PERMISSIONS.OPS_KNOWLEDGE_WRITE,
  ADMIN_PERMISSIONS.OPS_KNOWLEDGE_PUBLISH,
  ADMIN_PERMISSIONS.OPS_INBOX_READ,
  ADMIN_PERMISSIONS.OPS_INBOX_REVIEW,
  ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN,
  ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE,
  ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE,
] as const;

/**
 * Local UI preview identity.
 *
 * This is intentionally consumed only by Server Components. Route handlers
 * still resolve a signed session against PostgreSQL, so demo mode cannot be
 * used to authenticate API calls or mutate real data.
 */
export function getOpsLocalDemoAccess(
  env: { NODE_ENV?: string; OPS_LOCAL_DEMO_MODE?: string } = process.env
): CurrentAdminAccess | null {
  if (env.NODE_ENV === "production" || env.OPS_LOCAL_DEMO_MODE !== "true") {
    return null;
  }

  return {
    id: "ops-local-demo",
    email: "demo@onecompany.local",
    name: "Demo Owner",
    permissions: [...LOCAL_DEMO_PERMISSIONS],
    roleKeys: ["ops_local_demo"],
    isOwner: false,
  };
}
