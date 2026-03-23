import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAirtableCustomers, fetchAllAirtableRecords, AirtableCustomer } from '@/lib/airtable';

/**
 * POST /api/admin/crm/link-customer
 * 
 * Links a ShopCustomer to an Airtable Контрагент.
 * Body: { shopCustomerId: string, airtableCustomerId: string }
 * 
 * This allows admin to manually connect a website account
 * to an Airtable CRM customer, so all their orders show up in the cabinet.
 */
export async function POST(request: NextRequest) {
  try {
    const { shopCustomerId, airtableCustomerId } = await request.json();

    if (!shopCustomerId || !airtableCustomerId) {
      return NextResponse.json(
        { error: 'Both shopCustomerId and airtableCustomerId are required' },
        { status: 400 }
      );
    }

    // Verify the Airtable customer exists
    const atCustomers = await fetchAirtableCustomers({
      maxRecords: 1,
      filterFormula: `RECORD_ID() = "${airtableCustomerId}"`,
    });

    if (atCustomers.records.length === 0) {
      return NextResponse.json(
        { error: 'Airtable customer not found' },
        { status: 404 }
      );
    }

    const atCustomer = atCustomers.records[0];

    // Update the ShopCustomer's notes with the Airtable link
    const customer = await prisma.shopCustomer.update({
      where: { id: shopCustomerId },
      data: {
        notes: `[Airtable:${airtableCustomerId}] ${atCustomer.name} | Balance: $${atCustomer.balance.toFixed(2)}`,
        companyName: atCustomer.businessName || atCustomer.name || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        companyName: customer.companyName,
        airtableId: airtableCustomerId,
        airtableName: atCustomer.name,
      },
    });
  } catch (error: any) {
    console.error('[CRM Link Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/crm/link-customer
 * 
 * Returns all Airtable customers (Контрагенти) for the admin to pick from.
 * Useful in the admin UI when linking a ShopCustomer to an Airtable record.
 */
export async function GET() {
  try {
    const customers = await fetchAllAirtableRecords<AirtableCustomer>((opts) =>
      fetchAirtableCustomers({ ...opts, maxRecords: 100 })
    );

    // Only return customers tagged as "Клиент"
    const clients = customers.filter(c => c.tags.includes('Клиент'));

    return NextResponse.json({
      data: clients.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        businessName: c.businessName,
        balance: c.balance,
        whoOwes: c.whoOwes,
        totalSales: c.totalSales,
        orderCount: c.orderIds.length,
      })),
      totalClients: clients.length,
      totalAll: customers.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
