import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTurn14AccessToken } from '@/lib/turn14';

async function fetchAllTurn14ItemsMap(): Promise<Record<string, string>> {
  const token = await getTurn14AccessToken();
  const map: Record<string, string> = {};

  // For safety and time limit on Vercel, we only fetch first 50 pages or until end
  // In a real cron environment, we would fetch all 740 pages.
  let page = 1;
  const maxPages = 50; 

  while (page <= maxPages) {
    const url = `https://api.turn14.com/v1/items?page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const body = await res.json();
    if (!body.data || body.data.length === 0) break;

    for (const item of body.data) {
       // Save mfr_part_number OR part_number -> Turn14 ID
       const mfrPart = item.attributes?.mfr_part_number;
       const part = item.attributes?.part_number;
       if (mfrPart) map[mfrPart.toUpperCase()] = item.id;
       if (part) map[part.toUpperCase()] = item.id;
    }

    if (page >= body.meta.total_pages) break;
    page++;
  }
  return map;
}

export async function POST(req: Request) {
  try {
    // 1. Get variants missing dimensions
    const variantsWithoutDimensions = await prisma.shopProductVariant.findMany({
      where: {
        AND: [
          { weight: null },
          { length: null }
        ]
      },
      take: 200, // Batch limit
    });

    if (variantsWithoutDimensions.length === 0) {
       return NextResponse.json({ success: true, message: 'No missing dimensions found.' });
    }

    // 2. Build Turn14 Item ID map
    const t14Map = await fetchAllTurn14ItemsMap();
    const token = await getTurn14AccessToken();

    let updatedCount = 0;

    // 3. For each variant, look up in Turn14
    for (const variant of variantsWithoutDimensions) {
      if (!variant.sku) continue;

      const baseSku = variant.sku.toUpperCase(); // e.g. "JB4-B58"
      // Known prefixes logic (Fallback)
      const possibleSkus = [
        baseSku, 
        `BMS-${baseSku}`, // Burger
        `EMN-${baseSku}`, // Eventuri
        `MIM-${baseSku}`, // Mishimoto
        `RAD-${baseSku}` // Radium
      ];

      let matchedId = null;
      for (const sku of possibleSkus) {
         if (t14Map[sku]) {
             matchedId = t14Map[sku];
             break;
         }
      }

      if (matchedId) {
         // 4. Fetch the detailed item dimensions from Turn14 API
         const detailRes = await fetch(`https://api.turn14.com/v1/items/${matchedId}`, {
            headers: { Authorization: `Bearer ${token}` }
         });
         
         if (detailRes.ok) {
           const body = await detailRes.json();
           const dims = body.data?.attributes?.dimensions;
           if (dims && Array.isArray(dims) && dims[0]) {
             const t14Length = dims[0].length;
             const t14Width = dims[0].width;
             const t14Height = dims[0].height;
             const t14Weight = dims[0].weight;
             
             // Convert to metric
             const weight = t14Weight ? (Number(t14Weight) * 0.453592) : null;
             const length = t14Length ? (Number(t14Length) * 2.54) : null;
             const width = t14Width ? (Number(t14Width) * 2.54) : null;
             const height = t14Height ? (Number(t14Height) * 2.54) : null;

             if (weight && weight > 0) {
               await prisma.shopProductVariant.update({
                 where: { id: variant.id },
                 data: { weight, length, width, height }
               });
               updatedCount++;
             }
           }
         }
      }
    }

    return NextResponse.json({ success: true, updatedCount });

  } catch (error: any) {
    console.error('Turn14 Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
