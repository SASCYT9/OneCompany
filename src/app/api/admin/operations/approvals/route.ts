import { OpsApprovalStatus, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess } from "@/lib/operations/access";
import {
  effectiveOpsApprovalStatus,
  normalizeOpsApprovalStatusFilter,
} from "@/lib/operations/approvals";
import { opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { withEntityHeaders } from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_APPROVALS_DECIDE);
    const now = new Date();
    const status = normalizeOpsApprovalStatusFilter(request.nextUrl.searchParams.get("status"));
    const requestedTake = Number(request.nextUrl.searchParams.get("take") ?? 50);
    const take = Number.isFinite(requestedTake)
      ? Math.max(1, Math.min(100, Math.floor(requestedTake)))
      : 50;
    let where: Prisma.OpsApprovalWhereInput = {};
    if (status === OpsApprovalStatus.PENDING) {
      where = { status, expiresAt: { gt: now } };
    } else if (status === OpsApprovalStatus.EXPIRED) {
      where = {
        OR: [
          { status: OpsApprovalStatus.EXPIRED },
          { status: OpsApprovalStatus.PENDING, expiresAt: { lte: now } },
        ],
      };
    } else if (status) {
      where = { status };
    }
    const approvals = await prisma.opsApproval.findMany({
      where,
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      take,
      select: {
        id: true,
        action: true,
        payload: true,
        payloadHash: true,
        status: true,
        decisionNote: true,
        expiresAt: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
        updatedAt: true,
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
        task: {
          select: {
            id: true,
            externalId: true,
            title: true,
            status: true,
            version: true,
          },
        },
      },
    });
    return withEntityHeaders(
      NextResponse.json(
        serializeOpsJson({
          approvals: approvals.map((approval) => ({
            ...approval,
            status: effectiveOpsApprovalStatus({
              status: approval.status,
              expiresAt: approval.expiresAt,
              now,
            }),
          })),
        })
      )
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
