import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ShopInventoryPolicy } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminVariantSummarySelect,
  applyAdminInventoryPatch,
  serializeAdminVariantSummary,
} from '@/lib/shopAdminVariants';
import { prisma } from '@/lib/prisma';

function numberOrNull(value: unknown): number | null {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullableString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_INVENTORY_READ);

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
    console.error('Admin inventory list', error);
    return NextResponse.json({ error: 'Failed to list inventory' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_INVENTORY_WRITE);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const variantIds = Array.isArray(body.variantIds)
      ? body.variantIds.map((entry) => String(entry))
      : [];
    const inventoryQty = numberOrNull(body.inventoryQty);
    const inventoryAdjustment = numberOrNull(body.inventoryAdjustment);
    const inventoryPolicyRaw = body.inventoryPolicy == null ? undefined : String(body.inventoryPolicy).toUpperCase();
    const inventoryPolicy =
      inventoryPolicyRaw === 'DENY' || inventoryPolicyRaw === 'CONTINUE'
        ? (inventoryPolicyRaw as ShopInventoryPolicy)
        : undefined;
    const inventoryTracker = Object.prototype.hasOwnProperty.call(body, 'inventoryTracker')
      ? nullableString(body.inventoryTracker)
      : undefined;
    const fulfillmentService = Object.prototype.hasOwnProperty.call(body, 'fulfillmentService')
      ? nullableString(body.fulfillmentService)
      : undefined;

    if (!variantIds.length) {
      return NextResponse.json({ error: 'variantIds are required' }, { status: 400 });
    }
    if (inventoryQty != null && inventoryAdjustment != null) {
      return NextResponse.json({ error: 'Use either inventoryQty or inventoryAdjustment, not both' }, { status: 400 });
    }

    const hasUpdate =
      inventoryQty != null ||
      inventoryAdjustment != null ||
      inventoryPolicy !== undefined ||
      inventoryTracker !== undefined ||
      fulfillmentService !== undefined;

    if (!hasUpdate) {
      return NextResponse.json({ error: 'No inventory changes provided' }, { status: 400 });
    }

    const result = await applyAdminInventoryPatch(prisma, {
      variantIds,
      inventoryQty,
      inventoryAdjustment,
      inventoryPolicy,
      inventoryTracker,
      fulfillmentService,
    });
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'inventory.patch',
      entityType: 'shop.variant',
      metadata: {
        variantIds,
        inventoryQty,
        inventoryAdjustment,
        inventoryPolicy,
        inventoryTracker,
        fulfillmentService,
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
    console.error('Admin inventory patch', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
