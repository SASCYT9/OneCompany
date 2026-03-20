import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { listShopCustomersAdmin } from '@/lib/shopAdminCustomers';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    await ensureDefaultShopStores(prisma);

    const url = new URL(request.url);
    const customers = await listShopCustomersAdmin(prisma, {
      q: url.searchParams.get('q'),
      group: url.searchParams.get('group'),
      status: url.searchParams.get('status'),
      storeKey: normalizeShopStoreKey(url.searchParams.get('store')),
    });

    return NextResponse.json(customers);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customers list', error);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
