import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

export async function GET(req: NextRequest) {
  try {
    const format = req.nextUrl.searchParams.get('format') || 'json';
    const brandParam = req.nextUrl.searchParams.get('brand');
    const skuPrefixParam = req.nextUrl.searchParams.get('sku_prefix');
    const limitParam = req.nextUrl.searchParams.get('limit');
    const pageParam = req.nextUrl.searchParams.get('page');

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const skip = limit ? (page - 1) * limit : undefined;

    const whereClause: any = {
      product: {
        isPublished: true,
      },
      ...(skuPrefixParam && {
        sku: {
          startsWith: skuPrefixParam,
          mode: 'insensitive'
        }
      })
    };

    if (brandParam) {
      whereClause.product.brand = {
        equals: brandParam,
        mode: 'insensitive' // Optional, lets you search "burger motorsports" or "Burger Motorsports"
      };
    }

    const variants = await prisma.shopProductVariant.findMany({
      where: whereClause,
      take: limit,
      skip: skip,
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

    if (format === 'csv') {
      const header = ['SKU', 'Title (UA)', 'Title (EN)', 'Brand', 'Quantity', 'Price (EUR)', 'Price (USD)', 'URL'];
      const rows = feed.map(v => [
        `"${v.sku || ''}"`,
        `"${(v.title_ua || '').replace(/"/g, '""')}"`,
        `"${(v.title_en || '').replace(/"/g, '""')}"`,
        `"${v.brand || ''}"`,
        v.stock_quantity ?? 0,
        v.price_eur ?? 0,
        v.price_usd ?? 0,
        `"${v.url}"`
      ]);
      const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="stock_feed.csv"',
        }
      });
    }

    return NextResponse.json({
      status: 'success',
      total_items: feed.length,
      timestamp: new Date().toISOString(),
      items: feed
    });

  } catch (error: any) {
    console.error('[Stock Feed Error]', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate stock feed', details: error?.message }, { status: 500 });
  }
}
