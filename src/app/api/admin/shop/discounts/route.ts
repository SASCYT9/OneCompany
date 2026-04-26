import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { writeAdminAuditLog, ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/admin/shop/discounts          → list all discount codes
 * POST /api/admin/shop/discounts          → create a new discount
 *
 * GET supports filters via query string:
 *   ?status=ACTIVE|DRAFT|PAUSED|EXPIRED|ARCHIVED
 *   ?search={term}     (matches code + description)
 *   ?type=PERCENTAGE|FIXED_AMOUNT|FREE_SHIPPING|BUY_X_GET_Y
 */

type DiscountInput = {
  code?: string;
  description?: string | null;
  type?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'BUY_X_GET_Y';
  scope?: 'CART' | 'PRODUCT' | 'COLLECTION' | 'SHIPPING';
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
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

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const search = searchParams.get('search')?.trim() || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const discounts = await (prisma as any).shopDiscount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return NextResponse.json({
      discounts: discounts.map((d: Record<string, unknown> & { _count?: { redemptions: number } }) => ({
        ...d,
        value: d.value != null ? Number(d.value) : 0,
        minOrderValue: d.minOrderValue != null ? Number(d.minOrderValue) : null,
        getDiscountPct: d.getDiscountPct != null ? Number(d.getDiscountPct) : null,
        redemptionCount: d._count?.redemptions ?? 0,
        createdAt: (d.createdAt as Date).toISOString(),
        updatedAt: (d.updatedAt as Date).toISOString(),
        validFrom: d.validFrom ? (d.validFrom as Date).toISOString() : null,
        validUntil: d.validUntil ? (d.validUntil as Date).toISOString() : null,
      })),
      session: { email: session.email },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Discounts list error:', error);
    return NextResponse.json({ error: 'Failed to load discounts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const body = (await request.json().catch(() => ({}))) as DiscountInput;
    const code = body.code?.trim().toUpperCase();
    if (!code || code.length < 3) {
      return NextResponse.json({ error: 'Code must be at least 3 characters' }, { status: 400 });
    }
    if (!body.type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 });
    }
    if (body.type === 'PERCENTAGE' && (body.value == null || body.value <= 0 || body.value > 100)) {
      return NextResponse.json({ error: 'Percentage must be between 0 and 100' }, { status: 400 });
    }
    if (body.type === 'FIXED_AMOUNT' && (body.value == null || body.value <= 0)) {
      return NextResponse.json({ error: 'Fixed amount must be positive' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).shopDiscount.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: `Code "${code}" already exists` }, { status: 409 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopDiscount.create({
      data: {
        code,
        description: body.description ?? null,
        type: body.type,
        scope: body.scope ?? 'CART',
        status: body.status ?? 'DRAFT',
        value: body.value ?? 0,
        currency: body.currency ?? null,
        minOrderValue: body.minOrderValue ?? null,
        customerGroups: body.customerGroups ?? null,
        productIds: body.productIds ?? null,
        collectionIds: body.collectionIds ?? null,
        excludeOnSale: body.excludeOnSale ?? false,
        buyQuantity: body.buyQuantity ?? null,
        getQuantity: body.getQuantity ?? null,
        getDiscountPct: body.getDiscountPct ?? null,
        usageLimit: body.usageLimit ?? null,
        usageLimitPerUser: body.usageLimitPerUser ?? null,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        createdBy: session.email,
      },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'discount.create',
      entityType: 'shop.discount',
      entityId: created.id,
      metadata: { code, type: body.type },
    });

    return NextResponse.json({ id: created.id, code: created.code });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('Discount create error:', error);
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 });
  }
}
