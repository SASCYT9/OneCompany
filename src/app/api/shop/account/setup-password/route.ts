import { NextRequest, NextResponse } from 'next/server';
import { consumeShopCustomerPasswordSetup } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '');

  if (!token) {
    return NextResponse.json({ error: 'Missing setup token' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    const customer = await consumeShopCustomerPasswordSetup(prisma, { token, password });
    return NextResponse.json({
      ok: true,
      email: customer.email,
      customerId: customer.id,
    });
  } catch (error) {
    if ((error as Error).message === 'TOKEN_INVALID') {
      return NextResponse.json({ error: 'This setup link is invalid or expired' }, { status: 400 });
    }

    console.error('Shop account setup password', error);
    return NextResponse.json({ error: 'Failed to set password' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
