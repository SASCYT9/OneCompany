import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_AUDIT_READ);

    const scope = request.nextUrl.searchParams.get('scope')?.trim() || 'shop';
    const entityType = request.nextUrl.searchParams.get('entityType')?.trim() || '';
    const takeRaw = Number(request.nextUrl.searchParams.get('take') || '100');
    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, Math.trunc(takeRaw))) : 100;

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        ...(scope ? { scope } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return NextResponse.json(
      logs.map((log) => ({
        id: log.id,
        actorEmail: log.actorEmail,
        actorName: log.actorName,
        scope: log.scope,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop audit list', error);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
