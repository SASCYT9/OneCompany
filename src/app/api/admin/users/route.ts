import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from "@/lib/adminRbac";
import {
  adminUserWithRolesInclude,
  normalizeAdminEmail,
  normalizeAdminRoleIds,
  normalizeAdminPassword,
  normalizeOpsMemberProfilePayload,
  serializeAdminUser,
} from "@/lib/admin/adminUsers";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE);

    const users = await prisma.adminUser.findMany({
      include: adminUserWithRolesInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users.map(serializeAdminUser));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Failed to get admin users", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

import { hashPassword } from "@/lib/hashPassword";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.ADMIN_USERS_MANAGE);

    const { email, name, password, roleIds, opsProfile } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const normalizedPassword = normalizeAdminPassword(password);
    if (!normalizedPassword.ok) {
      return NextResponse.json({ error: normalizedPassword.error }, { status: 400 });
    }

    const normalizedRoleIds = normalizeAdminRoleIds(roleIds ?? []);
    if (!normalizedRoleIds.ok) {
      return NextResponse.json({ error: normalizedRoleIds.error }, { status: 400 });
    }

    const normalizedOpsProfile =
      opsProfile === undefined ? null : normalizeOpsMemberProfilePayload(opsProfile);
    if (normalizedOpsProfile && !normalizedOpsProfile.ok) {
      return NextResponse.json({ error: normalizedOpsProfile.error }, { status: 400 });
    }

    const normalizedEmail = normalizeAdminEmail(email);
    if (!normalizedEmail.ok) {
      return NextResponse.json({ error: normalizedEmail.error }, { status: 400 });
    }
    const resolvedEmail = normalizedEmail.value;
    const resolvedName =
      typeof name === "string" ? name.trim().slice(0, 120) || "Manager" : "Manager";

    const passwordHash = hashPassword(normalizedPassword.value);

    const validRoles = normalizedRoleIds.value.length
      ? await prisma.adminRole.findMany({
          where: {
            id: {
              in: normalizedRoleIds.value,
            },
          },
          select: { id: true },
        })
      : [];

    if (validRoles.length !== normalizedRoleIds.value.length) {
      return NextResponse.json({ error: "Unknown role id provided" }, { status: 400 });
    }

    if (normalizedOpsProfile?.ok && normalizedOpsProfile.value.telegramUserId !== null) {
      const existingTelegramProfile = await prisma.opsMemberProfile.findUnique({
        where: { telegramUserId: normalizedOpsProfile.value.telegramUserId },
        select: { id: true },
      });
      if (existingTelegramProfile) {
        return NextResponse.json(
          { error: "Telegram user ID is already linked to another admin" },
          { status: 409 }
        );
      }
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.adminUser.create({
        data: {
          email: resolvedEmail,
          name: resolvedName,
          passwordHash,
          roles: {
            create: normalizedRoleIds.value.map((roleId: string) => ({
              role: { connect: { id: roleId } },
            })),
          },
          ...(normalizedOpsProfile?.ok
            ? {
                opsProfile: {
                  create: normalizedOpsProfile.value,
                },
              }
            : {}),
        },
        include: adminUserWithRolesInclude,
      });

      await writeAdminAuditLog(tx as Prisma.TransactionClient, session, {
        scope: "admin",
        action: "admin.user.create",
        entityType: "admin.user",
        entityId: createdUser.id,
        metadata: {
          email: createdUser.email,
          updatedFields: [
            "email",
            "name",
            "passwordHash",
            "roleIds",
            ...(normalizedOpsProfile?.ok ? ["opsProfile"] : []),
          ],
          opsProfile: normalizedOpsProfile?.ok
            ? {
                telegramUserId: normalizedOpsProfile.value.telegramUserId?.toString() ?? null,
                telegramEnabled: normalizedOpsProfile.value.telegramEnabled,
                timezone: normalizedOpsProfile.value.timezone,
              }
            : undefined,
        },
      });

      return createdUser;
    });

    return NextResponse.json({ success: true, id: newUser.id, user: serializeAdminUser(newUser) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or Telegram user ID is already in use" },
        { status: 409 }
      );
    }
    console.error("Failed to create admin", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
