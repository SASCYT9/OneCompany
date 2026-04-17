import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rules = await prisma.shopTaxRegionRule.findMany({
      orderBy: [{ sortOrder: 'asc' }, { regionCode: 'asc' }],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('[TaxRegionAPI GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const {
      regionCode, regionName, regionNameUa, taxType, taxRate,
      taxLabel, taxLabelUa, customsDutyPct, isInclusive, isActive, notes, sortOrder,
    } = data;

    if (!regionCode || !regionName) {
      return NextResponse.json({ error: 'Region code and name are required' }, { status: 400 });
    }

    const upserted = await prisma.shopTaxRegionRule.upsert({
      where: { regionCode: String(regionCode).toUpperCase() },
      update: {
        regionName: String(regionName),
        regionNameUa: String(regionNameUa || regionName),
        taxType: String(taxType || 'VAT'),
        taxRate: Number(taxRate || 0),
        taxLabel: taxLabel ? String(taxLabel) : null,
        taxLabelUa: taxLabelUa ? String(taxLabelUa) : null,
        customsDutyPct: Number(customsDutyPct || 0),
        isInclusive: Boolean(isInclusive ?? false),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        notes: notes ? String(notes) : null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
      create: {
        regionCode: String(regionCode).toUpperCase(),
        regionName: String(regionName),
        regionNameUa: String(regionNameUa || regionName),
        taxType: String(taxType || 'VAT'),
        taxRate: Number(taxRate || 0),
        taxLabel: taxLabel ? String(taxLabel) : null,
        taxLabelUa: taxLabelUa ? String(taxLabelUa) : null,
        customsDutyPct: Number(customsDutyPct || 0),
        isInclusive: Boolean(isInclusive ?? false),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        notes: notes ? String(notes) : null,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json({ success: true, rule: upserted });
  } catch (error: any) {
    console.error('[TaxRegionAPI POST]', error);
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

    await prisma.shopTaxRegionRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TaxRegionAPI DELETE]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
