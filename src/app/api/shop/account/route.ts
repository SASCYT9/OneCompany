import { NextRequest, NextResponse } from 'next/server';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import {
  getOrdersForCustomerDisplay,
  serializeShopCustomerProfile,
  shopCustomerProfileIncludeWithoutOrders,
} from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await assertCurrentShopCustomerSession();
    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      include: shopCustomerProfileIncludeWithoutOrders,
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const orders = await getOrdersForCustomerDisplay(prisma, customer.id, customer.email);
    return NextResponse.json(serializeShopCustomerProfile({ ...customer, orders }));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop account me', error);
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 });
  }
}

const ALLOWED_LOCALES = new Set(['en', 'ua']);

function nullable(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: 'First and last name are required' },
        { status: 400 },
      );
    }

    const preferredLocaleRaw = typeof body.preferredLocale === 'string' ? body.preferredLocale.trim() : '';
    const preferredLocale = ALLOWED_LOCALES.has(preferredLocaleRaw) ? preferredLocaleRaw : undefined;

    await prisma.shopCustomer.update({
      where: { id: session.customerId },
      data: {
        firstName,
        lastName,
        phone: nullable(body.phone),
        companyName: nullable(body.companyName),
        vatNumber: nullable(body.vatNumber),
        ...(preferredLocale ? { preferredLocale } : {}),
      },
    });

    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      include: shopCustomerProfileIncludeWithoutOrders,
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const orders = await getOrdersForCustomerDisplay(prisma, customer.id, customer.email);
    return NextResponse.json(serializeShopCustomerProfile({ ...customer, orders }));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop account update', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
