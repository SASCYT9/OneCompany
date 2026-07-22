import type { Prisma } from "@prisma/client";
import {
  assertCurrentAdminAccess,
  currentAdminHasPermission,
  type CurrentAdminAccess,
} from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { OpsError } from "@/lib/operations/errors";

export async function requireOperationsAccess(requiredPermission: string) {
  return assertCurrentAdminAccess(requiredPermission);
}

export function canManageAllOpsTasks(access: CurrentAdminAccess) {
  return access.isOwner || currentAdminHasPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_ASSIGN);
}

export function assertOperationsPermission(access: CurrentAdminAccess, requiredPermission: string) {
  if (!currentAdminHasPermission(access, requiredPermission)) {
    throw new OpsError("FORBIDDEN", 403, "Permission is required");
  }
}

export function assertCanWriteTask(
  access: CurrentAdminAccess,
  task: { assigneeId: string | null; createdById: string; isShared?: boolean }
) {
  if (
    canManageAllOpsTasks(access) ||
    task.isShared === true ||
    task.assigneeId === access.id ||
    task.createdById === access.id
  ) {
    return;
  }
  throw new OpsError(
    "TASK_WRITE_FORBIDDEN",
    403,
    "Task members can only edit shared tasks or tasks they created or are assigned to"
  );
}

export function assertCanAssignTask(access: CurrentAdminAccess, assigneeId: string | null) {
  if (!assigneeId || assigneeId === access.id || canManageAllOpsTasks(access)) {
    return;
  }
  throw new OpsError("TASK_ASSIGN_FORBIDDEN", 403, "Task assignment permission is required");
}

export function assertCanWriteProject(
  access: CurrentAdminAccess,
  project: { ownerId: string | null }
) {
  if (canManageAllOpsTasks(access) || project.ownerId === access.id) {
    return;
  }
  throw new OpsError(
    "PROJECT_WRITE_FORBIDDEN",
    403,
    "Task members can only edit projects they own"
  );
}

export async function writeOpsAudit(
  tx: Prisma.TransactionClient,
  access: CurrentAdminAccess,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return tx.adminAuditLog.create({
    data: {
      actorId: access.id,
      actorEmail: access.email,
      actorName: access.name,
      scope: "operations",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
