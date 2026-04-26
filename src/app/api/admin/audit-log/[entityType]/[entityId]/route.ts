import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * Activity timeline endpoint — returns recent AdminAuditLog entries for
 * a specific entity instance.
 *
 * GET /api/admin/audit-log/[entityType]/[entityId]?take=50
 *
 * entityType examples: shop.order, shop.product, shop.customer
 */

const VALID_ENTITY_PREFIXES = ['shop.', 'admin.', 'crm.'] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { entityType, entityId } = await params;
    if (!VALID_ENTITY_PREFIXES.some((prefix) => entityType.startsWith(prefix))) {
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    }

    const logs = await prisma.adminAuditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
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
    console.error('Activity timeline error:', error);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
