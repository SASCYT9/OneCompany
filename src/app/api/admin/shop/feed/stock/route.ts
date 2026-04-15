import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

/**
 * Stock feed via Supabase REST API — bypasses Prisma connection pool
 * entirely to avoid 504 timeouts on Vercel Preview.
 */
export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SupaBase_SUPABASE_URL || process.env.SupaBase_SUPABASE_URL;
  const serviceKey = process.env.SupaBase_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SupaBase_SUPABASE_SECRET_KEY
    || process.env.SupaBase_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
  }

  try {
    const format = req.nextUrl.searchParams.get('format') || 'json';

    // Fetch published product variants with their parent product data via Supabase REST
    const variantsRes = await fetch(
      `${supabaseUrl}/rest/v1/ShopProductVariant?select=id,sku,title,inventoryQty,priceEur,priceUsd,product:ShopProduct!inner(titleEn,titleUa,slug,brand,isPublished)&product.isPublished=eq.true&order=sku.asc`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      }
    );

    if (!variantsRes.ok) {
      const errText = await variantsRes.text();
      console.error('[Stock Feed] Supabase error:', variantsRes.status, errText);
      return NextResponse.json({ error: 'Database query failed', details: errText }, { status: 500 });
    }

    const variants: any[] = await variantsRes.json();

    const feed = variants.map(v => ({
      sku: v.sku,
      title_ua: `${v.product?.titleUa || ''} ${v.title ? `(${v.title})` : ''}`.trim(),
      title_en: `${v.product?.titleEn || ''} ${v.title ? `(${v.title})` : ''}`.trim(),
      brand: v.product?.brand || '',
      url: `https://onecompany.global/shop/product/${v.product?.slug || ''}`,
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
