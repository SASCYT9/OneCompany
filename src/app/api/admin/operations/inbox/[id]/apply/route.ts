import {
  OpsInboxReviewStatus,
  OpsProposalKind,
  OpsProposalStatus,
  OpsTaskSourceType,
} from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  assertOperationsPermission,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { appendOpsSourceUrls, linkMatchingBrandGuides } from "@/lib/operations/brandGuides";
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_REVIEW);
    assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { proposalIds?: unknown };
    const proposalIds = Array.isArray(body.proposalIds)
      ? Array.from(
          new Set(body.proposalIds.map((entry) => String(entry).trim()).filter(Boolean))
        ).slice(0, 5)
      : [];

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.inbox.apply:${id}`,
      key,
      payload: { proposalIds },
      execute: async (tx) => {
        const inbox = await tx.opsInboxItem.findUnique({
          where: { id },
          include: {
            telegramUpdate: {
              select: { telegramUserId: true },
            },
            attachments: {
              where: { state: "READY" },
              select: { id: true },
            },
            proposals: {
              where: {
                status: OpsProposalStatus.PENDING,
                kind: OpsProposalKind.TASK,
                ...(proposalIds.length ? { id: { in: proposalIds } } : {}),
              },
              orderBy: { ordinal: "asc" },
              take: 5,
            },
          },
        });
        if (!inbox) throw new OpsError("NOT_FOUND", 404, "Inbox item not found");
        if (inbox.reviewStatus !== OpsInboxReviewStatus.PENDING) {
          throw new OpsError("INBOX_ALREADY_REVIEWED", 409, "Inbox item was already reviewed");
        }
        if (!inbox.proposals.length) {
          throw new OpsError("NO_TASK_PROPOSALS", 409, "No pending task proposals were selected");
        }
        if (proposalIds.length && inbox.proposals.length !== proposalIds.length) {
          throw new OpsError(
            "PROPOSAL_SELECTION_INVALID",
            409,
            "One or more selected proposals are not pending task proposals"
          );
        }
        const telegramRequester = await tx.opsMemberProfile.findFirst({
          where: {
            telegramUserId: inbox.telegramUpdate.telegramUserId,
            telegramEnabled: true,
            adminUser: { isActive: true },
          },
          select: {
            adminUserId: true,
            adminUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        });
        const taskCreatorId = telegramRequester?.adminUserId ?? access.id;
        const taskCreator = telegramRequester
          ? {
              id: telegramRequester.adminUserId,
              name: telegramRequester.adminUser.name,
              email: telegramRequester.adminUser.email,
            }
          : access;

        const tasks = [];
        for (const proposal of inbox.proposals) {
          if (proposal.appliedTaskId) {
            const existingTask = await tx.opsTask.findUnique({
              where: { id: proposal.appliedTaskId },
              select: opsTaskListSelect,
            });
            if (existingTask) {
              await tx.opsInboxProposal.update({
                where: { id: proposal.id },
                data: {
                  status: OpsProposalStatus.APPLIED,
                  appliedAt: new Date(),
                },
              });
              tasks.push(existingTask);
              continue;
            }
          }
          const input = normalizeTaskCreateInput(proposal.payload);
          input.description = appendOpsSourceUrls(input.description, [
            inbox.originalMessage,
            inbox.transcription,
          ]);
          input.requestedById ??= taskCreatorId;
          for (const assigneeId of input.assigneeIds) {
            assertCanAssignTask(access, assigneeId);
          }
          await assertValidOpsTaskRelations(tx, input);
          const { assigneeIds, ...taskInput } = input;
          const createdTask = await tx.opsTask.create({
            data: {
              ...taskInput,
              dueAt: resolveOpsTaskDueAt(input.dueAt),
              externalId: createOpsExternalId("ONE"),
              createdById: taskCreatorId,
              sourceType: OpsTaskSourceType.TELEGRAM,
              sourceId: proposal.id,
              sourceKey: `inbox:${id}:proposal:${proposal.id}`,
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
            taskId: createdTask.id,
            texts: [
              input.title,
              input.description,
              input.nextAction,
              ...input.tags,
              inbox.originalMessage,
              inbox.transcription,
            ],
          });
          if (inbox.attachments.length) {
            await tx.opsTaskAttachment.createMany({
              data: inbox.attachments.map((attachment) => ({
                taskId: createdTask.id,
                attachmentId: attachment.id,
                attachedById: access.id,
              })),
              skipDuplicates: true,
            });
            await tx.opsAttachment.updateMany({
              where: { id: { in: inbox.attachments.map((attachment) => attachment.id) } },
              data: { retentionAt: null },
            });
          }
          const task = inbox.attachments.length
            ? await tx.opsTask.findUniqueOrThrow({
                where: { id: createdTask.id },
                select: opsTaskListSelect,
              })
            : createdTask;
          await tx.opsTaskEvent.create({
            data: {
              taskId: task.id,
              type: "CREATED",
              actorId: access.id,
              sourceType: OpsTaskSourceType.TELEGRAM,
              sourceId: proposal.id,
              idempotencyKey: key,
              payload: {
                inboxItemId: id,
                proposalId: proposal.id,
                reviewedByHuman: true,
                reviewedById: access.id,
                requestedById: task.requestedBy?.id ?? null,
                assigneeIds: task.assignees.map((assignment) => assignment.adminUserId),
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
            assignedBy: taskCreator,
          });
          await tx.opsInboxProposal.update({
            where: { id: proposal.id },
            data: {
              status: OpsProposalStatus.APPLIED,
              appliedTaskId: task.id,
              appliedAt: new Date(),
            },
          });
          tasks.push(task);
        }

        const undoExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await tx.opsInboxItem.update({
          where: { id },
          data: {
            reviewStatus: OpsInboxReviewStatus.APPLIED,
            reviewedAt: new Date(),
            appliedTaskIds: tasks.map((task) => task.id),
            undoExpiresAt,
          },
        });
        await writeOpsAudit(tx, access, {
          action: "inbox.apply",
          entityType: "ops.inbox",
          entityId: id,
          metadata: {
            taskIds: tasks.map((task) => task.id),
            proposalIds: inbox.proposals.map((proposal) => proposal.id),
            undoExpiresAt: undoExpiresAt.toISOString(),
          },
        });
        return {
          body: serializeOpsJson({ tasks, undoExpiresAt }),
          statusCode: 201,
          resourceType: "ops.inbox",
          resourceId: id,
        };
      },
    });
    after(async () => {
      await drainOpsJobs({
        client: prisma,
        execute: createOpsJobStageExecutor({ client: prisma }),
        maxJobs: 6,
        timeBudgetMs: 15_000,
      }).catch((error) => {
        console.error("[operations.inbox.apply.after] notification kick failed", error);
      });
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
