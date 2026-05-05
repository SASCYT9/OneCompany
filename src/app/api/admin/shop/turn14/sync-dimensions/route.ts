import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import {
  syncBrandShippingData,
  listShopBrands,
  type SyncBrandShippingResult,
} from '@/lib/turn14ShippingSync';
import { lookupShippingDims } from '@/lib/perplexityDimensions';

/**
 * SHIPPING-DATA-ONLY Turn14 sync.
 *
 * GET  — list shop brands (for the admin UI dropdown).
 * POST — sync one brand. Defaults to dry-run; pass `apply=true` to mutate.
 *
 * This route NEVER writes title / description / image fields — see
 * `src/lib/turn14ShippingSync.ts` for the field whitelist.
 */

export async function GET() {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const brands = await listShopBrands(prisma);
  return NextResponse.json({ success: true, brands });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  let payload: {
    brand?: string;
    apply?: boolean;
    refreshExisting?: boolean;
    maxVariants?: number;
    maxPagesPerBrand?: number;
    perplexityFallback?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const brandName = (payload.brand || '').trim();
  if (!brandName) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: brand' },
      { status: 400 },
    );
  }

  try {
    const result = await syncBrandShippingData(prisma, {
      brandName,
      apply: payload.apply === true,
      refreshExisting: payload.refreshExisting === true,
      maxVariants: payload.maxVariants,
      maxPagesPerBrand: payload.maxPagesPerBrand,
    });

    // Optional Perplexity fallback for variants Turn14 couldn't fill.
    // We resolve up to 5 variants per request to keep the round-trip bounded.
    let perplexity: {
      attempted: number;
      resolved: number;
      changes: SyncBrandShippingResult['changes'];
      skips: Array<{ variantId: string; reason: string; detail?: string }>;
    } | null = null;

    if (payload.perplexityFallback === true && result.unmatched.length > 0) {
      const FALLBACK_LIMIT = 5;
      const candidates = result.unmatched.slice(0, FALLBACK_LIMIT);
      perplexity = { attempted: candidates.length, resolved: 0, changes: [], skips: [] };

      for (const candidate of candidates) {
        const variant = await prisma.shopProductVariant.findUnique({
          where: { id: candidate.variantId },
          select: {
            id: true,
            sku: true,
            weight: true,
            length: true,
            width: true,
            height: true,
            product: { select: { titleEn: true, titleUa: true, brand: true } },
          },
        });
        if (!variant) {
          perplexity.skips.push({ variantId: candidate.variantId, reason: 'variant disappeared' });
          continue;
        }

        const lookup = await lookupShippingDims({
          brand: variant.product.brand || brandName,
          productTitle: variant.product.titleEn || variant.product.titleUa || '(untitled)',
          sku: variant.sku,
        });

        if (!lookup.ok) {
          perplexity.skips.push({
            variantId: variant.id,
            reason: lookup.reason,
            detail: lookup.detail,
          });
          continue;
        }

        const before = {
          weightKg: variant.weight ?? null,
          lengthCm: variant.length ?? null,
          widthCm: variant.width ?? null,
          heightCm: variant.height ?? null,
        };
        const after = {
          weightKg: lookup.weightKg ?? before.weightKg,
          lengthCm: lookup.lengthCm ?? before.lengthCm,
          widthCm: lookup.widthCm ?? before.widthCm,
          heightCm: lookup.heightCm ?? before.heightCm,
        };

        perplexity.changes.push({
          variantId: variant.id,
          sku: variant.sku,
          productTitle: variant.product.titleUa || variant.product.titleEn || '(untitled)',
          before,
          after,
          source: 'perplexity',
        });
        perplexity.resolved++;

        if (payload.apply === true) {
          const updateData: Record<string, unknown> = { isDimensionsEstimated: true };
          if (lookup.weightKg !== null) {
            updateData.weight = lookup.weightKg;
            updateData.grams = Math.round(lookup.weightKg * 1000);
          }
          if (lookup.lengthCm !== null) updateData.length = lookup.lengthCm;
          if (lookup.widthCm !== null) updateData.width = lookup.widthCm;
          if (lookup.heightCm !== null) updateData.height = lookup.heightCm;
          await prisma.shopProductVariant.update({
            where: { id: variant.id },
            data: updateData as any,
          });
        }
      }
    }

    return NextResponse.json({ success: true, result, perplexity });
  } catch (error: any) {
    console.error('[Turn14 ShippingSync] error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
