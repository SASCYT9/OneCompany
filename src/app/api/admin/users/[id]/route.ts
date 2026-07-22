import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { cookies } from "next/headers";

import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminUserWithRolesInclude,
  determineAdminUserAuditAction,
  normalizeAdminUserPatchPayload,
  serializeAdminUser,
} from "@/lib/admin/adminUsers";
import { hashPassword } from "@/lib/hashPassword";
import { prisma } from "@/lib/prisma";

type AdminUsersPatchContext = {
  params: Promise<{
    id: string;
  }>;
};

type AdminUsersPatchTx = {
  adminUser: {
    update: (input: {
      where: { id: string };
      data: Prisma.AdminUserUpdateInput;
      include: typeof adminUserWithRolesInclude;
    }) => Promise<Parameters<typeof serializeAdminUser>[0]>;
    findUniqueOrThrow: (input: {
      where: { id: string };
      include: typeof adminUserWithRolesInclude;
    }) => Promise<Parameters<typeof serializeAdminUser>[0]>;
  };
  adminUserRole: {
    deleteMany: (input: { where: { userId: string } }) => Promise<unknown>;
    createMany: (input: { data: Array<{ userId: string; roleId: string }> }) => Promise<unknown>;
  };
  opsMemberProfile: {
    upsert: (input: {
      where: { adminUserId: string };
      create: {
        adminUserId: string;
        telegramUserId: bigint | null;
        telegramEnabled: boolean;
        timezone: string;
      };
      update: {
        telegramUserId: bigint | null;
        telegramEnabled: boolean;
        timezone: string;
      };
    }) => Promise<unknown>;
  };
};

