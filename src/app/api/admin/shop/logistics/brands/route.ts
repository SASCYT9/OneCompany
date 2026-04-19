import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);

  try {
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId');

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;

    // Get all custom configs
    const configs = await prisma.shopBrandLogistics.findMany({
      where,
      orderBy: { brandName: 'asc' },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });

    // Discover all unique brands known in products to help the UI dropdowns
    const brandRows = await prisma.shopProduct.findMany({
      select: { brand: true },
      distinct: ['brand'],
      where: { brand: { not: null, notIn: [''] } },
    });

    const knownBrands = brandRows.map(r => r.brand as string).filter(Boolean).sort();

    // Get all warehouses for dropdown
    const warehouses = await prisma.shopWarehouse.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, nameUa: true },
    });

    return NextResponse.json({
      configs,
      knownBrands,
      warehouses,
    });
  } catch (error: any) {
    console.error('[BrandLogisticsAPI]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);

  try {
    const data = await req.json();
    const { brandName, originZone, ratePerKg, volumetricDivisor, volSurchargePerKg, baseFee, isActive, warehouseId } = data;

    if (!brandName) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const wId = warehouseId || null;

    const upserted = await prisma.shopBrandLogistics.upsert({
      where: { brandName },
      update: {
        originZone: String(originZone || 'USA'),
        ratePerKg: Number(ratePerKg || 0),
        volumetricDivisor: Number(volumetricDivisor || 5000),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        isActive: Boolean(isActive ?? true),
        warehouseId: wId,
      },
      create: {
        brandName,
        originZone: String(originZone || 'USA'),
        ratePerKg: Number(ratePerKg || 0),
        volumetricDivisor: Number(volumetricDivisor || 5000),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        isActive: Boolean(isActive ?? true),
        warehouseId: wId,
      },
    });

    return NextResponse.json({ success: true, config: upserted });
  } catch (error: any) {
    console.error('[BrandLogisticsAPI POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
