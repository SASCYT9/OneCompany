import { NextRequest, NextResponse } from 'next/server';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import {
  createShopCustomerAddress,
  listShopCustomerAddresses,
} from '@/lib/shopCustomers';
import { isKnownShopCountry } from '@/lib/shopCountries';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await assertCurrentShopCustomerSession();
    const addresses = await listShopCustomerAddresses(prisma, session.customerId);
    return NextResponse.json({ addresses });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Shop account addresses list', error);
    return NextResponse.json({ error: 'Failed to load addresses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.country === 'string' && body.country && !isKnownShopCountry(body.country)) {
      return NextResponse.json({ error: 'Unsupported country' }, { status: 400 });
    }

    const address = await createShopCustomerAddress(prisma, session.customerId, {
      label: typeof body.label === 'string' ? body.label : null,
      line1: String(body.line1 ?? ''),
      line2: typeof body.line2 === 'string' ? body.line2 : null,
      city: String(body.city ?? ''),
      region: typeof body.region === 'string' ? body.region : null,
      postcode: typeof body.postcode === 'string' ? body.postcode : null,
      country: String(body.country ?? ''),
      isDefaultShipping: Boolean(body.isDefaultShipping),
      isDefaultBilling: Boolean(body.isDefaultBilling),
    });
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'ADDRESS_MISSING_REQUIRED_FIELDS') {
      return NextResponse.json(
        { error: 'Address line, city and country are required' },
        { status: 400 },
      );
    }
    console.error('Shop account address create', error);
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
