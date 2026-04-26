import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { computeSegmentMembers, type SegmentRules } from '@/lib/shopCustomerSegments';

/**
 * GET   /api/admin/shop/segments         → list segments
 * POST  /api/admin/shop/segments         → create segment
 * Body: { name, description?, rulesJson }
 */

type CreateBody = {
  name?: string;
  description?: string | null;
  rulesJson?: SegmentRules;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segments = await (prisma as any).shopCustomerSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      segments: segments.map(
        (s: Record<string, unknown> & { createdAt: Date; updatedAt: Date; lastComputedAt: Date | null }) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          lastComputedAt: s.lastComputedAt ? s.lastComputedAt.toISOString() : null,
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const body = (await request.json().catch(() => ({}))) as CreateBody;
    if (!body.name || !body.rulesJson) {
      return NextResponse.json({ error: 'name and rulesJson are required' }, { status: 400 });
    }

    // Compute initial member count
    const members = await computeSegmentMembers(body.rulesJson);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopCustomerSegment.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        rulesJson: body.rulesJson,
        customerCount: members.length,
        lastComputedAt: new Date(),
        createdBy: session.email,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'segment.create',
      entityType: 'shop.segment',
      entityId: created.id,
      metadata: { name: body.name, customerCount: members.length },
    });

    return NextResponse.json({ id: created.id, customerCount: members.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Segment create error:', error);
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}
