import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminShopBundleInclude,
  listAdminShopBundleProductOptions,
  normalizeAdminShopBundlePayload,
  serializeAdminShopBundleListItem,
} from '@/lib/shopAdminBundles';

const prisma = new PrismaClient();

async function validateBundlePayload(
  data: ReturnType<typeof normalizeAdminShopBundlePayload>['data'],
  currentBundleId?: string
) {
  const product = await prisma.shopProduct.findUnique({
    where: { id: data.productId },
    select: { id: true, slug: true, titleEn: true },
  });

  if (!product) {
    return { error: 'Bundle product not found' };
  }

  const existingBundle = await prisma.shopBundle.findFirst({
    where: {
      productId: data.productId,
      ...(currentBundleId ? { NOT: { id: currentBundleId } } : {}),
    },
    select: { id: true },
  });

  if (existingBundle) {
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

  return { product };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    const [bundles, productOptions] = await Promise.all([
      prisma.shopBundle.findMany({
        orderBy: { updatedAt: 'desc' },
        include: adminShopBundleInclude,
      }),
      listAdminShopBundleProductOptions(prisma),
    ]);

    return NextResponse.json({
      bundles: bundles.map(serializeAdminShopBundleListItem),
      productOptions,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin bundles list', error);
    return NextResponse.json({ error: 'Failed to list bundles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const body = await request.json();
    const { data, errors } = normalizeAdminShopBundlePayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const validation = await validateBundlePayload(data);
    if ('error' in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const bundle = await prisma.shopBundle.create({
      data: {
        product: {
          connect: { id: data.productId },
        },
        items: {
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
      action: 'bundle.create',
      entityType: 'shop.bundle',
      entityId: bundle.id,
      metadata: {
        productId: bundle.productId,
        componentsCount: bundle.items.length,
      },
    });

    return NextResponse.json(serializeAdminShopBundleListItem(bundle));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin bundle create', error);
    return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
