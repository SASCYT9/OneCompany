import { NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { prisma } from '@/lib/prisma';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'app70wZOSKU5xSoGX';

/**
 * GET /api/shop/account/crm-orders
 * 
 * Returns CRM orders linked to the currently logged-in customer.
 * Looks up the customer's notes field for [Airtable:recXXX] and fetches
 * related orders from Airtable.
 */
export async function GET() {
  try {
    const session = await getCurrentShopCustomerSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      select: { notes: true, email: true, firstName: true, lastName: true },
    });

    if (!customer) {
      return NextResponse.json({ data: [] });
    }

    // Extract Airtable record ID from notes
    const match = customer.notes?.match(/\[Airtable:(rec[a-zA-Z0-9]+)\]/);
    if (!match || !AIRTABLE_PAT) {
      return NextResponse.json({ data: [] });
    }

    const airtableCustomerId = match[1];

    // Fetch orders from Airtable linked to this customer
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/%D0%97%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B`);
    url.searchParams.set('maxRecords', '50');
    url.searchParams.set('sort[0][field]', '№');
    url.searchParams.set('sort[0][direction]', 'desc');
    // Filter by linked customer
    url.searchParams.set('filterByFormula', `FIND("${airtableCustomerId}", ARRAYJOIN({Контрагент}))`);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const data = await res.json();
    const orders = (data.records || []).map((rec: any) => ({
      id: rec.id,
      number: rec.fields['№'] || 0,
      name: rec.fields['Наименование'] || `Замовлення #${rec.fields['№'] || ''}`,
      orderStatus: rec.fields['Статус Заказа'] || 'Новий',
      paymentStatus: rec.fields['Статус Оплаты'] || 'Не оплачено',
      totalAmount: rec.fields['Сумма заказа'] || 0,
      clientTotal: rec.fields['Итого Клиент'] || 0,
      tag: rec.fields['tag'] || '',
      orderDate: rec.fields['Дата заказа'] || null,
      itemCount: rec.fields['Кол-во товаров'] || 0,
    }));

    return NextResponse.json({ data: orders });
  } catch (error: any) {
    console.error('[CRM Orders API]', error);
    return NextResponse.json({ data: [] });
  }
}

export const runtime = 'nodejs';
