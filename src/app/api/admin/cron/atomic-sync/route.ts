import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

export const maxDuration = 300; // 5 minutes max duration for Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Optionally secure the cron endpoint. Vercel automatically passes a bearer token if configured.
    // Ensure cron runs securely
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Fetching Atomic Feed...');
    const feedUrl = 'https://feed.atomic-shop.ua/feed_tts.csv';
    const response = await fetch(feedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch atomic feed: ${response.statusText}`);
    }

    const csvText = await response.text();
    
    console.log('Parsing CSV...');
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];
    console.log(`Parsed ${rows.length} rows.`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let createdCount = 0;

    function generateSlug(brand: string, sku: string): string {
      return `${brand.toLowerCase()}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
    }

    // To prevent hitting pool limits, process in chunks or sequentially
    for (const row of rows) {
      if (!row.mpn || !row.brand) continue;

      const mpn = String(row.mpn).trim();
      const brand = String(row.brand).trim();
      const stockVal = parseInt(row.stock || '0', 10);
      const title = row.title || `${brand} ${mpn}`;
      const description = row.description || null;
      const categoryName = row.category || null;
      const imgLink = row.img_link || null;
      
      // Parse price if it exists (assuming it might be named 'price' or 'price_uah')
      const rawPrice = row.price_uah || row.price || row.rrp;
      const priceUah = rawPrice ? parseFloat(rawPrice) : undefined;

      // Find variant by SKU/MPN
      const variants = await prisma.shopProductVariant.findMany({
        where: {
          sku: mpn,
          product: {
            brand: {
              equals: brand,
              mode: 'insensitive',
            }
          }
        },
      });

      if (variants.length > 0) {
        // Update inventory quantity and prices on all matched variants
        for (const variant of variants) {
          await prisma.shopProductVariant.update({
            where: { id: variant.id },
            data: { 
              inventoryQty: isNaN(stockVal) ? 0 : stockVal,
              ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah })
            },
          });

          // Also optionally update product status string to 'inStock' / 'outOfStock' and priceUah
          await prisma.shopProduct.update({
            where: { id: variant.productId },
            data: { 
              stock: stockVal > 0 ? 'inStock' : 'outOfStock',
              ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah })
            }
          });
        }
        updatedCount++;
      } else {
        // Product not found, create new one
        const slug = generateSlug(brand, mpn);
        
        // Ensure slug uniqueness (basic check)
        const existingSlug = await prisma.shopProduct.findUnique({ where: { slug } });
        const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

        await prisma.shopProduct.create({
          data: {
            slug: finalSlug,
            sku: mpn,
            brand,
            scope: 'auto',
            isPublished: true,
            status: 'ACTIVE',
            stock: stockVal > 0 ? 'inStock' : 'outOfStock',
            titleUa: title,
            titleEn: title,
            seoTitleUa: title,
            seoTitleEn: title,
            bodyHtmlUa: description,
            bodyHtmlEn: null,
            longDescUa: description,
            longDescEn: null,
            seoDescriptionUa: description ? String(description).replace(/<[^>]+>/g, '').slice(0, 300) : null,
            seoDescriptionEn: null,
            categoryUa: categoryName,
            categoryEn: categoryName,
            productCategory: categoryName,
            image: imgLink,
            ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
            variants: {
              create: [{
                title: title,
                sku: mpn,
                position: 1,
                inventoryQty: isNaN(stockVal) ? 0 : stockVal,
                requiresShipping: true,
                image: imgLink,
                isDefault: true,
                ...(priceUah !== undefined && !isNaN(priceUah) && { priceUah }),
              }]
            },
            media: imgLink ? {
              create: [{
                src: imgLink,
                altText: title,
                position: 1,
                mediaType: 'IMAGE'
              }]
            } : undefined
          }
        });
        createdCount++;
      }
    }

    // Log the sync event
    await prisma.adminAuditLog.create({
      data: {
        actorEmail: 'cron@system.local',
        actorName: 'Atomic Feed Cron',
        action: 'SYNC',
        scope: 'INVENTORY',
        entityType: 'ShopProductVariant',
        metadata: { updatedCount, createdCount, total: rows.length },
      }
    });

    console.log(`Sync complete. Updated: ${updatedCount}. Created: ${createdCount}.`);
    
    return NextResponse.json({
      success: true,
      updatedCount,
      createdCount,
      total: rows.length
    });

  } catch (error: any) {
    console.error('Atomic Feed Sync Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
