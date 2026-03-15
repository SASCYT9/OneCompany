import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminVariantSummarySelect,
  applyAdminPricingPatch,
  serializeAdminVariantSummary,
} from '@/lib/shopAdminVariants';

const prisma = new PrismaClient();

function decimalOrNull(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_READ);

    const variants = await prisma.shopProductVariant.findMany({
      orderBy: [{ productId: 'asc' }, { position: 'asc' }],
      select: adminVariantSummarySelect,
    });

    return NextResponse.json(variants.map(serializeAdminVariantSummary));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin pricing list', error);
    return NextResponse.json({ error: 'Failed to list pricing' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRICING_WRITE);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const variantIds = Array.isArray(body.variantIds)
      ? body.variantIds.map((entry) => String(entry))
      : [];

    const payload = {
      variantIds,
      priceEur: Object.prototype.hasOwnProperty.call(body, 'priceEur') ? decimalOrNull(body.priceEur) : undefined,
      priceUsd: Object.prototype.hasOwnProperty.call(body, 'priceUsd') ? decimalOrNull(body.priceUsd) : undefined,
      priceUah: Object.prototype.hasOwnProperty.call(body, 'priceUah') ? decimalOrNull(body.priceUah) : undefined,
      priceEurB2b: Object.prototype.hasOwnProperty.call(body, 'priceEurB2b') ? decimalOrNull(body.priceEurB2b) : undefined,
      priceUsdB2b: Object.prototype.hasOwnProperty.call(body, 'priceUsdB2b') ? decimalOrNull(body.priceUsdB2b) : undefined,
      priceUahB2b: Object.prototype.hasOwnProperty.call(body, 'priceUahB2b') ? decimalOrNull(body.priceUahB2b) : undefined,
      compareAtEur: Object.prototype.hasOwnProperty.call(body, 'compareAtEur') ? decimalOrNull(body.compareAtEur) : undefined,
      compareAtUsd: Object.prototype.hasOwnProperty.call(body, 'compareAtUsd') ? decimalOrNull(body.compareAtUsd) : undefined,
      compareAtUah: Object.prototype.hasOwnProperty.call(body, 'compareAtUah') ? decimalOrNull(body.compareAtUah) : undefined,
      compareAtEurB2b: Object.prototype.hasOwnProperty.call(body, 'compareAtEurB2b') ? decimalOrNull(body.compareAtEurB2b) : undefined,
      compareAtUsdB2b: Object.prototype.hasOwnProperty.call(body, 'compareAtUsdB2b') ? decimalOrNull(body.compareAtUsdB2b) : undefined,
      compareAtUahB2b: Object.prototype.hasOwnProperty.call(body, 'compareAtUahB2b') ? decimalOrNull(body.compareAtUahB2b) : undefined,
    };

    if (!variantIds.length) {
      return NextResponse.json({ error: 'variantIds are required' }, { status: 400 });
    }

    const hasUpdate = Object.entries(payload)
      .filter(([key]) => key !== 'variantIds')
      .some(([, value]) => value !== undefined);

    if (!hasUpdate) {
      return NextResponse.json({ error: 'No pricing changes provided' }, { status: 400 });
    }

    const result = await applyAdminPricingPatch(prisma, payload);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'pricing.patch',
      entityType: 'shop.variant',
      metadata: {
        variantIds,
        priceEur: payload.priceEur,
        priceUsd: payload.priceUsd,
        priceUah: payload.priceUah,
        priceEurB2b: payload.priceEurB2b,
        priceUsdB2b: payload.priceUsdB2b,
        priceUahB2b: payload.priceUahB2b,
        compareAtEur: payload.compareAtEur,
        compareAtUsd: payload.compareAtUsd,
        compareAtUah: payload.compareAtUah,
        compareAtEurB2b: payload.compareAtEurB2b,
        compareAtUsdB2b: payload.compareAtUsdB2b,
        compareAtUahB2b: payload.compareAtUahB2b,
        affectedCount: result.updatedCount,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin pricing patch', error);
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 });
  }
}
