import {
  ADMIN_PERMISSIONS,
  OWNER_ROLE_KEY,
  SUPERADMIN_ROLE_KEY,
  matchesAdminPermission,
} from "@/lib/admin/adminPermissions";

export type OpsNotificationRoleGrant = {
  role: {
    key: string;
    permissions: string[];
  };
};

export const OPS_INTERNAL_NOTIFICATION_TYPES = [
  "telegram_task_assigned",
  "telegram_task_reminder",
  "telegram_internal_report",
] as const;

export type OpsInternalNotificationType = (typeof OPS_INTERNAL_NOTIFICATION_TYPES)[number];

export function requiredPermissionForOpsNotification(notificationType: string): string | null {
  if (
    notificationType === "telegram_task_assigned" ||
    notificationType === "telegram_task_reminder" ||
    notificationType === "telegram_internal_report"
  ) {
    return ADMIN_PERMISSIONS.OPS_TASKS_READ;
  }
  return null;
}

/**
 * Mirrors current admin access semantics without trusting a job payload or a
 * previously signed session. Notification workers must call this with roles
 * freshly selected from PostgreSQL immediately before enqueue/send.
 */
export function opsRolesAllowNotification(
  roles: readonly OpsNotificationRoleGrant[],
  notificationType: string
) {
  const requiredPermission = requiredPermissionForOpsNotification(notificationType);
  if (!requiredPermission) return false;

  const roleKeys = roles.map(({ role }) => role.key);
  if (roleKeys.includes(OWNER_ROLE_KEY) || roleKeys.includes(SUPERADMIN_ROLE_KEY)) {
    return true;
  }

  return matchesAdminPermission(
    roles.flatMap(({ role }) => role.permissions),
    requiredPermission
  );
}
