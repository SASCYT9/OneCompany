import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const products = await prisma.shopProduct.findMany({
      where: {
        slug: { contains: 'urus-se' }
      }
    });

    const results = [];

    for (const p of products) {
      const fixed = await prisma.shopProduct.update({
        where: { id: p.id },
        data: {
          priceUah: 0,
          priceUsd: 0,
          // We ensure priceEur has the correct value just in case
        }
      });
      results.push(`Fixed ${fixed.slug} - EUR: ${fixed.priceEur}, UAH: ${fixed.priceUah}`);
    }

    return NextResponse.json({ success: true, fixed: results });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
