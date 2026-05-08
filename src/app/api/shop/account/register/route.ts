import { NextRequest, NextResponse } from 'next/server';
import { createShopCustomerRegistration } from '@/lib/shopCustomers';
import { consumeRateLimit, getRequestIp } from '@/lib/shopPublicRateLimit';
import { prisma } from '@/lib/prisma';

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request.headers);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const password = String(body.password ?? '');
  const phone = String(body.phone ?? '').trim();
  const preferredLocale = String(body.preferredLocale ?? '').trim() || null;
  const region = String(body.region ?? '').trim() || null;
  const currencyPref = String(body.currencyPref ?? '').trim() || 'EUR';

  if (
    !(await consumeRateLimit({
      keyParts: ['shop-register', ip, email],
      windowMs: WINDOW_MS,
      maxPerWindow: MAX_PER_WINDOW,
    }))
  ) {
    return NextResponse.json({ error: 'Too many registration attempts' }, { status: 429 });
  }

  if (!email || !firstName || !lastName || !password) {
    return NextResponse.json({ error: 'Email, first name, last name and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const customer = await createShopCustomerRegistration(prisma, {
      email,
      firstName,
      lastName,
      password,
      phone,
      preferredLocale,
      currencyPref,
    });

    // Count guest orders that share this email — they auto-link to the cabinet
    // via getOrdersForCustomerDisplay's OR clause, so we surface a banner on
    // first visit so the customer doesn't think they're seeing someone else's
    // orders.
    const linkedOrdersCount = await prisma.shopOrder.count({
      where: {
        customerId: null,
        email: { equals: email, mode: 'insensitive' },
      },
    });

    return NextResponse.json({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      group: customer.group,
      linkedOrdersCount,
    });
  } catch (error) {
    if ((error as Error).message === 'CUSTOMER_EXISTS') {
      return NextResponse.json({ error: 'Customer with this email already exists' }, { status: 409 });
    }
    console.error('Shop customer registration', error);
    return NextResponse.json({ error: 'Failed to register customer' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