type AdminUsersPatchDependencies = {
  cookies: typeof cookies;
  assertAdminRequest: typeof assertAdminRequest;
  prisma: {
    adminUser: {
      findUnique: (input: {
        where: { id: string };
        include: typeof adminUserWithRolesInclude;
      }) => Promise<Parameters<typeof serializeAdminUser>[0] | null>;
    };
    adminRole: {
      findMany: (input: {
        where: { id: { in: string[] } };
        select: { id: true };
      }) => Promise<Array<{ id: string }>>;
    };
    opsMemberProfile: {
      findFirst: (input: {
        where: {
          telegramUserId: bigint;
          adminUserId: { not: string };
        };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
    $transaction: <T>(callback: (tx: AdminUsersPatchTx) => Promise<T>) => Promise<T>;
  };
  writeAdminAuditLog: (
    tx: Prisma.TransactionClient | AdminUsersPatchTx,
    session: Awaited<ReturnType<typeof assertAdminRequest>>,
    entry: Parameters<typeof writeAdminAuditLog>[2]
  ) => ReturnType<typeof writeAdminAuditLog>;
  requiredPermission: (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
};

const defaultDependencies: AdminUsersPatchDependencies = {
  cookies,
  assertAdminRequest,
  prisma,
  writeAdminAuditLog: writeAdminAuditLog as AdminUsersPatchDependencies["writeAdminAuditLog"],
  requiredPermission: ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE,
};

export function createPatchAdminUserRoute(
  dependencies: AdminUsersPatchDependencies = defaultDependencies
) {
  return async function PATCH(request: NextRequest, context: AdminUsersPatchContext) {
    try {
      const { id } = await context.params;
      const cookieStore = await dependencies.cookies();
      const session = await dependencies.assertAdminRequest(
        cookieStore,
        dependencies.requiredPermission
      );
      const normalizedPayload = normalizeAdminUserPatchPayload(
        await request.json().catch(() => null)
      );

      if (!normalizedPayload.ok) {
        return NextResponse.json({ error: normalizedPayload.error }, { status: 400 });
      }

      const existingUser = await dependencies.prisma.adminUser.findUnique({
        where: { id },
        include: adminUserWithRolesInclude,
      });

      if (!existingUser) {
        return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
      }

      if (normalizedPayload.value.roleIds !== undefined) {
        const validRoles = await dependencies.prisma.adminRole.findMany({
          where: {
            id: {
              in: normalizedPayload.value.roleIds,
            },
          },
          select: { id: true },
        });

        if (validRoles.length !== normalizedPayload.value.roleIds.length) {
          return NextResponse.json({ error: "Unknown role id provided" }, { status: 400 });
        }
      }

      if (
        normalizedPayload.value.opsProfile &&
        normalizedPayload.value.opsProfile.telegramUserId !== null
      ) {
        const existingTelegramProfile = await dependencies.prisma.opsMemberProfile.findFirst({
          where: {
            telegramUserId: normalizedPayload.value.opsProfile.telegramUserId,
            adminUserId: { not: id },
          },
          select: { id: true },
        });
        if (existingTelegramProfile) {
          return NextResponse.json(
            { error: "Telegram user ID is already linked to another admin" },
            { status: 409 }
          );
        }
      }

      const action = determineAdminUserAuditAction(
        existingUser.isActive,
        normalizedPayload.value.isActive ?? existingUser.isActive,
        normalizedPayload.updatedFields
      );

      const updatedUser = await dependencies.prisma.$transaction(async (tx) => {
        const scalarData: Prisma.AdminUserUpdateInput = {};

        if (normalizedPayload.value.email !== undefined) {
          scalarData.email = normalizedPayload.value.email;
        }

        if (normalizedPayload.value.name !== undefined) {
          scalarData.name = normalizedPayload.value.name;
        }

        if (normalizedPayload.value.password !== undefined) {
          scalarData.passwordHash = hashPassword(normalizedPayload.value.password);
        }

        if (normalizedPayload.value.isActive !== undefined) {
          scalarData.isActive = normalizedPayload.value.isActive;
        }

        if (normalizedPayload.value.roleIds !== undefined) {
          await tx.adminUserRole.deleteMany({
            where: {
              userId: id,
            },
          });

          if (normalizedPayload.value.roleIds.length) {
            await tx.adminUserRole.createMany({
              data: normalizedPayload.value.roleIds.map((roleId) => ({
                userId: id,
                roleId,
              })),
            });
          }
        }

        if (normalizedPayload.value.opsProfile !== undefined) {
          await tx.opsMemberProfile.upsert({
            where: { adminUserId: id },
            create: {
              adminUserId: id,
              ...normalizedPayload.value.opsProfile,
            },
            update: normalizedPayload.value.opsProfile,
          });
        }

        const user =
          Object.keys(scalarData).length > 0
            ? await tx.adminUser.update({
                where: { id },
                data: scalarData,
                include: adminUserWithRolesInclude,
              })
            : await tx.adminUser.findUniqueOrThrow({
                where: { id },
                include: adminUserWithRolesInclude,
              });

        await dependencies.writeAdminAuditLog(tx, session, {
          scope: "admin",
          action,
          entityType: "admin.user",
          entityId: id,
          metadata: {
            updatedFields: normalizedPayload.updatedFields,
            roleIds: normalizedPayload.value.roleIds ?? undefined,
            isActive: normalizedPayload.value.isActive ?? undefined,
            opsProfile: normalizedPayload.value.opsProfile
              ? {
                  telegramUserId:
                    normalizedPayload.value.opsProfile.telegramUserId?.toString() ?? null,
                  telegramEnabled: normalizedPayload.value.opsProfile.telegramEnabled,
                  timezone: normalizedPayload.value.opsProfile.timezone,
                }
              : undefined,
          },
        });

        return user;
      });

      return NextResponse.json({
        success: true,
        user: serializeAdminUser(updatedUser),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "UNAUTHORIZED") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (message === "FORBIDDEN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "Email or Telegram user ID is already linked to another admin" },
          { status: 409 }
        );
      }
      console.error("Failed to update admin user", error);
      return NextResponse.json({ error: "Failed to update admin user" }, { status: 500 });
    }
  };
}

export const PATCH = createPatchAdminUserRoute();
