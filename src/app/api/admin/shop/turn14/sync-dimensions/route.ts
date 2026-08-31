import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";
import {
  syncBrandShippingData,
  listShopBrands,
  type SyncBrandShippingResult,
} from "@/lib/turn14ShippingSync";
import { lookupShippingDims } from "@/lib/perplexityDimensions";
import { publishShopCatalogDimensionsUpdate } from "@/lib/shopCatalogDimensionsWriter.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

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
  try {
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to authorize request" }, { status: 500 });
  }

  const brands = await listShopBrands(prisma);
  return NextResponse.json({ success: true, brands });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  let session;
  try {
    session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to authorize request" }, { status: 500 });
  }

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

  const brandName = (payload.brand || "").trim();
  if (!brandName) {
    return NextResponse.json(
      { success: false, error: "Missing required field: brand" },
      { status: 400 }
    );
  }

  try {
    const result = await syncBrandShippingData(prisma, {
      brandName,
      apply: payload.apply === true,
      refreshExisting: payload.refreshExisting === true,
      maxVariants: payload.maxVariants,
      maxPagesPerBrand: payload.maxPagesPerBrand,
      session,
    });

    // Optional Perplexity fallback for variants Turn14 couldn't fill.
    // We resolve up to 5 variants per request to keep the round-trip bounded.
    let perplexity: {
      attempted: number;
      resolved: number;
      changes: SyncBrandShippingResult["changes"];
      skips: Array<{ variantId: string; reason: string; detail?: string }>;
      catalog: Array<{ productId: string; canonicalVersion: string; outboxId: string }>;
    } | null = null;

    if (payload.perplexityFallback === true && result.unmatched.length > 0) {
      const FALLBACK_LIMIT = 5;
      const candidates = result.unmatched.slice(0, FALLBACK_LIMIT);
      perplexity = { attempted: candidates.length, resolved: 0, changes: [], skips: [], catalog: [] };

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
            product: {
              select: { id: true, titleEn: true, titleUa: true, brand: true, catalogVersion: true },
            },
          },
        });
        if (!variant) {
          perplexity.skips.push({ variantId: candidate.variantId, reason: "variant disappeared" });
          continue;
        }

        const lookup = await lookupShippingDims({
          brand: variant.product.brand || brandName,
          productTitle: variant.product.titleEn || variant.product.titleUa || "(untitled)",
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
          productTitle: variant.product.titleUa || variant.product.titleEn || "(untitled)",
          before,
          after,
          source: "perplexity",
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
          const mutation = await publishShopCatalogDimensionsUpdate({
            productId: variant.product.id,
            expectedCatalogVersion: variant.product.catalogVersion,
            patches: [{ variantId: variant.id, data: updateData }],
            session,
            reason: "perplexity.shipping.lookup",
          });
          perplexity.catalog.push({
            productId: mutation.productId,
            canonicalVersion: mutation.canonicalVersion,
            outboxId: mutation.outboxId,
          });
        }
      }
    }

    const mutationCount = result.catalog.length + (perplexity?.catalog.length ?? 0);
    if (payload.apply === true && mutationCount > 0) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-turn14-dimensions:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, mutationCount)),
          });
        } catch (error) {
          console.error(
            "[shop-catalog.turn14-dimensions] immediate publish failed; cron recovery remains active",
            error
          );
        }
      });
    }

    return NextResponse.json({ success: true, result, perplexity });
  } catch (error: any) {
    console.error("[Turn14 ShippingSync] error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    );
  }
}
