import { cookies } from 'next/headers';
import { CustomerGroup, ShopPromotionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { serializeAdminPromotion } from '@/lib/shopPromotions';
import { ensureDefaultShopStores, normalizeShopStoreKey } from '@/lib/shopStores';

function stringValue(value: unknown) {
  return String(value ?? '').trim();
}

function nullableString(value: unknown) {
  const normalized = stringValue(value);
  return normalized || null;
}

function nullableNumber(value: unknown) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePromotionPayload(body: Record<string, unknown>) {
  const promotionType = String(body.promotionType ?? 'PERCENTAGE').trim().toUpperCase();
  return {
    storeKey: normalizeShopStoreKey(body.storeKey),
    code: nullableString(body.code)?.toUpperCase() ?? null,
    titleUa: stringValue(body.titleUa),
    titleEn: stringValue(body.titleEn),
    descriptionUa: nullableString(body.descriptionUa),
    descriptionEn: nullableString(body.descriptionEn),
    promotionType: (Object.values(ShopPromotionType) as string[]).includes(promotionType)
      ? (promotionType as ShopPromotionType)
      : ShopPromotionType.PERCENTAGE,
    autoApply: body.autoApply === true,
    priority: Math.max(0, Number(body.priority ?? 0) || 0),
    discountValue: nullableNumber(body.discountValue),
    currency: nullableString(body.currency)?.toUpperCase() ?? null,
    minimumSubtotal: nullableNumber(body.minimumSubtotal),
    usageLimit: nullableNumber(body.usageLimit),
    customerGroup: body.customerGroup && Object.values(CustomerGroup).includes(String(body.customerGroup) as CustomerGroup)
      ? (String(body.customerGroup) as CustomerGroup)
      : null,
    appliesToAll: body.appliesToAll !== false,
    productSlugs: stringArray(body.productSlugs),
    categorySlugs: stringArray(body.categorySlugs),
    brandNames: stringArray(body.brandNames),
    startsAt: body.startsAt ? new Date(String(body.startsAt)) : null,
    endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
    isActive: body.isActive !== false,
  };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_READ);
    await ensureDefaultShopStores(prisma);
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const promotions = await prisma.shopPromotion.findMany({
      where: { storeKey },
      orderBy: [{ isActive: 'desc' }, { autoApply: 'desc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    });
    return NextResponse.json(promotions.map(serializeAdminPromotion));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin promotions list', error);
    return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE);
    await ensureDefaultShopStores(prisma);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = normalizePromotionPayload(body);

    if (!payload.titleUa || !payload.titleEn) {
      return NextResponse.json({ error: 'titleUa and titleEn are required' }, { status: 400 });
    }

    if (payload.promotionType !== ShopPromotionType.FREE_SHIPPING && payload.discountValue == null) {
      return NextResponse.json({ error: 'discountValue is required' }, { status: 400 });
    }

    const promotion = await prisma.shopPromotion.create({
      data: payload,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'promotion.create',
      entityType: 'shop.promotion',
      entityId: promotion.id,
      metadata: {
        storeKey: promotion.storeKey,
        code: promotion.code,
        promotionType: promotion.promotionType,
      },
    });
    return NextResponse.json(serializeAdminPromotion(promotion), { status: 201 });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin promotion create', error);
    return NextResponse.json({ error: 'Failed to create promotion' }, { status: 500 });
  }
}
