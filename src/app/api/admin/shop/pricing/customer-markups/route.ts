import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { getAllCustomerMarkups, upsertCustomerMarkup, deleteCustomerMarkup } from '@/lib/turn14Pricing';
import { fetchAirtableCustomers } from '@/lib/airtable';

/**
 * GET /api/admin/shop/pricing/customer-markups
 * Returns all customer markups + available Airtable customers
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const markups = await getAllCustomerMarkups();

    // Also fetch Airtable customers for dropdown
    let airtableCustomers: { id: string; name: string }[] = [];
    try {
      const { records } = await fetchAirtableCustomers({ maxRecords: 200 });
      airtableCustomers = records.map(r => ({ id: r.id, name: r.name }));
    } catch { /* Airtable may not be configured */ }

    return NextResponse.json({
      markups,
      airtableCustomers,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/shop/pricing/customer-markups
 * Create or update a customer markup
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const body = await request.json();
    const { customerId, customerName, markupPct, notes } = body;

    if (!customerId || !customerName) {
      return NextResponse.json({ error: 'customerId and customerName required' }, { status: 400 });
    }

    const markup = await upsertCustomerMarkup({
      customerId,
      customerName,
      markupPct: Number(markupPct) || 25,
      notes,
    });

    return NextResponse.json({ success: true, markup });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/shop/pricing/customer-markups
 * Remove a customer markup (revert to brand default)
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'customerId required' }, { status: 400 });
    }

    await deleteCustomerMarkup(customerId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = 'nodejs';
