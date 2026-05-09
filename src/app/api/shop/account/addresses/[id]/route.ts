import { NextRequest, NextResponse } from 'next/server';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import {
  deleteShopCustomerAddress,
  updateShopCustomerAddress,
} from '@/lib/shopCustomers';
import { isKnownShopCountry } from '@/lib/shopCountries';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    if (typeof body.country === 'string' && body.country && !isKnownShopCountry(body.country)) {
      return NextResponse.json({ error: 'Unsupported country' }, { status: 400 });
    }

    const address = await updateShopCustomerAddress(prisma, session.customerId, id, {
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
    return NextResponse.json({ address });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }
    if (message === 'ADDRESS_MISSING_REQUIRED_FIELDS') {
      return NextResponse.json(
        { error: 'Address line, city and country are required' },
        { status: 400 },
      );
    }
    console.error('Shop account address update', error);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const { id } = await context.params;
    await deleteShopCustomerAddress(prisma, session.customerId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'ADDRESS_NOT_FOUND') {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }
    console.error('Shop account address delete', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
