import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const warehouses = await prisma.shopWarehouse.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { zones: true, brands: true } },
      },
    });

    return NextResponse.json({ warehouses });
  } catch (error: any) {
    console.error('[WarehouseAPI GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { id, code, name, nameUa, country, city, isActive, sortOrder } = data;

    if (!code || !name) {
      return NextResponse.json({ error: 'Code and name are required' }, { status: 400 });
    }

    const upserted = await prisma.shopWarehouse.upsert({
      where: { code: String(code) },
      update: {
        name: String(name),
        nameUa: String(nameUa || name),
        country: String(country || ''),
        city: city ? String(city) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
      create: {
        code: String(code),
        name: String(name),
        nameUa: String(nameUa || name),
        country: String(country || ''),
        city: city ? String(city) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, warehouse: upserted });
  } catch (error: any) {
    console.error('[WarehouseAPI POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    // Soft delete — set isActive to false
    await prisma.shopWarehouse.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WarehouseAPI DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
