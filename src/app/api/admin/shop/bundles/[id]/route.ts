import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import {
  adminShopBundleInclude,
  normalizeAdminShopBundlePayload,
  serializeAdminShopBundleDetail,
} from '@/lib/shopAdminBundles';

async function validateBundlePayload(
  bundleId: string,
  data: ReturnType<typeof normalizeAdminShopBundlePayload>['data']
) {
  const product = await prisma.shopProduct.findUnique({
    where: { id: data.productId },
    select: { id: true },
  });

  if (!product) {
    return { error: 'Bundle product not found' };
  }

  const duplicate = await prisma.shopBundle.findFirst({
    where: {
      productId: data.productId,
      NOT: { id: bundleId },
    },
    select: { id: true },
  });

  if (duplicate) {
    return { error: 'Selected product already has a bundle' };
  }

  const componentProductIds = Array.from(new Set(data.items.map((item) => item.componentProductId)));
  const componentProducts = await prisma.shopProduct.findMany({
    where: { id: { in: componentProductIds } },
    select: { id: true },
  });

  if (componentProducts.length !== componentProductIds.length) {
    return { error: 'One or more bundle component products were not found' };
  }

  const variantIds = Array.from(
    new Set(
      data.items
        .map((item) => item.componentVariantId)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (variantIds.length) {
    const variants = await prisma.shopProductVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, productId: true },
    });
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const item of data.items) {
      if (!item.componentVariantId) continue;
      const variant = variantById.get(item.componentVariantId);
      if (!variant || variant.productId !== item.componentProductId) {
        return { error: 'Bundle component variant must belong to the selected component product' };
      }
    }
  }

  return { ok: true as const };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const { id } = await params;

    const bundle = await prisma.shopBundle.findUnique({
      where: { id },
      include: adminShopBundleInclude,
    });

    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    return NextResponse.json(serializeAdminShopBundleDetail(bundle));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin bundle detail', error);
    return NextResponse.json({ error: 'Failed to get bundle' }, { status: 500 });
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
    const body = await request.json();
    const { data, errors } = normalizeAdminShopBundlePayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const existing = await prisma.shopBundle.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    const validation = await validateBundlePayload(id, data);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const bundle = await prisma.shopBundle.update({
      where: { id },
      data: {
        product: {
          connect: { id: data.productId },
        },
        items: {
          deleteMany: {},
          create: data.items.map((item, index) => ({
            componentProduct: {
              connect: { id: item.componentProductId },
            },
            componentVariant: item.componentVariantId
              ? {
                  connect: { id: item.componentVariantId },
                }
              : undefined,
            quantity: item.quantity,
            position: item.position ?? index + 1,
          })),
        },
      },
      include: adminShopBundleInclude,
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'bundle.update',
      entityType: 'shop.bundle',
      entityId: bundle.id,
      metadata: {
        productId: bundle.productId,
        componentsCount: bundle.items.length,
      },
    });

    return NextResponse.json(serializeAdminShopBundleDetail(bundle));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin bundle update', error);
    return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 });
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

    const deleted = await prisma.shopBundle.delete({
      where: { id },
      select: { id: true, productId: true },
    });

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'bundle.delete',
      entityType: 'shop.bundle',
      entityId: deleted.id,
      metadata: {
        productId: deleted.productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin bundle delete', error);
    return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
