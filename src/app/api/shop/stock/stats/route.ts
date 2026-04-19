import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const stats = await prisma.stockProduct.groupBy({
    by: ['distributor'],
    _count: { id: true },
  });

  const total = await prisma.stockProduct.count();

  return NextResponse.json({
    total,
    distributors: stats.map((entry) => ({
      name: entry.distributor,
      count: entry._count.id,
    })),
  });
}

export const runtime = 'nodejs';
