/**
 * POST /api/shop/account/exit-impersonation
 *
 * Clears the impersonation cookie so the storefront switches back to whatever
 * session the admin had previously (or to anonymous). Audit-logs the exit
 * if the cookie was valid.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { SHOP_IMPERSONATION_COOKIE, verifyImpersonationToken } from '@/lib/shopImpersonation';
import { prisma } from '@/lib/prisma';

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHOP_IMPERSONATION_COOKIE)?.value ?? null;
  const payload = verifyImpersonationToken(token);

  if (payload) {
    try {
      await prisma.adminAuditLog.create({
        data: {
          actorEmail: payload.adminEmail,
          actorName: payload.adminName,
          scope: 'shop',
          action: 'customer.impersonation.exit',
          entityType: 'shop.customer',
          entityId: payload.customerId,
          metadata: { exitedAt: new Date().toISOString() },
        },
      });
    } catch (error) {
      console.error('Impersonation exit audit log failed', error);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SHOP_IMPERSONATION_COOKIE);
  return response;
}

export const runtime = 'nodejs';
