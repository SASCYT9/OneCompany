/**
 * Diagnostic: how big is the Turn14 catalog cache right now?
 * Returns row counts, sample dimensions presence, and per-brand totals.
 * Read-only.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const [totalCount, brandMarkupCount, perBrand, sampleRows] = await Promise.all([
    prisma.turn14Item.count(),
    prisma.turn14BrandMarkup.count(),
    prisma.turn14Item.groupBy({
      by: ['brand', 'brandId'],
      _count: { _all: true },
      orderBy: { _count: { brand: 'desc' } },
      take: 50,
    }),
    prisma.turn14Item.findMany({
      select: { id: true, partNumber: true, brand: true, brandId: true, attributes: true },
      take: 3,
    }),
  ]);

  // Approximate row size by JSON-serializing the sample rows.
  const sampleSerializedSize = sampleRows
    .map((r) => Buffer.byteLength(JSON.stringify(r), 'utf8'))
    .reduce((a, b) => a + b, 0);
  const avgRowBytes = sampleRows.length > 0 ? Math.round(sampleSerializedSize / sampleRows.length) : 0;
  const projectedTotalBytes = avgRowBytes * totalCount;

  // Try to read the Postgres-reported table size (pg_total_relation_size includes indexes + toast).
  let tableSizeBytes: number | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ pg_total_relation_size: bigint }>>(
      `SELECT pg_total_relation_size('"Turn14Item"') AS pg_total_relation_size`,
    );
    if (rows[0]?.pg_total_relation_size != null) {
      tableSizeBytes = Number(rows[0].pg_total_relation_size);
    }
  } catch {
    // ignore — table may not exist or different naming
  }

  // Also count how many ShopProduct brands actually have shop products (via groupBy)
  const shopProductBrands = await prisma.shopProduct.groupBy({
    by: ['brand'],
    _count: { _all: true },
    where: { brand: { not: null } },
  });

  return NextResponse.json({
    turn14Item: {
      totalCount,
      avgRowBytes,
      projectedTotalBytes,
      projectedTotalMB: projectedTotalBytes / (1024 * 1024),
      pgTableSizeBytes: tableSizeBytes,
      pgTableSizeMB: tableSizeBytes !== null ? tableSizeBytes / (1024 * 1024) : null,
    },
    turn14BrandMarkup: { count: brandMarkupCount },
    turn14Item_perBrand: perBrand.map((b) => ({
      brand: b.brand,
      brandId: b.brandId,
      count: b._count._all,
    })),
    shopProduct_brandsCount: shopProductBrands.length,
    shopProduct_topBrands: shopProductBrands
      .filter((b) => b.brand)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 30)
      .map((b) => ({ brand: b.brand, products: b._count._all })),
    sampleRow: sampleRows[0]
      ? { id: sampleRows[0].id, partNumber: sampleRows[0].partNumber, brand: sampleRows[0].brand, brandId: sampleRows[0].brandId, attributesKeys: Object.keys((sampleRows[0].attributes as any) ?? {}).slice(0, 20) }
      : null,
  });
}
