import { NextRequest, NextResponse } from 'next/server';
import {
  fetchAirtableCustomers,
  fetchAirtableOrders,
  fetchAllAirtableRecords,
  fetchAirtableOrderItems,
} from '@/lib/airtable';

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
        return NextResponse.json({ data: result.records, hasMore: !!result.offset });
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
