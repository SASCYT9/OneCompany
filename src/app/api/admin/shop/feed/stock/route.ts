import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 25; // Vercel function timeout

export async function GET(req: NextRequest) {
  // Create a dedicated short-lived Prisma client to avoid pool exhaustion
  const db = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });

  try {
    const format = req.nextUrl.searchParams.get('format') || 'json';

    const variants = await db.shopProductVariant.findMany({
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

    if (format === 'csv') {
      const header = ['SKU', 'Title (UA)', 'Title (EN)', 'Brand', 'Quantity', 'Price (EUR)', 'Price (USD)', 'URL'];
      const rows = feed.map(v => [
        `"${v.sku || ''}"`,
        `"${v.title_ua?.replace(/"/g, '""') || ''}"`,
        `"${v.title_en?.replace(/"/g, '""') || ''}"`,
        `"${v.brand || ''}"`,
        v.stock_quantity,
        v.price_eur,
        v.price_usd,
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

    // Default: Return as JSON
    return NextResponse.json({
      status: 'success',
      total_items: feed.length,
      timestamp: new Date().toISOString(),
      items: feed
    });

  } catch (error: any) {
    console.error('[Stock Feed Error]', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate stock feed', details: error?.message }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}
