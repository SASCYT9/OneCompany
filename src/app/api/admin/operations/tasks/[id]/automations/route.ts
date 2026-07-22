import { OpsAutomationStatus, OpsTaskEventType } from "@prisma/client";
import { after, NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanWriteTask,
  assertOperationsPermission,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import {
  assertOpsAutomationTaskCanStart,
  enqueueOpsAutomation,
  parseOpsAutomationRequest,
  resolveOpsAutomationRequestTarget,
} from "@/lib/operations/automation";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import {
  assertOperationsEnabled,
  assertOpsAutomationsEnabled,
} from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { drainOpsJobs } from "@/lib/operations/jobs";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { createOpsJobStageExecutor } from "@/lib/operations/telegramJobs";
import { prisma } from "@/lib/prisma";

const runSelect = {
  id: true,
  taskId: true,
  automationType: true,
  status: true,
  stage: true,
  attempts: true,
  maxAttempts: true,
  inputSnapshot: true,
  result: true,
  errorType: true,
  errorMessage: true,
  requestedById: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const { id } = await params;
    const task = await prisma.opsTask.findUnique({
      where: { id },
      select: { id: true, version: true },
    });
    if (!task) throw new OpsError("NOT_FOUND", 404, "Task not found");
    const runs = await prisma.opsAutomationRun.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: runSelect,
    });
    return withEntityHeaders(NextResponse.json(serializeOpsJson({ runs })), task.version);
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsAutomationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_AUTOMATION_RUN);
    assertOperationsPermission(access, ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const requestedAutomation = parseOpsAutomationRequest(await request.json());

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.task.automation.start:${id}`,
      key,
      payload: { expectedVersion, request: requestedAutomation },
      execute: async (tx) => {
        const task = await tx.opsTask.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            archivedAt: true,
            version: true,
            assigneeId: true,
            createdById: true,
            isShared: true,
          },
        });
        if (!task) throw new OpsError("NOT_FOUND", 404, "Task not found");
        assertCanWriteTask(access, task);
        assertOpsAutomationTaskCanStart(task);
        if (task.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded", {
            currentVersion: task.version,
          });
        }
        const activeRun = await tx.opsAutomationRun.findFirst({
          where: {
            taskId: id,
            status: {
              in: [OpsAutomationStatus.QUEUED, OpsAutomationStatus.RUNNING],
            },
          },
          select: { id: true },
        });
        if (activeRun) {
          throw new OpsError(
            "AUTOMATION_ALREADY_ACTIVE",
            409,
            "The task already has a queued or running helper",
            { runId: activeRun.id }
          );
        }

        const automationRequest = await resolveOpsAutomationRequestTarget(
          tx,
          id,
          requestedAutomation
        );
        const { run, job } = await enqueueOpsAutomation({
          tx,
          taskId: id,
          requestedById: access.id,
          idempotencyKey: key,
          request: automationRequest,
        });
        const changed = await tx.opsTask.updateMany({
          where: { id, version: expectedVersion },
          data: { version: { increment: 1 } },
        });
        if (changed.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Task changed since it was loaded");
        }
        const taskVersion = expectedVersion + 1;
        await tx.opsTaskEvent.create({
          data: {
            taskId: id,
            type: OpsTaskEventType.AUTOMATION_STARTED,
            actorId: access.id,
            idempotencyKey: key,
            payload: {
              phase: "queued",
              automationType: automationRequest.type,
              automationRunId: run.id,
              jobId: job.id,
              versionFrom: expectedVersion,
              versionTo: taskVersion,
            },
          },
        });
        await writeOpsAudit(tx, access, {
          action: "automation.start",
          entityType: "ops.automation",
          entityId: run.id,
          metadata: {
            taskId: id,
            automationType: automationRequest.type,
            jobId: job.id,
            versionFrom: expectedVersion,
            versionTo: taskVersion,
          },
        });
        const responseRun = await tx.opsAutomationRun.findUniqueOrThrow({
          where: { id: run.id },
          select: runSelect,
        });
        return {
          body: serializeOpsJson({
            run: responseRun,
            taskVersion,
          }),
          statusCode: 202,
          resourceType: "ops.automation",
          resourceId: run.id,
        };
      },
    });

    if (!result.replayed) {
      after(async () => {
        try {
          await drainOpsJobs({
            client: prisma,
            execute: createOpsJobStageExecutor({ client: prisma }),
            maxJobs: 4,
            timeBudgetMs: 20_000,
            types: [`automation:${requestedAutomation.type}`],
          });
        } catch (error) {
          console.error("[operations.automation.after] durable job kick failed", error);
        }
      });
    }
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.taskVersion,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
