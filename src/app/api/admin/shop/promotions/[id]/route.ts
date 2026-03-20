import { cookies } from 'next/headers';
import { CustomerGroup, ShopPromotionType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { serializeAdminPromotion } from '@/lib/shopPromotions';

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

function normalizePromotionPatch(body: Record<string, unknown>) {
  const rawType = nullableString(body.promotionType)?.toUpperCase();
  return {
    code: Object.prototype.hasOwnProperty.call(body, 'code') ? nullableString(body.code)?.toUpperCase() ?? null : undefined,
    titleUa: Object.prototype.hasOwnProperty.call(body, 'titleUa') ? stringValue(body.titleUa) : undefined,
    titleEn: Object.prototype.hasOwnProperty.call(body, 'titleEn') ? stringValue(body.titleEn) : undefined,
    descriptionUa: Object.prototype.hasOwnProperty.call(body, 'descriptionUa') ? nullableString(body.descriptionUa) : undefined,
    descriptionEn: Object.prototype.hasOwnProperty.call(body, 'descriptionEn') ? nullableString(body.descriptionEn) : undefined,
    promotionType: rawType && (Object.values(ShopPromotionType) as string[]).includes(rawType) ? (rawType as ShopPromotionType) : undefined,
    discountValue: Object.prototype.hasOwnProperty.call(body, 'discountValue') ? nullableNumber(body.discountValue) : undefined,
    currency: Object.prototype.hasOwnProperty.call(body, 'currency') ? nullableString(body.currency)?.toUpperCase() ?? null : undefined,
    minimumSubtotal: Object.prototype.hasOwnProperty.call(body, 'minimumSubtotal') ? nullableNumber(body.minimumSubtotal) : undefined,
    usageLimit: Object.prototype.hasOwnProperty.call(body, 'usageLimit') ? nullableNumber(body.usageLimit) : undefined,
    customerGroup: Object.prototype.hasOwnProperty.call(body, 'customerGroup')
      ? body.customerGroup && Object.values(CustomerGroup).includes(String(body.customerGroup) as CustomerGroup)
        ? (String(body.customerGroup) as CustomerGroup)
        : null
      : undefined,
    appliesToAll: Object.prototype.hasOwnProperty.call(body, 'appliesToAll') ? body.appliesToAll !== false : undefined,
    productSlugs: Object.prototype.hasOwnProperty.call(body, 'productSlugs') ? stringArray(body.productSlugs) : undefined,
    categorySlugs: Object.prototype.hasOwnProperty.call(body, 'categorySlugs') ? stringArray(body.categorySlugs) : undefined,
    brandNames: Object.prototype.hasOwnProperty.call(body, 'brandNames') ? stringArray(body.brandNames) : undefined,
    startsAt: Object.prototype.hasOwnProperty.call(body, 'startsAt') ? (body.startsAt ? new Date(String(body.startsAt)) : null) : undefined,
    endsAt: Object.prototype.hasOwnProperty.call(body, 'endsAt') ? (body.endsAt ? new Date(String(body.endsAt)) : null) : undefined,
    isActive: Object.prototype.hasOwnProperty.call(body, 'isActive') ? body.isActive !== false : undefined,
  };
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_READ);
    const { id } = await context.params;
    const promotion = await prisma.shopPromotion.findUnique({ where: { id } });
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminPromotion(promotion));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin promotion get', error);
    return NextResponse.json({ error: 'Failed to load promotion' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE);
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = normalizePromotionPatch(body);
    const promotion = await prisma.shopPromotion.update({
      where: { id },
      data: payload,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'promotion.update',
      entityType: 'shop.promotion',
      entityId: promotion.id,
      metadata: {
        code: promotion.code,
        promotionType: promotion.promotionType,
        isActive: promotion.isActive,
      },
    });
    return NextResponse.json(serializeAdminPromotion(promotion));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin promotion update', error);
    return NextResponse.json({ error: 'Failed to update promotion' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE);
    const { id } = await context.params;
    await prisma.shopPromotion.delete({ where: { id } });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'promotion.delete',
      entityType: 'shop.promotion',
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin promotion delete', error);
    return NextResponse.json({ error: 'Failed to delete promotion' }, { status: 500 });
  }
}
