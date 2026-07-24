import type { Prisma } from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";
import { normalizeOpsTaskAssigneeIds } from "@/lib/operations/tasks";

type RelationInput = {
  projectId?: string | null;
  shopOrderId?: string | null;
  parentTaskId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: readonly string[];
  requestedById?: string | null;
};

async function assertParentDoesNotCreateCycle(
  tx: Prisma.TransactionClient,
  parentTaskId: string,
  currentTaskId: string
) {
  let cursor: string | null = parentTaskId;
  const visited = new Set<string>();

  for (let depth = 0; cursor && depth < 100; depth += 1) {
    if (cursor === currentTaskId) {
      throw new OpsError("TASK_PARENT_CYCLE", 409, "A task cannot be its own ancestor");
    }
    if (visited.has(cursor)) {
      throw new OpsError("TASK_PARENT_CYCLE", 409, "The selected task hierarchy is cyclic");
    }
    visited.add(cursor);
    const parent: { parentTaskId: string | null } | null = await tx.opsTask.findUnique({
      where: { id: cursor },
      select: { parentTaskId: true },
    });
    if (!parent) {
      throw new OpsError("PARENT_TASK_NOT_FOUND", 409, "Linked parent task was not found");
    }
    cursor = parent.parentTaskId;
  }

  if (cursor) {
    throw new OpsError("TASK_PARENT_DEPTH_LIMIT", 409, "Task hierarchy is too deep");
  }
}

export async function assertValidOpsTaskRelations(
  tx: Prisma.TransactionClient,
  input: RelationInput,
  currentTaskId?: string
) {
  const assigneeIds =
    input.assigneeIds === undefined
      ? input.assigneeId
        ? [input.assigneeId]
        : []
      : normalizeOpsTaskAssigneeIds(input.assigneeIds);
  if (
    input.assigneeIds !== undefined &&
    input.assigneeId !== undefined &&
    input.assigneeId !== (assigneeIds[0] ?? null)
  ) {
    throw new OpsError(
      "VALIDATION_ERROR",
      400,
      "assigneeId must match the first assigneeIds entry"
    );
  }

  if (input.projectId) {
    const project = await tx.opsProject.findFirst({
      where: { id: input.projectId, archivedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new OpsError("PROJECT_NOT_FOUND", 409, "Linked project was not found");
    }
  }

  if (input.shopOrderId) {
    const order = await tx.shopOrder.findUnique({
      where: { id: input.shopOrderId },
      select: { id: true },
    });
    if (!order) {
      throw new OpsError("SHOP_ORDER_NOT_FOUND", 409, "Linked order was not found");
    }
  }

  if (assigneeIds.length > 0) {
    const assignees = await tx.adminUser.findMany({
      where: { id: { in: assigneeIds }, isActive: true },
      select: { id: true },
    });
    const activeIds = new Set(assignees.map((assignee) => assignee.id));
    const missingAssigneeIds = assigneeIds.filter((assigneeId) => !activeIds.has(assigneeId));
    if (missingAssigneeIds.length > 0) {
      throw new OpsError("ASSIGNEE_NOT_FOUND", 409, "One or more assignees are not active admins", {
        assigneeIds: missingAssigneeIds,
      });
    }
  }

  if (input.requestedById) {
    const requester = await tx.adminUser.findFirst({
      where: { id: input.requestedById, isActive: true },
      select: { id: true },
    });
    if (!requester) {
      throw new OpsError("REQUESTER_NOT_FOUND", 409, "Task requester is not an active admin");
    }
  }

  if (input.parentTaskId) {
    const parent = await tx.opsTask.findFirst({
      where: { id: input.parentTaskId, archivedAt: null },
      select: { id: true },
    });
    if (!parent) {
      throw new OpsError("PARENT_TASK_NOT_FOUND", 409, "Linked parent task was not found");
    }
    if (currentTaskId) {
      await assertParentDoesNotCreateCycle(tx, input.parentTaskId, currentTaskId);
    }
  }
}
