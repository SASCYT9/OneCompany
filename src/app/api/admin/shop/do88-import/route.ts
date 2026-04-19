// DO88 Bulk Import Route - v1
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  normalizeAdminProductPayload,
} from '@/lib/shopAdminCatalog';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * Temporary bulk import endpoint for DO88 products.
 * Accepts a batch of products and upserts them into the database.
 * 
 * POST /api/admin/shop/do88-import
 * Body: { products: ProductPayload[] }
 * 
 * DELETE after import is complete.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const body = await request.json();
    const products = body.products;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { slug: string; error: string }[],
    };

    for (const productInput of products) {
      try {
        const { data, errors } = normalizeAdminProductPayload(productInput);
        if (errors.length) {
          results.errors.push({ slug: productInput.slug || 'unknown', error: errors.join(', ') });
          continue;
        }

        const existing = await prisma.shopProduct.findUnique({ where: { slug: data.slug } });

        if (existing) {
          await prisma.shopProduct.update({
            where: { slug: data.slug },
            data: buildAdminProductUpdateData(data),
          });
          results.updated++;
        } else {
          await prisma.shopProduct.create({
            data: buildAdminProductCreateData(data),
          });
          results.created++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors.push({
          slug: productInput.slug || 'unknown',
          error: message.substring(0, 200),
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('DO88 bulk import error', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
