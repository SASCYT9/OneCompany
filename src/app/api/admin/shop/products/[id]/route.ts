import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import {
  adminProductInclude,
  buildAdminProductScalarUpdateData,
  normalizeAdminProductPayload,
  serializeAdminProduct,
} from '@/lib/shopAdminCatalog';
import { prisma } from '@/lib/prisma';
import { planVariantMutations } from '@/lib/shopAdminCatalogMutations';
import { buildAdminProductArchiveMutation, parseAdminProductDeleteMode } from '@/lib/adminRouteValidation';

const VARIANT_TEMP_POSITION_OFFSET = 10_000;

function collectIncomingIds<T extends { id?: string | null }>(items: T[]) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item.id ?? '').trim())
        .filter(Boolean)
    )
  );
}

function formatVariantDeletionBlockers(
  blockers: Array<{ id: string; reasons: Array<'inventoryLevels' | 'cartItems' | 'bundleItems' | 'orderItems'> }>
) {
  return blockers.map((blocker) => ({
    id: blocker.id,
    reasons: blocker.reasons,
  }));
}

function buildVariantWriteData(
  item: ReturnType<typeof normalizeAdminProductPayload>['data']['variants'][number],
  position: number
) {
  return {
    title: item.title ?? null,
    sku: item.sku ?? null,
    position,
    option1Value: item.option1Value ?? null,
    option1LinkedTo: item.option1LinkedTo ?? null,
    option2Value: item.option2Value ?? null,
    option2LinkedTo: item.option2LinkedTo ?? null,
    option3Value: item.option3Value ?? null,
    option3LinkedTo: item.option3LinkedTo ?? null,
    grams: item.grams ?? null,
    inventoryTracker: item.inventoryTracker ?? null,
    inventoryQty: item.inventoryQty ?? 0,
    inventoryPolicy: item.inventoryPolicy ?? 'CONTINUE',
    fulfillmentService: item.fulfillmentService ?? null,
    priceEur: item.priceEur ?? null,
    priceUsd: item.priceUsd ?? null,
    priceUah: item.priceUah ?? null,
    priceEurB2b: item.priceEurB2b ?? null,
    priceUsdB2b: item.priceUsdB2b ?? null,
    priceUahB2b: item.priceUahB2b ?? null,
    compareAtEur: item.compareAtEur ?? null,
    compareAtUsd: item.compareAtUsd ?? null,
    compareAtUah: item.compareAtUah ?? null,
    compareAtEurB2b: item.compareAtEurB2b ?? null,
    compareAtUsdB2b: item.compareAtUsdB2b ?? null,
    compareAtUahB2b: item.compareAtUahB2b ?? null,
    requiresShipping: item.requiresShipping ?? true,
    taxable: item.taxable ?? true,
    barcode: item.barcode ?? null,
    image: item.image ?? null,
    weightUnit: item.weightUnit ?? null,
    weight: item.weight ?? null,
    length: item.length ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    taxCode: item.taxCode ?? null,
    costPerItem: item.costPerItem ?? null,
    isDefault: item.isDefault ?? position === 1,
    isDimensionsEstimated: item.isDimensionsEstimated ?? false,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const { id } = await params;
    const product = await prisma.shopProduct.findUnique({
      where: { id },
      include: adminProductInclude,
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(serializeAdminProduct(product));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to get product' }, { status: 500 });
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
    const { data, errors } = normalizeAdminProductPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    const currentProduct = await prisma.shopProduct.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        media: {
          select: {
            id: true,
          },
        },
        variants: {
          select: {
            id: true,
            _count: {
              select: {
                inventoryLevels: true,
                cartItems: true,
                bundleComponentItems: true,
              },
            },
          },
        },
      },
    });
    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (data.categoryId) {
      const category = await prisma.shopCategory.findUnique({
        where: { id: data.categoryId },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ error: 'Selected category not found' }, { status: 400 });
      }
    }
    if (data.slug) {
      const existing = await prisma.shopProduct.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Another product with this slug exists' }, { status: 409 });
      }
    }
    if (data.collectionIds.length) {
      const collectionCount = await prisma.shopCollection.count({
        where: {
          id: {
            in: data.collectionIds,
          },
        },
      });
      if (collectionCount !== data.collectionIds.length) {
        return NextResponse.json({ error: 'One or more selected collections were not found' }, { status: 400 });
      }
    }

    const existingVariantIds = new Set(currentProduct.variants.map((variant) => variant.id));
    const rawIncomingVariantIds = data.variants
      .map((item) => String(item.id ?? '').trim())
      .filter(Boolean);
    const incomingVariantIds = collectIncomingIds(data.variants);
    if (rawIncomingVariantIds.length !== incomingVariantIds.length) {
      return NextResponse.json({ error: 'Duplicate variant id in payload' }, { status: 400 });
    }
    const unknownVariantIds = incomingVariantIds.filter((variantId) => !existingVariantIds.has(variantId));
    if (unknownVariantIds.length) {
      return NextResponse.json({ error: 'Unknown variant id in payload' }, { status: 400 });
    }

    const existingMediaIds = new Set(currentProduct.media.map((item) => item.id));
    const rawIncomingMediaIds = data.media
      .map((item) => String(item.id ?? '').trim())
      .filter(Boolean);
    const incomingMediaIds = collectIncomingIds(data.media);
    if (rawIncomingMediaIds.length !== incomingMediaIds.length) {
      return NextResponse.json({ error: 'Duplicate media id in payload' }, { status: 400 });
    }
    const unknownMediaIds = incomingMediaIds.filter((mediaId) => !existingMediaIds.has(mediaId));
    if (unknownMediaIds.length) {
      return NextResponse.json({ error: 'Unknown media id in payload' }, { status: 400 });
    }

    const orderItemGroups = currentProduct.variants.length
      ? await prisma.shopOrderItem.groupBy({
          by: ['variantId'],
          where: {
            variantId: {
              in: currentProduct.variants.map((variant) => variant.id),
            },
          },
          _count: {
            _all: true,
          },
        })
      : [];
    const orderItemCountByVariantId = new Map(
      orderItemGroups
        .filter(
          (entry): entry is typeof entry & {
            variantId: string;
          } => Boolean(entry.variantId)
        )
        .map((entry) => [entry.variantId, entry._count._all])
    );

    const variantMutationPlan = planVariantMutations(
      currentProduct.variants.map((variant) => ({
        id: variant.id,
        inventoryLevelCount: variant._count.inventoryLevels,
        cartItemCount: variant._count.cartItems,
        bundleItemCount: variant._count.bundleComponentItems,
        orderItemCount: orderItemCountByVariantId.get(variant.id) ?? 0,
      })),
      data.variants
    );

    if (variantMutationPlan.blockers.length) {
      return NextResponse.json(
        {
          error: 'Cannot remove variants that still have related inventory or order data',
          blockers: formatVariantDeletionBlockers(variantMutationPlan.blockers),
        },
        { status: 409 }
      );
    }

    const variantUpdateIds = new Set(variantMutationPlan.updateIds);

    const product = await prisma.$transaction(async (tx) => {
      await tx.shopProduct.update({
        where: { id },
        data: buildAdminProductScalarUpdateData(data),
      });

      await tx.shopProductCollection.deleteMany({
        where: { productId: id },
      });
      if (data.collectionIds.length) {
        await tx.shopProductCollection.createMany({
          data: data.collectionIds.map((collectionId, index) => ({
            productId: id,
            collectionId,
            sortOrder: index,
          })),
        });
      }

      const mediaIdsToDelete = currentProduct.media
        .map((item) => item.id)
        .filter((mediaId) => !incomingMediaIds.includes(mediaId));
      if (mediaIdsToDelete.length) {
        await tx.shopProductMedia.deleteMany({
          where: {
            productId: id,
            id: { in: mediaIdsToDelete },
          },
        });
      }
      for (const [index, item] of data.media.entries()) {
        const mediaData = {
          src: item.src,
          altText: item.altText ?? null,
          position: index + 1,
          mediaType: item.mediaType ?? 'IMAGE',
        };
        if (item.id) {
          await tx.shopProductMedia.update({
            where: { id: item.id },
            data: mediaData,
          });
          continue;
        }

        await tx.shopProductMedia.create({
          data: {
            productId: id,
            ...mediaData,
          },
        });
      }

      await tx.shopProductOption.deleteMany({
        where: { productId: id },
      });
      if (data.options.length) {
        await tx.shopProductOption.createMany({
          data: data.options.map((item, index) => ({
            productId: id,
            name: item.name,
            position: index + 1,
            values: item.values ?? [],
          })),
        });
      }

      if (variantMutationPlan.deleteIds.length) {
        await tx.shopProductVariant.deleteMany({
          where: {
            productId: id,
            id: { in: variantMutationPlan.deleteIds },
          },
        });
      }

      const retainedVariantIds = data.variants
        .map((item) => String(item.id ?? '').trim())
        .filter((variantId) => variantUpdateIds.has(variantId));
      for (const [index, variantId] of retainedVariantIds.entries()) {
        await tx.shopProductVariant.update({
          where: { id: variantId },
          data: {
            position: VARIANT_TEMP_POSITION_OFFSET + index,
          },
        });
      }
      for (const [index, item] of data.variants.entries()) {
        const variantData = buildVariantWriteData(item, index + 1);
        const variantId = String(item.id ?? '').trim();
        if (variantId && variantUpdateIds.has(variantId)) {
          await tx.shopProductVariant.update({
            where: { id: variantId },
            data: variantData,
          });
          continue;
        }

        await tx.shopProductVariant.create({
          data: {
            productId: id,
            ...variantData,
          },
        });
      }

      await tx.shopProductMetafield.deleteMany({
        where: { productId: id },
      });
      if (data.metafields.length) {
        await tx.shopProductMetafield.createMany({
          data: data.metafields.map((item) => ({
            productId: id,
            namespace: item.namespace,
            key: item.key,
            value: item.value,
            valueType: item.valueType ?? 'single_line_text_field',
          })),
        });
      }

      const updatedProduct = await tx.shopProduct.findUnique({
        where: { id },
        include: adminProductInclude,
      });
      if (!updatedProduct) {
        throw new Error('PRODUCT_NOT_FOUND_AFTER_UPDATE');
      }

      await writeAdminAuditLog(tx, session, {
        scope: 'shop',
        action: 'product.update',
        entityType: 'shop.product',
        entityId: updatedProduct.id,
        metadata: {
          slug: updatedProduct.slug,
          status: updatedProduct.status,
          variantUpdates: variantMutationPlan.updateIds.length,
          variantCreates: variantMutationPlan.create.length,
          variantDeletes: variantMutationPlan.deleteIds.length,
        },
      });

      return updatedProduct;
    });

    return NextResponse.json(serializeAdminProduct(product));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop product update', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { id } = await params;
    const deleteMode = parseAdminProductDeleteMode(request.nextUrl.searchParams.get('mode'));

    if (deleteMode === 'hard') {
      const product = await prisma.shopProduct.findUnique({
        where: { id },
        select: { id: true, slug: true, status: true },
      });
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }
      if (product.status !== 'ARCHIVED') {
        return NextResponse.json(
          { error: 'Archive the product before requesting a hard delete.' },
          { status: 409 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const deleted = await tx.shopProduct.delete({
          where: { id },
          select: { id: true, slug: true },
        });

        await writeAdminAuditLog(tx, session, {
          scope: 'shop',
          action: 'product.delete',
          entityType: 'shop.product',
          entityId: deleted.id,
          metadata: {
            slug: deleted.slug,
            mode: 'hard',
          },
        });
      });

      return NextResponse.json({ success: true, mode: 'hard' });
    }

    const archived = await prisma.$transaction(async (tx) => {
      const updated = await tx.shopProduct.update({
        where: { id },
        data: buildAdminProductArchiveMutation(),
        select: { id: true, slug: true, status: true },
      });

      await writeAdminAuditLog(tx, session, {
        scope: 'shop',
        action: 'product.archive',
        entityType: 'shop.product',
        entityId: updated.id,
        metadata: {
          slug: updated.slug,
          status: updated.status,
          mode: 'archive',
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      mode: 'archive',
      archived: true,
      status: archived.status,
    });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
