import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Assuming standard prisma export

export async function GET() {
  try {
    const variants = await prisma.shopProductVariant.findMany({
      where: {
        product: {
          isPublished: true,
        },
      },
      select: {
        id: true,
        sku: true,
        title: true,
        inventoryQty: true,
        priceEur: true,
        priceUsd: true,
        product: {
          select: {
            titleEn: true,
            titleUa: true,
            slug: true,
            brand: true,
          }
        }
      },
      orderBy: {
        sku: 'asc'
      }
    });

    const feed = variants.map(v => ({
      sku: v.sku,
      title_ua: `${v.product?.titleUa} ${v.title ? `(${v.title})` : ''}`.trim(),
      title_en: `${v.product?.titleEn} ${v.title ? `(${v.title})` : ''}`.trim(),
      brand: v.product?.brand || '',
      url: `https://onecompany.global/shop/product/${v.product?.slug}`,
      stock_quantity: v.inventoryQty,
      price_eur: v.priceEur,
      price_usd: v.priceUsd,
    }));

    // Return as JSON for easy integration
    return NextResponse.json({
      status: 'success',
      total_items: feed.length,
      timestamp: new Date().toISOString(),
      items: feed
    });

  } catch (error) {
    console.error('[Stock Feed Error]', error);
    return NextResponse.json({ error: 'Failed to generate stock feed' }, { status: 500 });
  }
}
