import { OpsTaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { requireOperationsAccess } from "@/lib/operations/access";
import { opsErrorResponse } from "@/lib/operations/errors";
import { assertOperationsEnabled } from "@/lib/operations/featureFlags";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    assertOperationsEnabled();
    await requireOperationsAccess(ADMIN_PERMISSIONS.OPS_TASKS_READ);
    const activeStatuses = Object.values(OpsTaskStatus).filter(
      (status) => status !== OpsTaskStatus.DONE && status !== OpsTaskStatus.CANCELLED
    );
    const [rawMembers, sharedTaskCount, activeTaskCount] = await prisma.$transaction([
      prisma.adminUser.findMany({
        where: {
          isActive: true,
          roles: {
            some: {
              role: {
                OR: [
                  { permissions: { has: "*" } },
                  { permissions: { has: "ops.*" } },
                  { permissions: { has: ADMIN_PERMISSIONS.OPS_TASKS_READ } },
                ],
              },
            },
          },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          _count: {
            select: {
              opsTasksAssigned: {
                where: { archivedAt: null, status: { in: activeStatuses } },
              },
            },
          },
        },
      }),
      prisma.opsTask.count({
        where: { archivedAt: null, isShared: true, status: { in: activeStatuses } },
      }),
      prisma.opsTask.count({
        where: { archivedAt: null, status: { in: activeStatuses } },
      }),
    ]);
    const members = rawMembers.map(({ _count, ...member }) => ({
      ...member,
      activeTaskCount: _count.opsTasksAssigned + sharedTaskCount,
    }));
    return NextResponse.json({ members, sharedTaskCount, activeTaskCount });
  } catch (error) {
    return opsErrorResponse(error);
  }
}
