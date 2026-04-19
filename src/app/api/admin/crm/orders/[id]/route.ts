import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/crm/orders/[id]
 * Get CRM order detail with items
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);
  const { id } = await params;

  try {
    // Try by local ID first, then by airtableId
    let order = await prisma.crmOrder.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, airtableId: true } },
        items: { orderBy: { positionNumber: 'asc' } },
      },
    });

    if (!order) {
      order = await prisma.crmOrder.findUnique({
        where: { airtableId: id },
        include: {
          customer: { select: { id: true, name: true, airtableId: true } },
          items: { orderBy: { positionNumber: 'asc' } },
        },
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
