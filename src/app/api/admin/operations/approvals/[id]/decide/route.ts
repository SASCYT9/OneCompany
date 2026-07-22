import { OpsApprovalStatus, OpsTaskEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import {
  assertOpsApprovalCanBeDecided,
  assertOpsApprovalPayloadIntegrity,
  normalizeOpsApprovalDecision,
} from "@/lib/operations/approvals";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE);
    const key = requireIdempotencyKey(request);
    const expectedTaskVersion = requireIfMatch(request);
    const { id } = await params;
    const decision = normalizeOpsApprovalDecision(await request.json());

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.approval.decide:${id}`,
      key,
      payload: { expectedTaskVersion, decision },
      execute: async (tx) => {
        const approval = await tx.opsApproval.findUnique({
          where: { id },
          select: {
            id: true,
            taskId: true,
            action: true,
            payload: true,
            payloadHash: true,
            requesterId: true,
            status: true,
            expiresAt: true,
            task: {
              select: {
                version: true,
              },
            },
          },
        });
        if (!approval) throw new OpsError("NOT_FOUND", 404, "Approval not found");
        assertOpsApprovalPayloadIntegrity(approval);
        const now = new Date();
        assertOpsApprovalCanBeDecided({
          status: approval.status,
          expiresAt: approval.expiresAt,
          now,
        });
        if (approval.task.version !== expectedTaskVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded", {
            currentVersion: approval.task.version,
          });
        }

        const changedTask = await tx.opsTask.updateMany({
          where: { id: approval.taskId, version: expectedTaskVersion },
          data: { version: { increment: 1 } },
        });
        if (changedTask.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded");
        }
        const changedApproval = await tx.opsApproval.updateMany({
          where: {
            id,
            status: OpsApprovalStatus.PENDING,
            expiresAt: { gt: now },
          },
          data: {
            status: decision.status,
            decisionNote: decision.note,
            approverId: access.id,
            approvedAt: decision.status === OpsApprovalStatus.APPROVED ? now : null,
            rejectedAt: decision.status === OpsApprovalStatus.REJECTED ? now : null,
          },
        });
        if (changedApproval.count !== 1) {
          throw new OpsError(
            "APPROVAL_DECISION_CONFLICT",
            409,
            "Approval changed before the decision was saved"
          );
        }
        const taskVersion = expectedTaskVersion + 1;
        await tx.opsTaskEvent.create({
          data: {
            taskId: approval.taskId,
            type:
              decision.status === OpsApprovalStatus.APPROVED
                ? OpsTaskEventType.APPROVED
                : OpsTaskEventType.UPDATED,
            actorId: access.id,
            idempotencyKey: key,
            payload: {
              approvalId: approval.id,
              action: approval.action,
              payloadHash: approval.payloadHash,
              decision: decision.status,
              effectExecuted: false,
              versionFrom: expectedTaskVersion,
              versionTo: taskVersion,
            },
          },
        });
        await writeOpsAudit(tx, access, {
          action:
            decision.status === OpsApprovalStatus.APPROVED ? "approval.approve" : "approval.reject",
          entityType: "ops.approval",
          entityId: approval.id,
          metadata: {
            taskId: approval.taskId,
            requestedById: approval.requesterId,
            action: approval.action,
            payloadHash: approval.payloadHash,
            effectExecuted: false,
            versionFrom: expectedTaskVersion,
            versionTo: taskVersion,
          },
        });
        const saved = await tx.opsApproval.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            taskId: true,
            action: true,
            payloadHash: true,
            status: true,
            decisionNote: true,
            requesterId: true,
            approverId: true,
            expiresAt: true,
            approvedAt: true,
            rejectedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return {
          body: serializeOpsJson({
            approval: saved,
            taskVersion,
            effectExecuted: false,
          }),
          statusCode: 200,
          resourceType: "ops.approval",
          resourceId: id,
        };
      },
    });

    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.taskVersion,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
