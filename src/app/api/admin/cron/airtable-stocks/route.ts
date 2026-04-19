import { NextResponse } from 'next/server';
import { fetchAirtableProductsWithStocks } from '@/lib/airtable';
import { prisma } from '@/lib/prisma';
import { matchesBearerSecret, resolveSecret } from '@/lib/requestSecrets';

export async function GET(req: Request) {
  const cronSecret = resolveSecret('CRON_SECRET');

  if (!matchesBearerSecret(req.headers, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Airtable Sync] Starting hourly stock sync...');
    const airtableProducts = await fetchAirtableProductsWithStocks();
    console.log(`[Airtable Sync] Fetched ${airtableProducts.length} items from Airtable`);

    let updatedCount = 0;

    // Use a transaction + chunking for large datasets, or simple loops if mapping perfectly
    // Since we need to update based on SKU
    for (const item of airtableProducts) {
      if (!item.sku) continue;

      // Update the variant inventory where sku matches
      // Prisma does not return count on updateMany exactly the same way without executing, so just execute
      const res = await prisma.shopProductVariant.updateMany({
        where: { sku: item.sku },
        data: { inventoryQty: item.quantity }
      });

      if (res.count > 0) {
        updatedCount += res.count;
      }
    }

    console.log(`[Airtable Sync] Successfully updated ${updatedCount} variants from Airtable`);

    return NextResponse.json({
      success: true,
      scanned: airtableProducts.length,
      updated: updatedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Airtable Sync] Error syncing stocks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
