import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAirtableCustomers,
  fetchAirtableOrders,
  fetchAllAirtableRecords,
  fetchAirtableOrderItems,
} from '@/lib/airtable';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/crm
 * Fetches CRM data from Airtable.
 * Query params:
 * - type: 'customers' | 'orders' | 'order-items'
 * - maxRecords: number
 * - filter: Airtable filter formula
 * - customerId: Airtable customer record ID (for fetching orders by customer)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'orders';
    const maxRecords = parseInt(searchParams.get('maxRecords') || '100', 10);
    const filter = searchParams.get('filter') || undefined;
    const customerId = searchParams.get('customerId') || undefined;

    switch (type) {
      case 'customers': {
        const result = await fetchAirtableCustomers({
          maxRecords,
          filterFormula: filter,
        });
        return NextResponse.json({ data: result.records, hasMore: !!result.offset });
      }

      case 'orders': {
        let filterFormula = filter;
        if (customerId) {
          // Filter orders for a specific customer
          filterFormula = `FIND("${customerId}", ARRAYJOIN({Клиент}))`;
        }
        const result = await fetchAirtableOrders({
          maxRecords,
          filterFormula,
          sort: [{ field: 'Номер', direction: 'desc' }],
        });

        // --- INJECT DYNAMIC B2B CALCULATION ---
        const uniqueAirtableCustomerIds = Array.from(new Set(result.records.flatMap(o => o.customerIds || [])));
        const b2bDiscountMap = new Map<string, number>();

        if (uniqueAirtableCustomerIds.length > 0) {
          const shopCustomers = await prisma.shopCustomer.findMany({
            where: {
              OR: uniqueAirtableCustomerIds.map(id => ({ notes: { contains: `[Airtable:${id}]` } }))
            },
            select: { notes: true, b2bDiscountPercent: true }
          });

          for (const cid of uniqueAirtableCustomerIds) {
            const sc = shopCustomers.find(c => c.notes?.includes(`[Airtable:${cid}]`));
            if (sc && sc.b2bDiscountPercent !== null) {
              b2bDiscountMap.set(cid, Number(sc.b2bDiscountPercent));
            }
          }
        }

        const enhancedRecords = result.records.map(order => {
          let calculatedB2bTotal: number | undefined;
          if (order.customerIds && order.customerIds.length > 0) {
            const discount = b2bDiscountMap.get(order.customerIds[0]) || 0;
            if (discount > 0 && order.totalAmount > 0) {
              calculatedB2bTotal = order.totalAmount * (1 - discount / 100);
            }
          }
          return {
            ...order,
            calculatedB2bTotal,
          };
        });

        return NextResponse.json({ data: enhancedRecords, hasMore: !!result.offset });
      }

      case 'order-items': {
        const result = await fetchAirtableOrderItems({
          filterFormula: filter,
        });
        return NextResponse.json({ data: result.records });
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[CRM API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
