/**
 * Diagnostic: search the local Turn14Item cache for a specific SKU.
 *
 * GET /api/admin/shop/turn14/lookup-sku?sku=A1-163
 *
 * Tries:
 *   - exact partNumber match (uppercased)
 *   - case-insensitive contains across the whole catalog
 *   - attributes JSONB scan for items where mfr_part_number matches
 *
 * Helps answer "is the shop's SKU in Turn14 at all, and under which brand"
 * when the per-brand sync surfaces zero matches.
 *
 * Read-only.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const url = new URL(req.url);
  const sku = (url.searchParams.get('sku') || '').trim();
  if (!sku) {
    return NextResponse.json({ success: false, error: 'sku query param required' }, { status: 400 });
  }
  const skuUpper = sku.toUpperCase();

  // 1. Exact partNumber.
  const exactByPartNumber = await prisma.turn14Item.findMany({
    where: { partNumber: skuUpper },
    select: { id: true, partNumber: true, brand: true, brandId: true, name: true },
    take: 5,
  });

  // 2. case-insensitive contains.
  const contains = await prisma.turn14Item.findMany({
    where: { partNumber: { contains: sku, mode: 'insensitive' } },
    select: { id: true, partNumber: true, brand: true, brandId: true, name: true },
    take: 20,
  });

  // 3. Search the JSONB attributes.mfr_part_number field via raw SQL.
  let attrsHits: Array<{
    id: string;
    partNumber: string;
    brand: string;
    brandId: string | null;
    mfrPartNumber: string | null;
  }> = [];
  try {
    attrsHits = await prisma.$queryRaw<typeof attrsHits>`
      SELECT
        id,
        "partNumber",
        brand,
        "brandId",
        attributes->>'mfr_part_number' AS "mfrPartNumber"
      FROM "Turn14Item"
      WHERE
        UPPER(attributes->>'mfr_part_number') = ${skuUpper}
        OR UPPER(attributes->>'part_number') = ${skuUpper}
      LIMIT 20
    `;
  } catch (err) {
    attrsHits = [{ id: 'error', partNumber: (err as Error).message.slice(0, 200), brand: '', brandId: null, mfrPartNumber: null }];
  }

  return NextResponse.json({
    sku,
    skuUpper,
    exactByPartNumberCount: exactByPartNumber.length,
    exactByPartNumber,
    containsCount: contains.length,
    contains: contains.slice(0, 10),
    attrsHitsCount: attrsHits.length,
    attrsHits: attrsHits.slice(0, 10),
  });
}
