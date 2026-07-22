import { OpsInboxReviewStatus, OpsProposalStatus, OpsTaskStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { opsAttachmentRetentionAt } from "@/lib/operations/media";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  withEntityHeaders,
} from "@/lib/operations/request";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_REVIEW);
    const key = requireIdempotencyKey(request);
    const { id } = await params;

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.inbox.undo:${id}`,
      key,
      payload: {},
      execute: async (tx) => {
        const item = await tx.opsInboxItem.findUnique({
          where: { id },
          select: {
            id: true,
            reviewStatus: true,
            appliedTaskIds: true,
            undoExpiresAt: true,
          },
        });
        if (!item) throw new OpsError("NOT_FOUND", 404, "Inbox item not found");
        if (item.reviewStatus !== OpsInboxReviewStatus.APPLIED) {
          throw new OpsError(
            "UNDO_NOT_AVAILABLE",
            409,
            "Inbox item has no applied creation to undo"
          );
        }
        if (!item.undoExpiresAt || item.undoExpiresAt.getTime() < Date.now()) {
          throw new OpsError("UNDO_EXPIRED", 409, "The 10-minute undo window has expired");
        }

        const tasks = await tx.opsTask.findMany({
          where: { id: { in: item.appliedTaskIds } },
          select: { id: true, status: true, version: true },
        });
        if (tasks.length !== new Set(item.appliedTaskIds).size) {
          throw new OpsError(
            "UNDO_TASK_MISSING",
            409,
            "One or more created tasks are no longer available"
          );
        }
        if (tasks.some((task) => task.version !== 1)) {
          throw new OpsError(
            "UNDO_TASK_CHANGED",
            409,
            "Undo is unavailable because a created task was already changed"
          );
        }
        for (const task of tasks) {
          await tx.opsTask.update({
            where: { id: task.id },
            data: {
              status: OpsTaskStatus.CANCELLED,
              completedAt: null,
              blockerType: null,
              blockerDescription: null,
              version: { increment: 1 },
            },
          });
          await tx.opsTaskEvent.create({
            data: {
              taskId: task.id,
              type: "UNDONE",
              actorId: access.id,
              idempotencyKey: key,
              payload: { inboxItemId: id, from: task.status, to: OpsTaskStatus.CANCELLED },
            },
          });
        }
        const linkedAttachments = await tx.opsTaskAttachment.findMany({
          where: { taskId: { in: tasks.map((task) => task.id) } },
          select: { attachmentId: true },
        });
        const attachmentIds = Array.from(
          new Set(linkedAttachments.map((entry) => entry.attachmentId))
        );
        if (attachmentIds.length) {
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
        }
        await tx.opsInboxProposal.updateMany({
          where: { inboxItemId: id, status: OpsProposalStatus.APPLIED },
          data: { status: OpsProposalStatus.REJECTED },
        });
        await tx.opsInboxItem.update({
          where: { id },
          data: { reviewStatus: OpsInboxReviewStatus.UNDONE, reviewedAt: new Date() },
        });
        await writeOpsAudit(tx, access, {
          action: "inbox.undo",
          entityType: "ops.inbox",
          entityId: id,
          metadata: { cancelledTaskIds: tasks.map((task) => task.id) },
        });
        return {
          body: {
            item: { id, reviewStatus: OpsInboxReviewStatus.UNDONE },
            cancelledTaskIds: tasks.map((task) => task.id),
          },
          statusCode: 200,
          resourceType: "ops.inbox",
          resourceId: id,
        };
      },
    });
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      undefined,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
