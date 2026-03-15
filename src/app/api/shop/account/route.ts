import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { serializeShopCustomerProfile, shopCustomerProfileInclude } from '@/lib/shopCustomers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await assertCurrentShopCustomerSession();
    const customer = await prisma.shopCustomer.findUnique({
      where: { id: session.customerId },
      include: shopCustomerProfileInclude,
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(serializeShopCustomerProfile(customer));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop account me', error);
    return NextResponse.json({ error: 'Failed to load account' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
