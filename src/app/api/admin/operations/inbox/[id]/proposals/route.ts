import { OpsInboxReviewStatus, OpsProposalKind, OpsProposalStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  assertOperationsPermission,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import {
  assertOpsMutationBoundary,
  hashOpsRequest,
  requireIdempotencyKey,
  toStoredJson,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { assertValidOpsTaskRelations } from "@/lib/operations/taskRelations";
import { normalizeTaskCreateInput } from "@/lib/operations/tasks";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_REVIEW);
    assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const { id } = await params;
    const input = normalizeTaskCreateInput(await request.json().catch(() => ({})));
    for (const assigneeId of input.assigneeIds) {
      assertCanAssignTask(access, assigneeId);
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.inbox.proposal.create:${id}`,
      key,
      payload: input,
      execute: async (tx) => {
        const inbox = await tx.opsInboxItem.findUnique({
          where: { id },
          select: { id: true, reviewStatus: true },
        });
        if (!inbox) throw new OpsError("NOT_FOUND", 404, "Inbox item not found");
        if (inbox.reviewStatus !== OpsInboxReviewStatus.PENDING) {
          throw new OpsError("INBOX_ALREADY_REVIEWED", 409, "Inbox item was already reviewed");
        }

        await assertValidOpsTaskRelations(tx, input);
        const storedPayload = toStoredJson({
          title: input.title,
          description: input.description,
          tags: input.tags,
          status: input.status,
          priority: input.priority,
          executorType: input.executorType,
          projectId: input.projectId,
          shopOrderId: input.shopOrderId,
          parentTaskId: input.parentTaskId,
          assigneeId: input.assigneeId,
          assigneeIds: input.assigneeIds,
          requestedById: input.requestedById,
          dueAt: input.dueAt?.toISOString() ?? null,
          nextAction: input.nextAction,
          definitionOfDone: input.definitionOfDone,
          blockerType: input.blockerType,
          blockerDescription: input.blockerDescription,
        });
        const payloadHash = hashOpsRequest(storedPayload);
        const duplicate = await tx.opsInboxProposal.findFirst({
          where: { inboxItemId: id, payloadHash },
          select: { id: true },
        });
        if (duplicate) {
          throw new OpsError(
            "PROPOSAL_DUPLICATE",
            409,
            "This task draft already exists in the Inbox item"
          );
        }
        const latest = await tx.opsInboxProposal.findFirst({
          where: { inboxItemId: id },
          orderBy: { ordinal: "desc" },
          select: { ordinal: true },
        });
        const proposal = await tx.opsInboxProposal.create({
          data: {
            inboxItemId: id,
            kind: OpsProposalKind.TASK,
            ordinal: (latest?.ordinal ?? -1) + 1,
            payload: storedPayload,
            payloadHash,
            status: OpsProposalStatus.PENDING,
          },
          select: {
            id: true,
            kind: true,
            ordinal: true,
            payload: true,
            payloadHash: true,
            confidence: true,
            status: true,
            appliedTaskId: true,
            createdAt: true,
            appliedAt: true,
          },
        });
        await writeOpsAudit(tx, access, {
          action: "inbox.proposal.create_manual",
          entityType: "ops.inbox.proposal",
          entityId: proposal.id,
          metadata: {
            inboxItemId: id,
            assigneeIds: input.assigneeIds,
            requestedById: input.requestedById,
          },
        });
        return {
          body: serializeOpsJson({ proposal }),
          statusCode: 201,
          resourceType: "ops.inbox.proposal",
          resourceId: proposal.id,
        };
      },
    });

    const response = withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      undefined,
      result.replayed
    );
    response.headers.set("ETag", `"${result.body.proposal.payloadHash}"`);
    return response;
  } catch (error) {
    return opsErrorResponse(error);
  }
}
