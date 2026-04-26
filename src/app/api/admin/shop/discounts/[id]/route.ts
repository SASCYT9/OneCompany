import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET    /api/admin/shop/discounts/[id]   → load full discount detail
 * PATCH  /api/admin/shop/discounts/[id]   → update discount
 * DELETE /api/admin/shop/discounts/[id]   → archive (soft-delete)
 */

type DiscountUpdateInput = {
  description?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  scope?: 'CART' | 'PRODUCT' | 'COLLECTION' | 'SHIPPING';
  value?: number;
  currency?: string | null;
  minOrderValue?: number | null;
  customerGroups?: string[] | null;
  productIds?: string[] | null;
  collectionIds?: string[] | null;
  excludeOnSale?: boolean;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  getDiscountPct?: number | null;
  usageLimit?: number | null;
  usageLimitPerUser?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const discount = await (prisma as any).shopDiscount.findUnique({
      where: { id },
      include: {
        _count: { select: { redemptions: true } },
        redemptions: {
          take: 50,
          orderBy: { redeemedAt: 'desc' },
          select: {
            id: true,
            orderId: true,
            customerId: true,
            email: true,
            amount: true,
            currency: true,
            redeemedAt: true,
          },
        },
      },
    });

    if (!discount) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...discount,
      value: discount.value != null ? Number(discount.value) : 0,
      minOrderValue: discount.minOrderValue != null ? Number(discount.minOrderValue) : null,
      getDiscountPct: discount.getDiscountPct != null ? Number(discount.getDiscountPct) : null,
      redemptionCount: discount._count?.redemptions ?? 0,
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
      validFrom: discount.validFrom ? discount.validFrom.toISOString() : null,
      validUntil: discount.validUntil ? discount.validUntil.toISOString() : null,
      redemptions: discount.redemptions.map(
        (r: { amount: { toString(): string }; redeemedAt: Date } & Record<string, unknown>) => ({
          ...r,
          amount: Number(r.amount),
          redeemedAt: r.redeemedAt.toISOString(),
        })
      ),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Discount GET error:', error);
    return NextResponse.json({ error: 'Failed to load discount' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as DiscountUpdateInput;

    if (body.type === 'PERCENTAGE' && body.value != null && (body.value <= 0 || body.value > 100)) {
      return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
    }
    if (body.type === 'FIXED_AMOUNT' && body.value != null && body.value <= 0) {
      return NextResponse.json({ error: 'Fixed amount must be positive' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.status !== undefined) data.status = body.status;
    if (body.type !== undefined) data.type = body.type;
    if (body.scope !== undefined) data.scope = body.scope;
    if (body.value !== undefined) data.value = body.value;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.minOrderValue !== undefined) data.minOrderValue = body.minOrderValue;
    if (body.customerGroups !== undefined) data.customerGroups = body.customerGroups;
    if (body.productIds !== undefined) data.productIds = body.productIds;
    if (body.collectionIds !== undefined) data.collectionIds = body.collectionIds;
    if (body.excludeOnSale !== undefined) data.excludeOnSale = body.excludeOnSale;
    if (body.buyQuantity !== undefined) data.buyQuantity = body.buyQuantity;
    if (body.getQuantity !== undefined) data.getQuantity = body.getQuantity;
    if (body.getDiscountPct !== undefined) data.getDiscountPct = body.getDiscountPct;
    if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit;
    if (body.usageLimitPerUser !== undefined) data.usageLimitPerUser = body.usageLimitPerUser;
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).shopDiscount.update({ where: { id }, data });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'discount.update',
      entityType: 'shop.discount',
      entityId: id,
      metadata: { updates: Object.keys(data) },
    });

    return NextResponse.json({ id: updated.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Discount PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update discount' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const { id } = await params;
    // Soft-delete: set status to ARCHIVED instead of hard delete (preserves redemption history)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopDiscount.update({ where: { id }, data: { status: 'ARCHIVED' } });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'discount.archive',
      entityType: 'shop.discount',
      entityId: id,
      metadata: {},
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Discount DELETE error:', error);
    return NextResponse.json({ error: 'Failed to archive discount' }, { status: 500 });
  }
}
