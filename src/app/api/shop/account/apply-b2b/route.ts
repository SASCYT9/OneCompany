import { NextRequest, NextResponse } from 'next/server';
import { assertCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { applyCustomerB2BRequest } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, getRequestIp } from '@/lib/shopPublicRateLimit';
import { notifyAdminShopB2BRequest } from '@/lib/telegramNotifications';
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;

export async function POST(request: NextRequest) {
  try {
    const session = await assertCurrentShopCustomerSession();
    const ip = getRequestIp(request.headers);

    if (
      !consumeRateLimit({
        keyParts: ['shop-b2b-apply', ip, session.email],
        windowMs: WINDOW_MS,
        maxPerWindow: MAX_PER_WINDOW,
      })
    ) {
      return NextResponse.json({ error: 'Too many B2B requests' }, { status: 429 });
    }

    const customer = await applyCustomerB2BRequest(prisma, session.customerId);

    await prisma.adminAuditLog.create({
      data: {
        actorEmail: session.email,
        actorName: session.name,
        scope: 'shop',
        action: 'customer.b2b.apply',
        entityType: 'shop.customer',
        entityId: session.customerId,
        metadata: {
          group: customer.group,
          source: 'customer_account',
        },
      },
    });

    await notifyAdminShopB2BRequest({
      customerName: session.name,
      email: session.email,
      companyName: customer.companyName,
    }).catch((error) => {
      console.error('Shop B2B notification failed', error);
    });

    return NextResponse.json({
      ok: true,
      group: customer.group,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'CUSTOMER_NOT_FOUND') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if ((error as Error).message === 'CUSTOMER_ALREADY_APPROVED') {
      return NextResponse.json({ error: 'Customer is already B2B approved' }, { status: 409 });
    }
    console.error('Shop B2B apply', error);
    return NextResponse.json({ error: 'Failed to submit B2B request' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
