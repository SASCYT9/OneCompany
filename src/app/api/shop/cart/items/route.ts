import { NextRequest, NextResponse } from 'next/server';
import { getCurrentShopCustomerSession } from '@/lib/shopCustomerSession';
import { addItemToShopCart, SHOP_CART_COOKIE, serializeResolvedShopCart } from '@/lib/shopCart';
import { getOrCreateShopSettings, getShopSettingsRuntime } from '@/lib/shopAdminSettings';
import { buildShopViewerPricingContext } from '@/lib/shopPricingAudience';
import { prisma } from '@/lib/prisma';

import { importTurn14ItemToDb } from '@/lib/turn14Sync';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setCartCookie(response: NextResponse, token: string) {
  response.cookies.set(SHOP_CART_COOKIE, token, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function POST(request: NextRequest) {
  let body: { slug?: string; turn14Id?: string; quantity?: number; variantId?: string | null; currency?: string; locale?: string };
  try {
    body = (await request.json()) as any;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let finalSlug = String(body.slug ?? '').trim();

  try {
    // === LAZY HYDRATION for Turn14 B2B Items ===
    if (!finalSlug && body.turn14Id) {
      const turn14Id = String(body.turn14Id).trim();
      let t14Item = await prisma.turn14Item.findUnique({
        where: { id: turn14Id }
      });
      
      if (!t14Item) {
        // Fallback: If not synced yet, pull directly from Turn14 Live API!
        const { fetchTurn14ItemDetail } = require('@/lib/turn14');
        try {
          const liveData = await fetchTurn14ItemDetail(turn14Id);
          if (liveData?.data) {
            const itemData = liveData.data;
            const attrs = itemData.attributes || {};
            // Upsert into local cache just in time
            t14Item = await prisma.turn14Item.upsert({
              where: { id: turn14Id },
              update: {},
              create: {
                id: turn14Id,
                partNumber: attrs.part_number || attrs.mfr_part_number || '',
                brand: attrs.brand || 'Unknown',
                name: attrs.product_name || attrs.item_name || attrs.name || 'Auto Part',
                price: parseFloat(attrs.retail_price || attrs.list_price || attrs.price || '0') || 0,
                inStock: true,
                thumbnail: attrs.thumbnail || attrs.primary_image || null,
                attributes: attrs,
              }
            });
          }
        } catch(e) {
          console.error('[Cart Live Hydration Error]', e);
        }
        
        if (!t14Item) {
          return NextResponse.json({ error: 'Turn14 item not found locally or live API failed. Please wait for catalog sync.' }, { status: 404 });
        }
      }

      // Convert the cached generic Turn14 JSON into an explicit native ShopProduct
      const fakeAttributes = typeof t14Item.attributes === 'object' && t14Item.attributes !== null 
        ? t14Item.attributes as any 
        : {};
      
      const fakeApiPayload = { 
        id: t14Item.id, 
        attributes: { 
          ...fakeAttributes,
          product_name: t14Item.name,
          part_number: t14Item.partNumber,
          brand_name: t14Item.brand,
          part_description: fakeAttributes?.part_description || fakeAttributes?.description || t14Item.name,
          thumbnail: t14Item.thumbnail,
          price: t14Item.price
        } 
      };
      const syncRes = await importTurn14ItemToDb(prisma, fakeApiPayload, {
        brandOverride: t14Item.brand,
        fetchPricing: true // Real-time secure refresh
      });

      finalSlug = syncRes.slug;
    }

    if (!finalSlug) {
      return NextResponse.json({ error: 'slug or turn14Id is required to add an item to the cart' }, { status: 400 });
    }

    const [session, settingsRecord] = await Promise.all([
      getCurrentShopCustomerSession(),
      getOrCreateShopSettings(prisma),
    ]);
    const settings = getShopSettingsRuntime(settingsRecord);
    const context = buildShopViewerPricingContext(
      settings,
      session?.group ?? null,
      Boolean(session),
      session?.b2bDiscountPercent ?? null
    );
    const { cart, token } = await addItemToShopCart(prisma, {
      cartToken: request.cookies.get(SHOP_CART_COOKIE)?.value,
      customerId: session?.customerId ?? null,
      currency: body.currency ?? settings.defaultCurrency,
      locale: body.locale ?? session?.preferredLocale ?? 'en',
      item: {
        slug: finalSlug,  // Use the newly hydrated or explicit slug
        quantity: Number(body.quantity ?? 1),
        variantId: body.variantId ? String(body.variantId) : null,
      },
    });

    const payload = await serializeResolvedShopCart(cart, context);
    const response = NextResponse.json(payload);
    setCartCookie(response, token);
    return response;
  } catch (error) {
    console.error('Shop cart item add', error);
    return NextResponse.json({ error: 'Failed to add cart item' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
