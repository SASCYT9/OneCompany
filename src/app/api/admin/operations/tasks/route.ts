import { OpsTaskSourceType, OpsTaskStatus, Prisma } from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { linkMatchingBrandGuides } from "@/lib/operations/brandGuides";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { createOpsExternalId } from "@/lib/operations/ids";
import { drainOpsJobs } from "@/lib/operations/jobs";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  withEntityHeaders,
} from "@/lib/operations/request";
import { opsTaskListSelect, serializeOpsJson } from "@/lib/operations/selects";
import { normalizeTaskCreateInput, resolveOpsTaskDueAt } from "@/lib/operations/tasks";
import { assertValidOpsTaskRelations } from "@/lib/operations/taskRelations";
import { enqueueOpsTaskAssignmentNotification } from "@/lib/operations/taskNotifications";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import { prisma } from "@/lib/prisma";

function parseStatuses(value: string | null) {
  if (!value) return undefined;
  const statuses = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is OpsTaskStatus =>
      Object.values(OpsTaskStatus).includes(entry as OpsTaskStatus)
    );
  return statuses.length ? statuses : undefined;
}

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim().slice(0, 200) ?? "";
    const statuses = parseStatuses(params.get("status"));
    const projectId = params.get("projectId")?.trim() || undefined;
    const includeArchived = params.get("archived") === "1";
    const mine = params.get("mine") === "1";
    const today = params.get("today") === "1";
    const overdue = params.get("overdue") === "1";
    const assignee = params.get("assignee")?.trim().slice(0, 100) || undefined;
    const assigneeNone = assignee === "none";
    const assigneeId = assignee && assignee !== "none" ? assignee : undefined;
    const missingNextAction = params.get("missingNextAction") === "1";
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 50) || 50));
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const where: Prisma.OpsTaskWhereInput = {
      ...(includeArchived ? {} : { archivedAt: null }),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(projectId ? { projectId } : {}),
      ...(mine || assigneeId
        ? {
            AND: [
              ...(mine
                ? [
                    {
                      OR: [
                        { assignees: { some: { adminUserId: access.id } } },
                        { assigneeId: access.id },
                        { isShared: true },
                      ],
                    },
                  ]
                : []),
              ...(assigneeId
                ? [
                    {
                      OR: [
                        { assignees: { some: { adminUserId: assigneeId } } },
                        { assigneeId },
                        { isShared: true },
                      ],
                    },
                  ]
                : []),
            ],
          }
        : {}),
      ...(assigneeNone ? { assigneeId: null, assignees: { none: {} }, isShared: false } : {}),
      ...(missingNextAction ? { nextAction: null } : {}),
      ...(today
        ? {
            dueAt: { lte: endOfToday },
            status: {
              notIn: [OpsTaskStatus.DONE, OpsTaskStatus.CANCELLED],
              ...(statuses ? { in: statuses } : {}),
            },
          }
        : {}),
      ...(overdue
        ? {
            dueAt: { lt: new Date() },
            status: {
              notIn: [OpsTaskStatus.DONE, OpsTaskStatus.CANCELLED],
              ...(statuses ? { in: statuses } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { externalId: { contains: search, mode: "insensitive" } },
              { nextAction: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, tasks] = await prisma.$transaction([
      prisma.opsTask.count({ where }),
      prisma.opsTask.findMany({
        where,
        orderBy: [{ status: "asc" }, { rank: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: opsTaskListSelect,
      }),
    ]);
    return NextResponse.json({
      tasks: serializeOpsJson(tasks),
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const body = await request.json();
    const normalizedInput = normalizeTaskCreateInput(body);
    const input = {
      ...normalizedInput,
      requestedById: normalizedInput.requestedById ?? access.id,
    };
    for (const assigneeId of input.assigneeIds) {
      assertCanAssignTask(access, assigneeId);
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: "ops.task.create",
      key,
      payload: input,
      execute: async (tx) => {
        await assertValidOpsTaskRelations(tx, input);
        const { assigneeIds, ...taskInput } = input;
        const task = await tx.opsTask.create({
          data: {
            ...taskInput,
            dueAt: resolveOpsTaskDueAt(input.dueAt),
            sourceType: OpsTaskSourceType.ADMIN,
            sourceId: null,
            sourceKey: null,
            externalId: createOpsExternalId("ONE"),
            createdById: access.id,
            assignees: assigneeIds.length
              ? {
                  create: assigneeIds.map((adminUserId) => ({
                    adminUserId,
                    assignedById: access.id,
                  })),
                }
              : undefined,
          },
          select: opsTaskListSelect,
        });
        const brandGuides = await linkMatchingBrandGuides(tx, {
          taskId: task.id,
          texts: [input.title, input.description, input.nextAction, ...input.tags],
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: task.id,
            type: "CREATED",
            actorId: access.id,
            idempotencyKey: key,
            payload: {
              status: task.status,
              priority: task.priority,
              assigneeId: task.assignee?.id ?? null,
              assigneeIds: task.assignees.map((assignment) => assignment.adminUserId),
              requestedById: task.requestedBy?.id ?? null,
              brandGuideKeys: brandGuides.brandArticles.map((article) => article.brandKey),
              shippingReferenceLinked: brandGuides.shippingArticles.length > 0,
              shippingEstimateKeys: brandGuides.shippingEstimates.map((estimate) => estimate.key),
            },
          },
        });
        await enqueueOpsTaskAssignmentNotification({
          client: tx,
          task: {
            id: task.id,
            externalId: task.externalId,
            title: task.title,
            assigneeId: task.assignee?.id ?? null,
            assigneeIds: task.assignees.map((assignment) => assignment.adminUserId),
            dueAt: task.dueAt,
            version: task.version,
          },
          assignedBy: access,
        });
        await writeOpsAudit(tx, access, {
          action: "task.create",
          entityType: "ops.task",
          entityId: task.id,
          metadata: {
            externalId: task.externalId,
            status: task.status,
            projectId: task.project?.id ?? null,
            shopOrderId: task.shopOrder?.id ?? null,
            assigneeIds: task.assignees.map((assignment) => assignment.adminUserId),
            requestedById: task.requestedBy?.id ?? null,
          },
        });
        return {
          body: serializeOpsJson({ task }),
          statusCode: 201,
          resourceType: "ops.task",
          resourceId: task.id,
        };
      },
    });
    if (input.assigneeIds.some((assigneeId) => assigneeId !== access.id)) {
      after(async () => {
        await drainOpsJobs({
          client: prisma,
          execute: createOpsJobStageExecutor({ client: prisma }),
          maxJobs: 4,
          timeBudgetMs: 12_000,
        }).catch((error) => {
          console.error("[operations.task.create.after] notification kick failed", error);
        });
      });
    }
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.task.version,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
