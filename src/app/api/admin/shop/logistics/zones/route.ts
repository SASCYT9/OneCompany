import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId');

    const where: any = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const zones = await prisma.shopShippingZone.findMany({
      where,
      orderBy: { zoneCode: 'asc' },
      include: { warehouse: { select: { code: true, name: true } } },
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
    const { id, zoneCode, label, labelUa, ratePerKg, volSurchargePerKg, baseFee, warehouseId, etaMinDays, etaMaxDays } = data;

    if (!zoneCode) {
      return NextResponse.json({ error: 'Zone code is required' }, { status: 400 });
    }

    // Use compound unique: warehouseId + zoneCode
    const wId = warehouseId || null;
    const etaFields = {
      etaMinDays: etaMinDays !== undefined ? Number(etaMinDays) : 7,
      etaMaxDays: etaMaxDays !== undefined ? Number(etaMaxDays) : 14,
    };

    if (id) {
      // Update existing zone by ID
      const updated = await prisma.shopShippingZone.update({
        where: { id },
        data: {
          zoneCode: String(zoneCode),
          label: String(label || zoneCode),
          labelUa: String(labelUa || label || zoneCode),
          ratePerKg: Number(ratePerKg || 0),
          volSurchargePerKg: Number(volSurchargePerKg || 0),
          baseFee: Number(baseFee || 0),
          warehouseId: wId,
          ...etaFields,
        },
      });
      return NextResponse.json({ success: true, zone: updated });
    }

    // Upsert by compound unique
    const upserted = await prisma.shopShippingZone.upsert({
      where: {
        warehouseId_zoneCode: { warehouseId: wId, zoneCode: String(zoneCode) },
      },
      update: {
        label: String(label || zoneCode),
        labelUa: String(labelUa || label || zoneCode),
        ratePerKg: Number(ratePerKg || 0),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        ...etaFields,
      },
      create: {
        zoneCode: String(zoneCode),
        label: String(label || zoneCode),
        labelUa: String(labelUa || label || zoneCode),
        ratePerKg: Number(ratePerKg || 0),
        volSurchargePerKg: Number(volSurchargePerKg || 0),
        baseFee: Number(baseFee || 0),
        warehouseId: wId,
        ...etaFields,
      },
    });

    return NextResponse.json({ success: true, zone: upserted });
  } catch (error: any) {
    console.error('[ShippingZonesAPI POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Zone ID is required' }, { status: 400 });

    await prisma.shopShippingZone.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ShippingZonesAPI DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
