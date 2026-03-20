import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { approveCustomerB2B, revertCustomerToB2C } from '@/lib/shopCustomers';
import {
  getShopCustomerAdminDetail,
  normalizeShopCustomerAdminPayload,
} from '@/lib/shopAdminCustomers';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: Params) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    await ensureDefaultShopStores(prisma);
    const { id } = await context.params;
    const storeKey = normalizeShopStoreKey(_request.nextUrl.searchParams.get('store'));
    const customer = await getShopCustomerAdminDetail(prisma, id, storeKey);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customer detail', error);
    return NextResponse.json({ error: 'Failed to load customer' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    await ensureDefaultShopStores(prisma);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? '').trim();
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));

    const existing = await prisma.shopCustomer.findUnique({
      where: { id },
      select: { id: true, email: true, group: true, firstName: true, lastName: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (action === 'approve_b2b') {
      const customer = await approveCustomerB2B(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.b2b.approve',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: customer.email,
          previousGroup: existing.group,
          nextGroup: customer.group,
        },
      });

      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id, storeKey));
    }

    if (action === 'revert_b2c') {
      const customer = await revertCustomerToB2C(prisma, id);
      await writeAdminAuditLog(prisma, session, {
        scope: 'shop',
        action: 'customer.b2b.revert',
        entityType: 'shop.customer',
        entityId: id,
        metadata: {
          email: customer.email,
          previousGroup: existing.group,
          nextGroup: customer.group,
        },
      });

      return NextResponse.json(await getShopCustomerAdminDetail(prisma, id, storeKey));
    }

    const payload = normalizeShopCustomerAdminPayload(body);
    const updated = await prisma.shopCustomer.update({
      where: { id },
      data: {
        firstName: payload.firstName || existing.firstName,
        lastName: payload.lastName || existing.lastName,
        phone: payload.phone,
        companyName: payload.companyName,
        vatNumber: payload.vatNumber,
        notes: payload.notes,
        b2bDiscountPercent: payload.b2bDiscountPercent,
        preferredLocale: payload.preferredLocale,
        isActive: payload.isActive,
        group: payload.group,
      },
      select: {
        id: true,
        email: true,
        group: true,
        b2bDiscountPercent: true,
        isActive: true,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.update',
      entityType: 'shop.customer',
      entityId: id,
      metadata: {
        email: updated.email,
        group: updated.group,
        b2bDiscountPercent: updated.b2bDiscountPercent != null ? Number(updated.b2bDiscountPercent) : null,
        isActive: updated.isActive,
      },
    });

    return NextResponse.json(await getShopCustomerAdminDetail(prisma, id, storeKey));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customer patch', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
