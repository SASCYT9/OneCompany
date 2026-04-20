import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminUserWithRolesInclude,
  normalizeAdminRoleIds,
  serializeAdminUser,
} from '@/lib/admin/adminUsers';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Use SHOP_SETTINGS_READ as a proxy for reading admins right now, or create an ADMIN_USERS_READ
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const users = await prisma.adminUser.findMany({
      include: adminUserWithRolesInclude,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users.map(serializeAdminUser));
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Failed to get admin users', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

import { hashPassword } from '@/lib/hashPassword';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { email, name, password, roleIds } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const normalizedRoleIds = normalizeAdminRoleIds(roleIds ?? []);
    if (!normalizedRoleIds.ok) {
      return NextResponse.json({ error: normalizedRoleIds.error }, { status: 400 });
    }

    const resolvedEmail = String(email).trim().toLowerCase();
    const resolvedName = typeof name === 'string' ? name.trim().slice(0, 120) || 'Manager' : 'Manager';

    const passwordHash = hashPassword(password);

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
      return NextResponse.json({ error: 'Unknown role id provided' }, { status: 400 });
    }

    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.adminUser.create({
        data: {
          email: resolvedEmail,
          name: resolvedName,
          passwordHash,
          roles: {
            create: normalizedRoleIds.value.map((roleId: string) => ({
              role: { connect: { id: roleId } }
            }))
          }
        },
        include: adminUserWithRolesInclude,
      });

      await writeAdminAuditLog(tx as Prisma.TransactionClient, session, {
        scope: 'admin',
        action: 'admin.user.create',
        entityType: 'admin.user',
        entityId: createdUser.id,
        metadata: {
          email: createdUser.email,
          updatedFields: ['email', 'name', 'passwordHash', 'roleIds'],
        },
      });

      return createdUser;
    });

    return NextResponse.json({ success: true, id: newUser.id, user: serializeAdminUser(newUser) });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Failed to create admin', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
