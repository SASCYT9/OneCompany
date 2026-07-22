import { OpsTaskEventType, OpsTaskStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanWriteTask,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { opsAttachmentRetentionAt } from "@/lib/operations/media";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { opsTaskDetailSelect, serializeOpsJson } from "@/lib/operations/selects";
import {
  assertTaskStateInvariant,
  assertTaskTransition,
  isClosedTaskStatus,
  normalizeTaskTransitionInput,
} from "@/lib/operations/tasks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const input = normalizeTaskTransitionInput(await request.json());

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.task.transition:${id}`,
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
          },
        });
        if (!current) throw new OpsError("NOT_FOUND", 404, "Task not found");
        assertCanWriteTask(access, current);
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded", {
            currentVersion: current.version,
          });
        }
        assertTaskTransition(current.status, input.status, input);

        const waitingStatuses = new Set<OpsTaskStatus>([
          OpsTaskStatus.WAITING_HUMAN,
          OpsTaskStatus.WAITING_EXTERNAL,
          OpsTaskStatus.NEEDS_APPROVAL,
          OpsTaskStatus.BLOCKED,
        ]);
        const waiting = waitingStatuses.has(input.status);
        const nextAction = waiting ? null : (input.nextAction ?? current.nextAction);
        const blockerDescription = waiting
          ? (input.blockerDescription ?? current.blockerDescription)
          : null;
        const blockerType =
          waiting && blockerDescription
            ? (input.blockerType ?? current.blockerType ?? "OTHER")
            : null;
        assertTaskStateInvariant({
          status: input.status,
          nextAction,
          blockerType,
          blockerDescription,
        });

        const changed = await tx.opsTask.updateMany({
          where: { id, version: expectedVersion },
          data: {
            status: input.status,
            nextAction,
            blockerType,
            blockerDescription,
            completedAt: input.status === OpsTaskStatus.DONE ? new Date() : null,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded");
        }
        const taskAttachments = await tx.opsTaskAttachment.findMany({
          where: { taskId: id },
          select: { attachmentId: true },
        });
        const attachmentIds = taskAttachments.map((entry) => entry.attachmentId);
        if (attachmentIds.length) {
          if (isClosedTaskStatus(input.status)) {
            await tx.opsAttachment.updateMany({
              where: {
                id: { in: attachmentIds },
                tasks: {
                  none: {
                    task: {
                      archivedAt: null,
                      status: {
                        notIn: [OpsTaskStatus.DONE, OpsTaskStatus.CANCELLED],
                      },
                    },
                  },
                },
              },
              data: { retentionAt: opsAttachmentRetentionAt() },
            });
          } else if (isClosedTaskStatus(current.status)) {
            await tx.opsAttachment.updateMany({
              where: { id: { in: attachmentIds } },
              data: { retentionAt: null },
            });
          }
        }
        if (input.comment) {
          await tx.opsComment.create({
            data: { taskId: id, authorId: access.id, text: input.comment },
          });
        }
        const eventType = isClosedTaskStatus(current.status)
          ? OpsTaskEventType.REOPENED
          : input.status === OpsTaskStatus.BLOCKED
            ? OpsTaskEventType.BLOCKED
            : OpsTaskEventType.STATUS_CHANGED;
        await tx.opsTaskEvent.create({
          data: {
            taskId: id,
            type: eventType,
            actorId: access.id,
            idempotencyKey: key,
            payload: {
              from: current.status,
              to: input.status,
              hasComment: Boolean(input.comment),
            },
          },
        });
        const task = await tx.opsTask.findUniqueOrThrow({
          where: { id },
          select: opsTaskDetailSelect,
        });
        await writeOpsAudit(tx, access, {
          action: isClosedTaskStatus(current.status) ? "task.reopen" : "task.transition",
          entityType: "ops.task",
          entityId: id,
          metadata: {
            from: current.status,
            to: input.status,
            versionFrom: expectedVersion,
            versionTo: task.version,
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
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.task.version,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
