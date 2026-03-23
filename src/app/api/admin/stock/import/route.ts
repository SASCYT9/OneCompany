import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

/**
 * POST /api/admin/stock/import
 * 
 * Imports CSV data for a distributor into StockProduct table.
 * Body: { distributor: string, data: Array<{ partNumber, name, brand?, category?, price?, retailPrice?, inStock?, description?, thumbnail?, metadata? }> }
 * 
 * For file-based CSV parsing, the admin UI parses the CSV client-side
 * and sends the structured array here.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { distributor, data } = body;

    if (!distributor || typeof distributor !== 'string') {
      return NextResponse.json({ error: 'distributor is required' }, { status: 400 });
    }
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'data array is required and must not be empty' }, { status: 400 });
    }

    let imported = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    const distributorUpper = distributor.toUpperCase();

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (item: any) => {
          const partNumber = String(item.partNumber || '').trim();
          if (!partNumber) throw new Error(`Row ${i}: missing partNumber`);

          const name = String(item.name || item.title || '').trim();
          if (!name) throw new Error(`Row ${i}: partNumber ${partNumber} has no name`);

          const result = await prisma.stockProduct.upsert({
            where: {
              distributor_partNumber: {
                distributor: distributorUpper,
                partNumber,
              },
            },
            create: {
              distributor: distributorUpper,
              partNumber,
              name,
              brand: String(item.brand || '').trim(),
              category: String(item.category || '').trim(),
              description: String(item.description || '').trim(),
              price: item.price != null ? Number(item.price) || null : null,
              retailPrice: item.retailPrice != null ? Number(item.retailPrice) || null : null,
              markupPct: item.markupPct != null ? Number(item.markupPct) : 25,
              inStock: item.inStock !== false && item.inStock !== 'false' && item.inStock !== '0',
              thumbnail: item.thumbnail || null,
              metadata: item.metadata || null,
            },
            update: {
              name,
              brand: String(item.brand || '').trim(),
              category: String(item.category || '').trim(),
              description: String(item.description || '').trim(),
              price: item.price != null ? Number(item.price) || null : null,
              retailPrice: item.retailPrice != null ? Number(item.retailPrice) || null : null,
              markupPct: item.markupPct != null ? Number(item.markupPct) : 25,
              inStock: item.inStock !== false && item.inStock !== 'false' && item.inStock !== '0',
              thumbnail: item.thumbnail || null,
              metadata: item.metadata || null,
            },
          });

          return result;
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          // Check if it was created or updated by checking createdAt vs updatedAt
          const prod = r.value;
          if (prod.createdAt.getTime() === prod.updatedAt.getTime()) {
            imported++;
          } else {
            updated++;
          }
        } else {
          errors++;
          errorDetails.push(r.reason?.message || 'Unknown error');
        }
      }
    }

    return NextResponse.json({
      success: true,
      distributor: distributorUpper,
      totalProcessed: data.length,
      imported,
      updated,
      errors,
      ...(errorDetails.length > 0 ? { errorDetails: errorDetails.slice(0, 10) } : {}),
    });
  } catch (error: any) {
    console.error('[Stock Import Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — stats for all distributors
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await prisma.stockProduct.groupBy({
    by: ['distributor'],
    _count: { id: true },
  });

  const total = await prisma.stockProduct.count();

  return NextResponse.json({
    total,
    distributors: stats.map(s => ({
      name: s.distributor,
      count: s._count.id,
    })),
  });
}

export const runtime = 'nodejs';

// DELETE — remove all products for a distributor
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const distributor = body.distributor?.toUpperCase();

    if (!distributor) {
      return NextResponse.json({ error: 'distributor is required' }, { status: 400 });
    }

    const result = await prisma.stockProduct.deleteMany({
      where: { distributor },
    });

    return NextResponse.json({
      success: true,
      distributor,
      deleted: result.count,
    });
  } catch (error: any) {
    console.error('[Stock Delete Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
