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
import { normalizeTaskCreateInput, normalizeTaskPatchInput } from "@/lib/operations/tasks";
import { prisma } from "@/lib/prisma";

const EDITABLE_PROPOSAL_FIELDS = new Set([
  "title",
  "description",
  "tags",
  "priority",
  "dueAt",
  "nextAction",
  "definitionOfDone",
  "assigneeId",
  "projectId",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_INBOX_REVIEW);
    assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const expectedPayloadHash =
      request.headers.get("if-match")?.trim().replace(/^W\//, "").replace(/^"|"$/g, "") ?? "";
    if (!/^[a-f0-9]{64}$/i.test(expectedPayloadHash)) {
      throw new OpsError(
        "IF_MATCH_REQUIRED",
        428,
        "If-Match must contain the current proposal payload hash"
      );
    }
    const { id, proposalId } = await params;
    const parsedBody = await request.json().catch(() => ({}));
    const rawBody =
      parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
        ? (parsedBody as Record<string, unknown>)
        : {};
    const unsafeFields = Object.keys(rawBody).filter(
      (field) => !EDITABLE_PROPOSAL_FIELDS.has(field)
    );
    if (unsafeFields.length) {
      throw new OpsError(
        "PROPOSAL_FIELD_NOT_EDITABLE",
        400,
        "Only safe task proposal fields can be edited",
        { fields: unsafeFields }
      );
    }
    const patch = normalizeTaskPatchInput(rawBody);
    if ("assigneeId" in patch) {
      assertCanAssignTask(access, patch.assigneeId as string | null);
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.inbox.proposal.update:${proposalId}`,
      key,
      payload: { inboxItemId: id, expectedPayloadHash, patch },
      execute: async (tx) => {
        const proposal = await tx.opsInboxProposal.findFirst({
          where: {
            id: proposalId,
            inboxItemId: id,
            kind: OpsProposalKind.TASK,
            status: OpsProposalStatus.PENDING,
            inboxItem: { reviewStatus: OpsInboxReviewStatus.PENDING },
          },
          select: { id: true, payload: true, payloadHash: true },
        });
        if (!proposal) {
          throw new OpsError(
            "PROPOSAL_NOT_EDITABLE",
            409,
            "Only a pending task proposal can be edited"
          );
        }
        if (proposal.payloadHash !== expectedPayloadHash) {
          throw new OpsError("VERSION_CONFLICT", 409, "Proposal changed since it was loaded", {
            currentPayloadHash: proposal.payloadHash,
          });
        }
        const merged = {
          ...(proposal.payload as Record<string, unknown>),
          ...patch,
        };
        const normalized = normalizeTaskCreateInput(merged);
        await assertValidOpsTaskRelations(tx, normalized);
        const storedPayload = toStoredJson({
          ...(proposal.payload as Record<string, unknown>),
          title: normalized.title,
          description: normalized.description,
          tags: normalized.tags,
          status: normalized.status,
          priority: normalized.priority,
          executorType: normalized.executorType,
          projectId: normalized.projectId,
          shopOrderId: normalized.shopOrderId,
          parentTaskId: normalized.parentTaskId,
          assigneeId: normalized.assigneeId,
          dueAt: normalized.dueAt?.toISOString() ?? null,
          nextAction: normalized.nextAction,
          definitionOfDone: normalized.definitionOfDone,
          blockerType: normalized.blockerType,
          blockerDescription: normalized.blockerDescription,
          sourceType: normalized.sourceType,
          sourceId: normalized.sourceId,
          sourceKey: normalized.sourceKey,
        });
        const payloadHash = hashOpsRequest(storedPayload);
        const duplicate = await tx.opsInboxProposal.findFirst({
          where: {
            inboxItemId: id,
            payloadHash,
            id: { not: proposalId },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new OpsError(
            "PROPOSAL_DUPLICATE",
            409,
            "This proposal duplicates another proposal in the same Inbox item"
          );
        }
        const updated = await tx.opsInboxProposal.update({
          where: { id: proposalId },
          data: {
            payload: storedPayload,
            payloadHash,
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
          action: "inbox.proposal.update",
          entityType: "ops.inbox.proposal",
          entityId: proposalId,
          metadata: {
            inboxItemId: id,
            changedFields: Object.keys(patch),
          },
        });
        return {
          body: serializeOpsJson({ proposal: updated }),
          statusCode: 200,
          resourceType: "ops.inbox.proposal",
          resourceId: proposalId,
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
