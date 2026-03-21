import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getShopProductsServer } from '@/lib/shopCatalogServer';
import { serializePublicShopProduct } from '@/lib/shopPublicProducts';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const [settingsRecord, session, products] = await Promise.all([
      getOrCreateShopSettings(prisma),
      getCurrentShopCustomerSession(),
      getShopProductsServer(),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const pricingContext = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    );

    const scope = request.nextUrl.searchParams.get('scope');
    const collectionHandle = request.nextUrl.searchParams.get('collection');
    const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';

    const filtered = products.filter((product) => {
      if (scope && product.scope !== scope) {
        return false;
      }
      if (
        collectionHandle &&
        !(product.collections ?? []).some((collection) => collection.handle === collectionHandle)
      ) {
        return false;
      }
      if (query) {
        const haystack = [
          product.slug,
          product.brand,
          product.vendor,
          product.title.en,
          product.title.ua,
          product.category.en,
          product.category.ua,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });

    return NextResponse.json(filtered.map((product) => serializePublicShopProduct(product, pricingContext)));
  } catch (error) {
    console.error('Shop products list', error);
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
