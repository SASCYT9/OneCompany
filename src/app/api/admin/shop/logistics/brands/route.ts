import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Get all custom configs
    const configs = await prisma.shopBrandLogistics.findMany({
      orderBy: { brandName: 'asc' }
    });

    // Discover all unique brands known in products to help the UI dropdowns
    // Exclude null/empty ones securely
    const brandRows = await prisma.shopProduct.findMany({
      select: { brand: true },
      distinct: ['brand'],
      where: { brand: { not: null, notIn: [''] } }
    });

    const knownBrands = brandRows.map(r => r.brand as string).filter(Boolean).sort();

    return NextResponse.json({
      configs,
      knownBrands
    });
  } catch (error: any) {
    console.error('[BrandLogisticsAPI]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { brandName, originZone, ratePerKg, volumetricDivisor, volSurchargePerKg, baseFee, isActive } = data;

    if (!brandName) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 });
    }

    const upserted = await prisma.shopBrandLogistics.upsert({
      where: { brandName },
      update: {
        originZone: String(originZone || 'USA'),
        ratePerKg: Number(ratePerKg || 0),
        volumetricDivisor: Number(volumetricDivisor || 5000),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        isActive: Boolean(isActive ?? true),
      },
      create: {
        brandName,
        originZone: String(originZone || 'USA'),
        ratePerKg: Number(ratePerKg || 0),
        volumetricDivisor: Number(volumetricDivisor || 5000),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        isActive: Boolean(isActive ?? true),
      }
    });

    return NextResponse.json({ success: true, config: upserted });
  } catch (error: any) {
    console.error('[BrandLogisticsAPI POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
