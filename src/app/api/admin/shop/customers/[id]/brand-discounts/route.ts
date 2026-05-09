/**
 * GET/POST/DELETE /api/admin/shop/customers/[id]/brand-discounts
 *
 * Admin CRUD for per-customer per-brand B2B discount overrides (#51).
 *
 * Requires the `20260508120000_add_archived_at_and_brand_discounts` migration
 * to be applied. Until then the endpoint returns 500 from Prisma.
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  deleteCustomerBrandDiscount,
  listCustomerBrandDiscounts,
  upsertCustomerBrandDiscount,
} from '@/lib/shopCustomerBrandDiscounts';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);
    const { id } = await context.params;
    const discounts = await listCustomerBrandDiscounts(prisma, id);
    return NextResponse.json({
      discounts: discounts.map((d) => ({
        id: d.id,
        brand: d.brand,
        discountPct: Number(d.discountPct),
        notes: d.notes,
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      brand?: string;
      discountPct?: number;
      notes?: string | null;
    };

    const discount = await upsertCustomerBrandDiscount(prisma, id, {
      brand: String(body.brand ?? ''),
      discountPct: Number(body.discountPct ?? 0),
      notes: typeof body.notes === 'string' ? body.notes : null,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.brand_discount.upsert',
      entityType: 'shop.customer',
      entityId: id,
      metadata: {
        brand: discount.brand,
        discountPct: Number(discount.discountPct),
      },
    });

    return NextResponse.json({
      discount: {
        id: discount.id,
        brand: discount.brand,
        discountPct: Number(discount.discountPct),
        notes: discount.notes,
        updatedAt: discount.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_WRITE);
    const { id } = await context.params;
    const url = new URL(request.url);
    const brand = url.searchParams.get('brand') ?? '';
    if (!brand) {
      return NextResponse.json({ error: 'brand query param required' }, { status: 400 });
    }
    await deleteCustomerBrandDiscount(prisma, id, brand);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'customer.brand_discount.delete',
      entityType: 'shop.customer',
      entityId: id,
      metadata: { brand },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

function mapError(error: unknown) {
  const msg = (error as Error).message;
  if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (msg === 'BRAND_REQUIRED') {
    return NextResponse.json({ error: 'Brand is required' }, { status: 400 });
  }
  if (msg === 'DISCOUNT_OUT_OF_RANGE') {
    return NextResponse.json({ error: 'Discount must be between 0 and 100' }, { status: 400 });
  }
  console.error('Admin customer brand-discounts', error);
  return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
}

export const runtime = 'nodejs';
