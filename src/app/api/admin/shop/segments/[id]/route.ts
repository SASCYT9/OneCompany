import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { computeSegmentMembers, type SegmentRules } from '@/lib/shopCustomerSegments';

/**
 * GET    /api/admin/shop/segments/[id]                → segment detail + member IDs
 * PATCH  /api/admin/shop/segments/[id]                → update name/description/rules
 * POST   /api/admin/shop/segments/[id]?action=recompute → refresh customer count
 * DELETE /api/admin/shop/segments/[id]                → remove segment
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segment = await (prisma as any).shopCustomerSegment.findUnique({ where: { id } });
    if (!segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 });

    // Get current sample of customers
    const memberIds = await computeSegmentMembers(segment.rulesJson as SegmentRules);
    const sample = await prisma.shopCustomer.findMany({
      where: { id: { in: memberIds.slice(0, 50) } },
      select: { id: true, email: true, firstName: true, lastName: true, group: true, companyName: true },
    });

    return NextResponse.json({
      ...segment,
      createdAt: segment.createdAt.toISOString(),
      updatedAt: segment.updatedAt.toISOString(),
      lastComputedAt: segment.lastComputedAt ? segment.lastComputedAt.toISOString() : null,
      memberCount: memberIds.length,
      memberSample: sample,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load segment' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const { id } = await params;
    const action = request.nextUrl.searchParams.get('action');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (action === 'recompute') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segment = await (prisma as any).shopCustomerSegment.findUnique({ where: { id } });
      if (!segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
      const members = await computeSegmentMembers(segment.rulesJson as SegmentRules);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).shopCustomerSegment.update({
        where: { id },
        data: { customerCount: members.length, lastComputedAt: new Date() },
      });
      return NextResponse.json({ ok: true, customerCount: members.length });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.rulesJson !== undefined) {
      data.rulesJson = body.rulesJson;
      const members = await computeSegmentMembers(body.rulesJson as SegmentRules);
      data.customerCount = members.length;
      data.lastComputedAt = new Date();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopCustomerSegment.update({ where: { id }, data });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'segment.update',
      entityType: 'shop.segment',
      entityId: id,
      metadata: { updates: Object.keys(data) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopCustomerSegment.delete({ where: { id } });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'segment.delete',
      entityType: 'shop.segment',
      entityId: id,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 });
  }
}
