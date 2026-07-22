import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  assertCanWriteProject,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { normalizeProjectPatchInput } from "@/lib/operations/projects";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  requireIfMatch,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

const select = {
  id: true,
  externalId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  nextAction: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { tasks: true, knowledgeArticles: true } },
} satisfies Prisma.OpsProjectSelect;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const { id } = await params;
    const project = await prisma.opsProject.findUnique({ where: { id }, select });
    if (!project) throw new OpsError("NOT_FOUND", 404, "Project not found");
    return withEntityHeaders(
      NextResponse.json({ project: serializeOpsJson(project) }),
      project.version
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const expectedVersion = requireIfMatch(request);
    const { id } = await params;
    const body = await request.json();
    const input = normalizeProjectPatchInput(body);
    if ("ownerId" in input) assertCanAssignTask(access, input.ownerId as string | null);

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: `ops.project.update:${id}`,
      key,
      payload: { expectedVersion, input },
      execute: async (tx) => {
        const current = await tx.opsProject.findUnique({
          where: { id },
          select: { id: true, version: true, ownerId: true },
        });
        if (!current) throw new OpsError("NOT_FOUND", 404, "Project not found");
        assertCanWriteProject(access, current);
        if (current.version !== expectedVersion) {
          throw new OpsError("VERSION_CONFLICT", 409, "Project changed since it was loaded", {
            currentVersion: current.version,
          });
        }
        if ("ownerId" in input && input.ownerId) {
          const owner = await tx.adminUser.findFirst({
            where: { id: input.ownerId as string, isActive: true },
            select: { id: true },
          });
          if (!owner) {
            throw new OpsError(
              "PROJECT_OWNER_NOT_FOUND",
              409,
              "Project owner is not an active admin"
            );
          }
        }
        const updatedCount = await tx.opsProject.updateMany({
          where: { id, version: expectedVersion },
          data: { ...input, version: { increment: 1 } },
        });
        if (updatedCount.count !== 1) {
          throw new OpsError("VERSION_CONFLICT", 409, "Project changed since it was loaded");
        }
        const project = await tx.opsProject.findUniqueOrThrow({ where: { id }, select });
        await writeOpsAudit(tx, access, {
          action: "project.update",
          entityType: "ops.project",
          entityId: id,
          metadata: {
            versionFrom: expectedVersion,
            versionTo: project.version,
            changedFields: Object.keys(input),
          },
        });
        return {
          body: serializeOpsJson({ project }),
          statusCode: 200,
          resourceType: "ops.project",
          resourceId: id,
        };
      },
    });
    return withEntityHeaders(
      NextResponse.json(result.body, { status: result.statusCode }),
      result.body.project.version,
      result.replayed
    );
  } catch (error) {
    return opsErrorResponse(error);
  }
}
