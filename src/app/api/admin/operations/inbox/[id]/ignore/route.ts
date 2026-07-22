import { OpsInboxReviewStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess, writeOpsAudit } from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
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
      scope: `ops.inbox.ignore:${id}`,
      key,
      payload: {},
      execute: async (tx) => {
        const item = await tx.opsInboxItem.findUnique({
          where: { id },
          select: { id: true, reviewStatus: true },
        });
        if (!item) throw new OpsError("NOT_FOUND", 404, "Inbox item not found");
        if (item.reviewStatus !== OpsInboxReviewStatus.PENDING) {
          throw new OpsError("INBOX_ALREADY_REVIEWED", 409, "Inbox item was already reviewed");
        }
        await tx.opsInboxItem.update({
          where: { id },
          data: { reviewStatus: OpsInboxReviewStatus.IGNORED, reviewedAt: new Date() },
        });
        await writeOpsAudit(tx, access, {
          action: "inbox.ignore",
          entityType: "ops.inbox",
          entityId: id,
        });
        return {
          body: { item: { id, reviewStatus: OpsInboxReviewStatus.IGNORED } },
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
