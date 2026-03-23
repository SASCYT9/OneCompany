import { NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { prisma } from '@/lib/prisma';
import { fetchAirtableCustomerById } from '@/lib/airtable';

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'app70wZOSKU5xSoGX';

/**
 * GET /api/shop/account/crm-orders
 * 
 * Returns CRM orders linked to the currently logged-in customer, plus their balance.
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
      return NextResponse.json({ data: [], balance: 0, whoOwes: '' });
    }

    // Extract Airtable record ID from notes
    const match = customer.notes?.match(/\[Airtable:(rec[a-zA-Z0-9]+)\]/);
    if (!match || !AIRTABLE_PAT) {
      return NextResponse.json({ data: [], balance: 0, whoOwes: '' });
    }

    const airtableCustomerId = match[1];

    // Fetch balance and orders in parallel
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/%D0%97%D0%B0%D0%BA%D0%B0%D0%B7%D1%8B`);
    url.searchParams.set('maxRecords', '50');
    url.searchParams.set('sort[0][field]', '№');
    url.searchParams.set('sort[0][direction]', 'desc');
    url.searchParams.set('filterByFormula', `FIND("${airtableCustomerId}", ARRAYJOIN({Контрагент}))`);

    const [res, airtableCustomer] = await Promise.all([
      fetch(url.toString(), {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
        next: { revalidate: 60 },
      }),
      fetchAirtableCustomerById(airtableCustomerId)
    ]);

    if (!res.ok) {
      return NextResponse.json({ data: [], balance: airtableCustomer?.balance || 0, whoOwes: airtableCustomer?.whoOwes || '' });
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
      items: [] as Array<{ productName: string; brand: string; quantity: number; price: number; total: number }>,
    }));

    // Enrich with local CRM order items from synced DB
    if (orders.length > 0) {
      const airtableIds = orders.map((o: any) => o.id as string);
      const localCrmOrders = await prisma.crmOrder.findMany({
        where: { airtableId: { in: airtableIds } },
        include: { items: { orderBy: { positionNumber: 'asc' } } },
      });
      const crmMap = new Map(localCrmOrders.map(o => [o.airtableId, o]));
      for (const order of orders) {
        const local = crmMap.get(order.id);
        if (local?.items) {
          order.items = local.items.map(i => ({
            productName: i.productName,
            brand: i.brand,
            quantity: i.quantity,
            price: i.clientPricePerUnit || i.actualSalePrice || 0,
            total: i.clientTotal || i.actualSaleTotal || 0,
          }));
        }
      }
    }

    return NextResponse.json({
      data: orders,
      balance: airtableCustomer?.balance || 0,
      whoOwes: airtableCustomer?.whoOwes || ''
    });
  } catch (error: any) {
    console.error('[CRM Orders API]', error);
    return NextResponse.json({ data: [], balance: 0, whoOwes: '' });
  }
}

export const runtime = 'nodejs';
