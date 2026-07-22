import { after, NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  assertCanWriteTask,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { linkMatchingBrandGuides } from "@/lib/operations/brandGuides";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { drainOpsJobs } from "@/lib/operations/jobs";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { opsTaskDetailSelect, serializeOpsJson } from "@/lib/operations/selects";
import { assertTaskStateInvariant, normalizeTaskPatchInput } from "@/lib/operations/tasks";
import { assertValidOpsTaskRelations } from "@/lib/operations/taskRelations";
import { enqueueOpsTaskAssignmentNotification } from "@/lib/operations/taskNotifications";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import { prisma } from "@/lib/prisma";

function telegramMessageText(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  const text = String(message.text ?? message.caption ?? "").trim();
  return text || null;
}

function telegramSenderName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const sender = value as Record<string, unknown>;
  const name = [sender.first_name, sender.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return name || (sender.username ? `@${String(sender.username)}` : null);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const { id } = await params;
    const task = await prisma.opsTask.findUnique({ where: { id }, select: opsTaskDetailSelect });
    if (!task) throw new OpsError("NOT_FOUND", 404, "Task not found");
    const source =
      task.sourceType === "TELEGRAM" && task.sourceId
        ? await prisma.opsInboxProposal.findUnique({
            where: { id: task.sourceId },
            select: {
              inboxItem: {
                select: {
                  id: true,
                  originalMessage: true,
                  transcription: true,
                  telegramUpdate: {
                    select: {
                      isUntrustedForward: true,
                      receivedAt: true,
                      rawUpdate: true,
                    },
                  },
                },
              },
            },
          })
        : null;
    const rawUpdate =
      source?.inboxItem.telegramUpdate.rawUpdate &&
      typeof source.inboxItem.telegramUpdate.rawUpdate === "object"
        ? (source.inboxItem.telegramUpdate.rawUpdate as Record<string, unknown>)
        : null;
    const rawMessage =
      rawUpdate?.message && typeof rawUpdate.message === "object"
        ? (rawUpdate.message as Record<string, unknown>)
        : null;
    const reply =
      rawMessage?.reply_to_message && typeof rawMessage.reply_to_message === "object"
        ? (rawMessage.reply_to_message as Record<string, unknown>)
        : null;
    const forwardOrigin =
      rawMessage?.forward_origin && typeof rawMessage.forward_origin === "object"
        ? (rawMessage.forward_origin as Record<string, unknown>)
        : null;
    const forwardedSender =
      forwardOrigin?.sender_user && typeof forwardOrigin.sender_user === "object"
        ? forwardOrigin.sender_user
        : null;
    const telegramSource = source
      ? {
          inboxItemId: source.inboxItem.id,
          originalMessage: source.inboxItem.originalMessage,
          transcription: source.inboxItem.transcription,
          receivedAt: source.inboxItem.telegramUpdate.receivedAt,
          isForwarded: source.inboxItem.telegramUpdate.isUntrustedForward,
          forwardedFrom: telegramSenderName(forwardedSender),
          replyTo: reply
            ? {
                text: telegramMessageText(reply),
                sender: telegramSenderName(reply.from),
              }
            : null,
        }
      : null;
    return withEntityHeaders(
      NextResponse.json({
        task: serializeOpsJson({
          ...task,
          telegramSource,
        }),
      }),
      task.version
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const body = await request.json();
    const input = normalizeTaskPatchInput(body);
    if ("assigneeId" in input) {
      assertCanAssignTask(access, input.assigneeId as string | null);
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.task.update:${id}`,
      key,
      payload: { expectedVersion, input },
      execute: async (tx) => {
        const current = await tx.opsTask.findUnique({
          where: { id },
          select: {
            id: true,
            version: true,
            status: true,
            nextAction: true,
            blockerType: true,
            blockerDescription: true,
            assigneeId: true,
            createdById: true,
            isShared: true,
            title: true,
            description: true,
            tags: true,
          },
        });
        if (!current) throw new OpsError("NOT_FOUND", 404, "Task not found");
        assertCanWriteTask(access, current);
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded", {
            currentVersion: current.version,
          });
        }
        await assertValidOpsTaskRelations(tx, input, id);
        assertTaskStateInvariant({
          status: current.status,
          nextAction:
            "nextAction" in input ? (input.nextAction as string | null) : current.nextAction,
          blockerType: "blockerType" in input ? (input.blockerType as never) : current.blockerType,
          blockerDescription:
            "blockerDescription" in input
              ? (input.blockerDescription as string | null)
              : current.blockerDescription,
        });

        const updated = await tx.opsTask.updateMany({
          where: { id, version: expectedVersion },
          data: { ...input, version: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded");
        }
        const brandGuides = await linkMatchingBrandGuides(tx, {
          taskId: id,
          texts: [
            "title" in input ? (input.title as string) : current.title,
            "description" in input ? (input.description as string | null) : current.description,
            "nextAction" in input ? (input.nextAction as string | null) : current.nextAction,
            ...("tags" in input ? (input.tags as string[]) : current.tags),
          ],
        });
        const task = await tx.opsTask.findUniqueOrThrow({
          where: { id },
          select: opsTaskDetailSelect,
        });
        await tx.opsTaskEvent.create({
          data: {
            taskId: id,
            type: "UPDATED",
            actorId: access.id,
            idempotencyKey: key,
            payload: {
              changedFields: Object.keys(input),
              brandGuideKeys: brandGuides.brandArticles.map((article) => article.brandKey),
              shippingReferenceLinked: brandGuides.shippingArticles.length > 0,
              shippingEstimateKeys: brandGuides.shippingEstimates.map((estimate) => estimate.key),
              versionFrom: expectedVersion,
              versionTo: task.version,
              ...("assigneeId" in input
                ? {
                    assigneeIdFrom: current.assigneeId,
                    assigneeIdTo: task.assignee?.id ?? null,
                  }
                : {}),
            },
          },
        });
        if ("assigneeId" in input && current.assigneeId !== (task.assignee?.id ?? null)) {
          await enqueueOpsTaskAssignmentNotification({
            client: tx,
            task: {
              id: task.id,
              externalId: task.externalId,
              title: task.title,
              assigneeId: task.assignee?.id ?? null,
              dueAt: task.dueAt,
              version: task.version,
            },
            assignedBy: access,
          });
        }
        await writeOpsAudit(tx, access, {
          action: "task.update",
          entityType: "ops.task",
          entityId: id,
          metadata: {
            changedFields: Object.keys(input),
            versionFrom: expectedVersion,
            versionTo: task.version,
            ...("assigneeId" in input
              ? {
                  assigneeIdFrom: current.assigneeId,
                  assigneeIdTo: task.assignee?.id ?? null,
                }
              : {}),
          },
        });
        return {
          body: serializeOpsJson({ task }),
          statusCode: 200,
          resourceType: "ops.task",
          resourceId: id,
        };
      },
    });

    if ("assigneeId" in input && input.assigneeId && input.assigneeId !== access.id) {
      after(async () => {
        await drainOpsJobs({
          client: prisma,
          execute: createOpsJobStageExecutor({ client: prisma }),
          maxJobs: 4,
          timeBudgetMs: 12_000,
        }).catch((error) => {
          console.error("[operations.task.update.after] notification kick failed", error);
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
