import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.shopProduct.findMany({
      where: { brand: 'Brabus' },
      take: 5,
      select: { id: true, slug: true, sku: true, titleEn: true }
    });
    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
