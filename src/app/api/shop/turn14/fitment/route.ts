import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const make = searchParams.get('make');
    const model = searchParams.get('model');

    // Level 0: Return years
    if (!year) {
      // Get distinct years from fitments
      const fitments = await prisma.turn14Fitment.findMany({
        distinct: ['year'],
        select: { year: true },
        orderBy: { year: 'desc' }
      });
      // Fallback if db is empty (during initial setup)
      let years = fitments.map(f => f.year);
      if (years.length === 0) {
        const currentYear = new Date().getFullYear() + 1;
        years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => (currentYear - i).toString());
      }
      return NextResponse.json({ type: 'years', data: years });
    }

    // Level 1: Year → Makes
    if (year && !make) {
      const fitments = await prisma.turn14Fitment.findMany({
        where: { year },
        distinct: ['make'],
        select: { make: true },
        orderBy: { make: 'asc' }
      });
      const makes = fitments.map(f => f.make);
      return NextResponse.json({ type: 'makes', year, data: makes });
    }

    // Level 2: Year + Make → Models
    if (year && make && !model) {
      const fitments = await prisma.turn14Fitment.findMany({
        where: { year, make },
        distinct: ['model'],
        select: { model: true },
        orderBy: { model: 'asc' }
      });
      const models = fitments.map(f => f.model);
      return NextResponse.json({ type: 'models', year, make, data: models });
    }

    // Level 3: Year + Make + Model → Submodels / Engines
    if (year && make && model) {
      const fitments = await prisma.turn14Fitment.findMany({
        where: { year, make, model, submodel: { not: null } },
        distinct: ['submodel'],
        select: { submodel: true },
        orderBy: { submodel: 'asc' }
      });
      const engines = fitments.map(f => f.submodel as string).filter(Boolean);
      return NextResponse.json({ type: 'submodels', year, make, model, data: engines });
    }

    return NextResponse.json({ data: [] });
  } catch (error: any) {
    console.error('[Fitment API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
