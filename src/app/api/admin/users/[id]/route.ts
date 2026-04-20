import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { cookies } from 'next/headers';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminUserWithRolesInclude,
  determineAdminUserAuditAction,
  normalizeAdminUserPatchPayload,
  serializeAdminUser,
} from '@/lib/admin/adminUsers';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const normalizedPayload = normalizeAdminUserPatchPayload(await request.json().catch(() => null));

    if (!normalizedPayload.ok) {
      return NextResponse.json({ error: normalizedPayload.error }, { status: 400 });
    }

    const existingUser = await prisma.adminUser.findUnique({
      where: { id },
      include: adminUserWithRolesInclude,
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 404 });
    }

    if (normalizedPayload.value.roleIds !== undefined) {
      const validRoles = await prisma.adminRole.findMany({
        where: {
          id: {
            in: normalizedPayload.value.roleIds,
          },
        },
        select: { id: true },
      });

      if (validRoles.length !== normalizedPayload.value.roleIds.length) {
        return NextResponse.json({ error: 'Unknown role id provided' }, { status: 400 });
      }
    }

    const action = determineAdminUserAuditAction(
      existingUser.isActive,
      normalizedPayload.value.isActive ?? existingUser.isActive,
      normalizedPayload.updatedFields
    );

    const updatedUser = await prisma.$transaction(async (tx) => {
      const scalarData: Prisma.AdminUserUpdateInput = {};

      if (normalizedPayload.value.name !== undefined) {
        scalarData.name = normalizedPayload.value.name;
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

      await writeAdminAuditLog(tx as Prisma.TransactionClient, session, {
        scope: 'admin',
        action,
        entityType: 'admin.user',
        entityId: id,
        metadata: {
          updatedFields: normalizedPayload.updatedFields,
          roleIds: normalizedPayload.value.roleIds ?? undefined,
          isActive: normalizedPayload.value.isActive ?? undefined,
        },
      });

      return user;
    });

    return NextResponse.json({
      success: true,
      user: serializeAdminUser(updatedUser),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Failed to update admin user', error);
    return NextResponse.json({ error: 'Failed to update admin user' }, { status: 500 });
  }
}
