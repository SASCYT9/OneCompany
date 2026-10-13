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
import { serializeOpsJson } from "@/lib/operations/selects";
import {
  dismissOpsSystemJob,
  getOpsSystemHealth,
  retryOpsSystemJob,
} from "@/lib/operations/system";
import { prisma } from "@/lib/prisma";

function parseSystemAction(value: unknown) {
  const input = (
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  ) as Record<string, unknown>;
  if (input.action !== "retry" && input.action !== "dismiss") {
    throw new OpsError(
      "SYSTEM_ACTION_INVALID",
      400,
      "Only the retry and dismiss actions are supported"
    );
  }
  const jobId = typeof input.jobId === "string" ? input.jobId.trim() : "";
  if (!jobId || jobId.length > 200) {
    throw new OpsError("JOB_ID_INVALID", 400, "A valid job id is required");
  }
  return { action: input.action, jobId };
}

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE);
    const requestedTake = Number(request.nextUrl.searchParams.get("take") ?? 25);
    const recentJobsLimit = Number.isFinite(requestedTake)
      ? Math.max(1, Math.min(50, Math.floor(requestedTake)))
      : 25;
    const health = await getOpsSystemHealth({
      client: prisma,
      recentJobsLimit,
    });
    return withEntityHeaders(NextResponse.json(serializeOpsJson(health)));
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_SYSTEM_MANAGE);
    const key = requireIdempotencyKey(request);
    const action = parseSystemAction(await request.json());

    if (action.action === "dismiss") {
      const dismissed = await runOpsIdempotentMutation({
        prisma,
        scope: `ops.system.job.dismiss:${action.jobId}`,
        key,
        payload: action,
        execute: async (tx) => {
          const job = await dismissOpsSystemJob({ tx, jobId: action.jobId });
          await writeOpsAudit(tx, access, {
            action: "system.job.dismiss",
            entityType: "ops.job",
            entityId: job.id,
            metadata: {
              jobType: job.type,
              stage: job.stage,
              previousStatus: job.previousStatus,
              attempts: job.attempts,
            },
          });
          return {
            body: serializeOpsJson({ job }),
            statusCode: 200,
            resourceType: "ops.job",
            resourceId: job.id,
          };
        },
      });
      return withEntityHeaders(
        NextResponse.json(dismissed.body, { status: dismissed.statusCode }),
        undefined,
        dismissed.replayed
      );
    }

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.system.job.retry:${action.jobId}`,
      key,
      payload: action,
      execute: async (tx) => {
        const job = await retryOpsSystemJob({
          tx,
          jobId: action.jobId,
        });
        await writeOpsAudit(tx, access, {
          action: "system.job.retry",
          entityType: "ops.job",
          entityId: job.id,
          metadata: {
            jobType: job.type,
            stage: job.stage,
            previousStatus: job.previousStatus,
            previousAttempts: job.previousAttempts,
            maxAttempts: job.maxAttempts,
            reusedDurableJob: true,
          },
        });
        return {
          body: serializeOpsJson({ job }),
          statusCode: 202,
          resourceType: "ops.job",
          resourceId: job.id,
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
