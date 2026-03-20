import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { prisma } from '@/lib/prisma';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { getShopProductBySlugServer } from '@/lib/shopCatalogServer';
import { serializePublicShopProduct } from '@/lib/shopPublicProducts';
import { normalizeShopStoreKey } from '@/lib/shopStores';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const storeKey = normalizeShopStoreKey(request.nextUrl.searchParams.get('store'));
    const [settingsRecord, session, product] = await Promise.all([
      getOrCreateShopSettings(prisma),
      getCurrentShopCustomerSession(),
      getShopProductBySlugServer(slug, storeKey),
    ]);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const settings = getShopSettingsRuntime(settingsRecord);
    const pricingContext = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    );

    return NextResponse.json(serializePublicShopProduct(product, pricingContext));
  } catch (error) {
    console.error('Shop product detail', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
