import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const p = await prisma.shopProduct.findUnique({
    where: { slug: 'brabus-f14-257-pe' },
    include: { variants: true }
  });
  return NextResponse.json(p);
}
