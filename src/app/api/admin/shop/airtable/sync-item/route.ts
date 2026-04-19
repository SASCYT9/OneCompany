import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);

    const body = await req.json();
    const { title, sku, price, brand, source } = body;

    const baseId = process.env.AIRTABLE_BASE_ID;
    const pat = process.env.AIRTABLE_PAT;
    const tableName = process.env.AIRTABLE_TABLE_NAME || 'Products';

    if (!baseId || !pat) {
      return NextResponse.json({ error: 'Airtable credentials not configured' }, { status: 500 });
    }

    // Structure expected by Airtable
    const airtableData = {
      records: [
        {
          fields: {
            "SKU": sku || '',
            "Title": title || 'No Title',
            "Price": parseFloat(price) || 0,
            "Brand": brand || '',
            "Source": source || 'Unknown'
          }
        }
      ],
      typecast: true // Forces Airtable to accept strings into drop-downs, numbers, etc.
    };

    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(airtableData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Airtable] API Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to push to Airtable', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, record: data.records[0] });

  } catch (error: any) {
    console.error('[Airtable] Exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
