import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const zones = await prisma.shopShippingZone.findMany({
      orderBy: { zoneCode: 'asc' }
    });

    return NextResponse.json({ zones });
  } catch (error: any) {
    console.error('[ShippingZonesAPI]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { id, zoneCode, label, labelUa, ratePerKg, volSurchargePerKg, baseFee } = data;

    if (!zoneCode) {
      return NextResponse.json({ error: 'Zone code is required' }, { status: 400 });
    }

    const upserted = await prisma.shopShippingZone.upsert({
      where: { zoneCode },
      update: {
        label: String(label || zoneCode),
        labelUa: String(labelUa || label || zoneCode),
        ratePerKg: Number(ratePerKg || 0),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
      },
      create: {
        zoneCode,
        label: String(label || zoneCode),
        labelUa: String(labelUa || label || zoneCode),
        ratePerKg: Number(ratePerKg || 0),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
      }
    });

    return NextResponse.json({ success: true, zone: upserted });
  } catch (error: any) {
    console.error('[ShippingZonesAPI POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
