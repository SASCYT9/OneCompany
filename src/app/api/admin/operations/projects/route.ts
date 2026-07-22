import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  assertCanAssignTask,
  canManageAllOpsTasks,
  requireOperationsAccess,
  writeOpsAudit,
} from "@/lib/operations/access";
import { OpsError, opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { runOpsIdempotentMutation } from "@/lib/operations/idempotency";
import { createOpsExternalId } from "@/lib/operations/ids";
import { normalizeProjectCreateInput } from "@/lib/operations/projects";
import {
  assertOpsMutationBoundary,
  requireIdempotencyKey,
  withEntityHeaders,
} from "@/lib/operations/request";
import { serializeOpsJson } from "@/lib/operations/selects";
import { prisma } from "@/lib/prisma";

const projectSelect = {
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

export async function GET(request: NextRequest) {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 200) ?? "";
    const includeArchived = request.nextUrl.searchParams.get("archived") === "1";
    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50) || 50)
    );
    const projects = await prisma.opsProject.findMany({
      where: {
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { externalId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      take: limit,
      select: projectSelect,
    });
    return NextResponse.json({ projects: serializeOpsJson(projects) });
  } catch (error) {
    return opsErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertOperationsEnabled();
    assertOpsMutationBoundary(request);
    const access = await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_WRITE);
    const key = requireIdempotencyKey(request);
    const body = await request.json();
    const normalizedInput = normalizeProjectCreateInput(body);
    const input = {
      ...normalizedInput,
      ownerId: normalizedInput.ownerId ?? (canManageAllOpsTasks(access) ? null : access.id),
    };
    assertCanAssignTask(access, input.ownerId);

    const result = await runOpsIdempotentMutation({
      prisma,
      scope: "ops.project.create",
      key,
      payload: input,
      execute: async (tx) => {
        if (input.ownerId) {
          const owner = await tx.adminUser.findFirst({
            where: { id: input.ownerId, isActive: true },
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
        const project = await tx.opsProject.create({
          data: {
            ...input,
            externalId: createOpsExternalId("PRJ"),
          },
          select: projectSelect,
        });
        await writeOpsAudit(tx, access, {
          action: "project.create",
          entityType: "ops.project",
          entityId: project.id,
          metadata: {
            externalId: project.externalId,
            status: project.status,
          },
        });
        return {
          body: serializeOpsJson({ project }),
          statusCode: 201,
          resourceType: "ops.project",
          resourceId: project.id,
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
