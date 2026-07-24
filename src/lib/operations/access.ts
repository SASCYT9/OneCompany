import type { Prisma } from "@prisma/client";
import {
  assertCurrentAdminAccess,
  currentAdminHasPermission,
  type CurrentAdminAccess,
} from "@/lib/admin/adminAccess";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { OpsError } from "@/lib/operations/errors";
import { OPS_MAX_TASK_ASSIGNEES } from "@/lib/operations/tasks";

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
  task: {
    assigneeId: string | null;
    createdById: string;
    isShared?: boolean;
    assigneeIds?: readonly string[];
    participantIds?: readonly string[];
    assignees?: readonly {
      adminUserId?: string;
      adminUser?: { id: string } | null;
    }[];
  },
  participantIds: readonly string[] = []
) {
  const assignedParticipantIds = new Set([
    ...(task.assigneeId ? [task.assigneeId] : []),
    ...(task.assigneeIds ?? []),
    ...(task.participantIds ?? []),
    ...(task.assignees ?? []).flatMap((entry) => entry.adminUserId ?? entry.adminUser?.id ?? []),
    ...participantIds,
  ]);
  if (
    canManageAllOpsTasks(access) ||
    task.isShared === true ||
    assignedParticipantIds.has(access.id) ||
    task.createdById === access.id
  ) {
    return;
  }
  throw new OpsError(
    "TASK_WRITE_FORBIDDEN",
    403,
    "Task members can only edit shared tasks or tasks they created or participate in"
  );
}

export function assertCanAssignTask(
  access: CurrentAdminAccess,
  assigneeIdOrIds: string | null | readonly string[]
) {
  const assigneeIds =
    typeof assigneeIdOrIds === "string"
      ? [assigneeIdOrIds]
      : assigneeIdOrIds
        ? [...assigneeIdOrIds]
        : [];
  if (assigneeIds.length > OPS_MAX_TASK_ASSIGNEES) {
    throw new OpsError(
      "VALIDATION_ERROR",
      400,
      `A task can have at most ${OPS_MAX_TASK_ASSIGNEES} assignees`
    );
  }
  if (
    assigneeIds.length === 0 ||
    assigneeIds.every((assigneeId) => assigneeId === access.id) ||
    canManageAllOpsTasks(access)
  ) {
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
