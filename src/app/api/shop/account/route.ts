import { NextResponse } from 'next/server';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { prisma } from '@/lib/prisma';
import {
  getOrdersForCustomerDisplay,
  serializeShopCustomerProfile,
  shopCustomerProfileIncludeWithoutOrders,
} from '@/lib/shopCustomers';
import { normalizeShopStoreKey } from '@/lib/shopStores';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const allowAnonymous = url.searchParams.get('optional') === '1';
  try {
    const session = await assertCurrentShopCustomerSession();
    const storeKey = normalizeShopStoreKey(url.searchParams.get('store'));
    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      include: shopCustomerProfileIncludeWithoutOrders,
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const orders = await getOrdersForCustomerDisplay(prisma, customer.id, customer.email, storeKey);
    return NextResponse.json(serializeShopCustomerProfile({ ...customer, orders }));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      if (allowAnonymous) {
        return NextResponse.json(null);
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop account me', error);
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
