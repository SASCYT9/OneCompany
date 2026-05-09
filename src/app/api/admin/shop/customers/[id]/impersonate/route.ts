/**
 * POST /api/admin/shop/customers/[id]/impersonate
 *
 * Admin-only. Issues a 1-hour signed impersonation cookie that overlays
 * the customer's session for the storefront/cabinet. Writes an audit log
 * entry so other admins can see who started the session.
 *
 * The customer's actual NextAuth session is NOT replaced — exit just clears
 * the overlay cookie.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  SHOP_IMPERSONATION_COOKIE,
  SHOP_IMPERSONATION_COOKIE_OPTIONS,
  createImpersonationToken,
} from '@/lib/shopImpersonation';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    const { id } = await context.params;

    const customer = await prisma.shopCustomer.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.isActive) {
      return NextResponse.json(
        { error: 'Cannot impersonate a deactivated customer' },
        { status: 400 },
      );
    }

    const { token, expiresAt } = createImpersonationToken({
      adminEmail: session.email,
      adminName: session.name,
      customerId: customer.id,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.impersonation.start',
      entityType: 'shop.customer',
      entityId: customer.id,
      metadata: {
        email: customer.email,
        expiresAt: expiresAt.toISOString(),
      },
    });

    const response = NextResponse.json({
      ok: true,
      customerId: customer.id,
      email: customer.email,
      expiresAt: expiresAt.toISOString(),
    });
    response.cookies.set(SHOP_IMPERSONATION_COOKIE, token, SHOP_IMPERSONATION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin impersonate', error);
    return NextResponse.json({ error: 'Failed to start impersonation' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
