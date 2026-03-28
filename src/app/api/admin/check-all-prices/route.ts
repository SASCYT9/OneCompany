import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const products = await prisma.shopProduct.findMany({
      select: { slug: true, priceEur: true, priceUsd: true, priceUah: true, scope: true, brand: true }
    });

    let brokenCount = 0;
    const brokenExamples = [];

    for (const p of products) {
      if (p.priceEur && Number(p.priceEur) > 0 && Number(p.priceUah) === Number(p.priceEur)) {
        brokenCount++;
        if (brokenExamples.length < 5) brokenExamples.push(p);
      }
      if (p.priceUsd && Number(p.priceUsd) > 0 && Number(p.priceUah) === Number(p.priceUsd)) {
        brokenCount++;
        if (brokenExamples.length < 5) brokenExamples.push(p);
      }
    }

    return NextResponse.json({
      totalChecked: products.length,
      criticalErrorsFound: brokenCount,
      examples: brokenExamples
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
