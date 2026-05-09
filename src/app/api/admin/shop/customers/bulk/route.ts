/**
 * POST /api/admin/shop/customers/bulk
 * Body: { ids: string[], action: 'approve_b2b' | 'revert_b2c' | 'activate' | 'deactivate' }
 *
 * Applies the same admin action to a list of customers in one round-trip.
 * Each individual change is recorded in AdminAuditLog so per-row history
 * is preserved (no opaque "bulk" event).
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { approveCustomerB2B, revertCustomerToB2C } from '@/lib/shopCustomers';
import { prisma } from '@/lib/prisma';

const ACTIONS = ['approve_b2b', 'revert_b2c', 'activate', 'deactivate'] as const;
type BulkAction = (typeof ACTIONS)[number];

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);

    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; action?: unknown };
    const action = String(body.action ?? '').trim() as BulkAction;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
    const idsRaw = Array.isArray(body.ids) ? body.ids : [];
    const ids = idsRaw
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value): value is string => value.length > 0);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No customer ids provided' }, { status: 400 });
    }
    if (ids.length > 200) {
      return NextResponse.json(
        { error: 'Too many customers selected (max 200 per batch)' },
        { status: 400 },
      );
    }

    const customers = await prisma.shopCustomer.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, group: true, isActive: true },
    });

    let updated = 0;
    const skipped: string[] = [];
    for (const customer of customers) {
      try {
        if (action === 'approve_b2b') {
          if (customer.group === 'B2B_APPROVED') {
            skipped.push(customer.id);
            continue;
          }
          await approveCustomerB2B(prisma, customer.id);
          await writeAdminAuditLog(prisma, session, {
            scope: 'shop',
            action: 'customer.b2b.approve',
            entityType: 'shop.customer',
            entityId: customer.id,
            metadata: {
              email: customer.email,
              previousGroup: customer.group,
              nextGroup: 'B2B_APPROVED',
              source: 'bulk',
            },
          });
        } else if (action === 'revert_b2c') {
          if (customer.group === 'B2C') {
            skipped.push(customer.id);
            continue;
          }
          await revertCustomerToB2C(prisma, customer.id);
          await writeAdminAuditLog(prisma, session, {
            scope: 'shop',
            action: 'customer.b2b.revert',
            entityType: 'shop.customer',
            entityId: customer.id,
            metadata: {
              email: customer.email,
              previousGroup: customer.group,
              nextGroup: 'B2C',
              source: 'bulk',
            },
          });
        } else if (action === 'activate' || action === 'deactivate') {
          const targetActive = action === 'activate';
          if (customer.isActive === targetActive) {
            skipped.push(customer.id);
            continue;
          }
          await prisma.shopCustomer.update({
            where: { id: customer.id },
            data: { isActive: targetActive },
          });
          await writeAdminAuditLog(prisma, session, {
            scope: 'shop',
            action: targetActive ? 'customer.activate' : 'customer.deactivate',
            entityType: 'shop.customer',
            entityId: customer.id,
            metadata: {
              email: customer.email,
              previousActive: customer.isActive,
              nextActive: targetActive,
              source: 'bulk',
            },
          });
        }
        updated += 1;
      } catch (err) {
        console.error('Bulk customer action failed for', customer.id, err);
        skipped.push(customer.id);
      }
    }

    return NextResponse.json({ ok: true, updated, skipped, total: ids.length });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin customers bulk', error);
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
