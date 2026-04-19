import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Fetching all pages from Airtable may take some time

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const format = req.nextUrl.searchParams.get('format') || 'json';
    const skuPrefix = req.nextUrl.searchParams.get('sku_prefix');
    const brandFilter = req.nextUrl.searchParams.get('brand');

    if (!process.env.AIRTABLE_BASE_ID || !process.env.AIRTABLE_PAT) {
      return NextResponse.json({ error: 'Airtable credentials missing' }, { status: 500 });
    }

    let allRecords: any[] = [];
    let offset: string | undefined = undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/tblJk07VK1kk1AK1L`);
      if (offset) url.searchParams.append('offset', offset);
      
      // Pull specific fields to reduce payload and increase speed
      url.searchParams.append('fields[]', 'Название');
      url.searchParams.append('fields[]', 'Парт-номер производителя');
      url.searchParams.append('fields[]', 'Наш парт-номер');
      url.searchParams.append('fields[]', 'Бренд');
      url.searchParams.append('fields[]', 'Кол-во в наличии');
      url.searchParams.append('fields[]', 'РРЦ в Украине');

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_PAT}` },
        // Use cache: 'no-store' to ensure we get real-time stock
        cache: 'no-store'
      });

      if (!res.ok) throw new Error(`Airtable API error: ${res.status}`);
      const data: any = await res.json();
      
      allRecords = allRecords.concat(data.records);
      offset = data.offset;
    } while (offset);

    // Format the items
    let feed = allRecords.map((r) => ({
      airtable_id: r.id,
      title: r.fields['Название'] || '',
      sku: r.fields['Парт-номер производителя'] || '',
      our_sku: r.fields['Наш парт-номер'] || '',
      stock_quantity: parseInt(r.fields['Кол-во в наличии'] || '0', 10) || 0,
      price: r.fields['РРЦ в Украине'] || 0
    }));

    // Filter by SKU prefix (checking both "Our SKU" and "Manufacturer SKU")
    if (skuPrefix) {
      feed = feed.filter(item => 
        (item.our_sku && item.our_sku.toLowerCase().startsWith(skuPrefix.toLowerCase())) ||
        (item.sku && item.sku.toLowerCase().startsWith(skuPrefix.toLowerCase()))
      );
    }

    // Filter by Brand (if used in future)
    if (brandFilter) {
      // NOTE: brand in this Airtable schema might be a linked record array. 
      // Safe fallback: match title or sku just in case
      feed = feed.filter(item => 
        item.title.toLowerCase().includes(brandFilter.toLowerCase()) || 
        item.sku.toLowerCase().includes(brandFilter.toLowerCase()) ||
        item.our_sku.toLowerCase().includes(brandFilter.toLowerCase())
      );
    }

    if (format === 'csv') {
      const header = ['Airtable ID', 'Our SKU (Товар)', 'Manufacturer SKU', 'Title', 'Quantity', 'Price (RRP UA)'];
      const rows = feed.map(v => [
        `"${v.airtable_id}"`,
        `"${v.our_sku}"`,
        `"${v.sku}"`,
        `"${v.title.replace(/"/g, '""')}"`,
        v.stock_quantity,
        v.price,
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
      source: 'airtable',
      total_items: feed.length,
      timestamp: new Date().toISOString(),
      items: feed
    });

  } catch (error: any) {
    console.error('[Stock Feed Error]', error?.message || error);
    return NextResponse.json({ error: 'Failed to generate stock feed from Airtable', details: error?.message }, { status: 500 });
  }
}
