import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/crm/customers/[id]
 * Get CRM customer detail with orders and items
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);
  const { id } = await params;

  try {
    // Try by local ID first, then by airtableId
    let customer = await prisma.crmCustomer.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { orderDate: 'desc' },
          include: { items: { orderBy: { positionNumber: 'asc' } } },
        },
      },
    });

    if (!customer) {
      customer = await prisma.crmCustomer.findUnique({
        where: { airtableId: id },
        include: {
          orders: {
            orderBy: { orderDate: 'desc' },
            include: { items: { orderBy: { positionNumber: 'asc' } } },
          },
        },
      });
    }

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get markup
    const markup = await prisma.customerMarkup.findUnique({
      where: { customerId: customer.airtableId },
    });

    // Aggregate purchased products
    const allItems = customer.orders.flatMap(o => o.items);
    const productMap = new Map<string, { name: string; totalQty: number; totalRevenue: number; totalProfit: number }>();
    for (const item of allItems) {
      const existing = productMap.get(item.productName) || { name: item.productName, totalQty: 0, totalRevenue: 0, totalProfit: 0 };
      existing.totalQty += item.quantity;
      existing.totalRevenue += item.clientTotal;
      existing.totalProfit += item.profitPerItem;
      productMap.set(item.productName, existing);
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 15);

    return NextResponse.json({
      ...customer,
      markup: markup ? { markupPct: markup.markupPct, notes: markup.notes } : null,
      topProducts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
