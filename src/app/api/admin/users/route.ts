import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    // Use SHOP_SETTINGS_READ as a proxy for reading admins right now, or create an ADMIN_USERS_READ
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

    const users = await prisma.adminUser.findMany({
      include: {
        roles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(users);
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
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

    const { email, name, password, roleIds } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const passwordHash = hashPassword(password);

    const newUser = await prisma.adminUser.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name || 'Manager',
        passwordHash,
        roles: {
          create: (roleIds || []).map((roleId: string) => ({
            role: { connect: { id: roleId } }
          }))
        }
      }
    });

    return NextResponse.json({ success: true, id: newUser.id });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Failed to create admin', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
