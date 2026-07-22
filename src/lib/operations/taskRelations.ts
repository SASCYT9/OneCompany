import type { Prisma } from "@prisma/client";
import { OpsError } from "@/lib/operations/errors";

type RelationInput = {
  projectId?: string | null;
  shopOrderId?: string | null;
  parentTaskId?: string | null;
  assigneeId?: string | null;
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

  if (input.assigneeId) {
    const assignee = await tx.adminUser.findFirst({
      where: { id: input.assigneeId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      throw new OpsError("ASSIGNEE_NOT_FOUND", 409, "Assignee is not an active admin");
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
