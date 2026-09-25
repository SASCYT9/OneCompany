import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";
import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
  normalizeAdminProductPayload,
} from "@/lib/shopAdminCatalog";
import {
  publishShopCatalogImportCreation,
  publishShopCatalogImportUpdate,
} from "@/lib/shopCatalogImportWriter.server";
import type { ShopCatalogCoordinatedMutationResult } from "@/lib/shopCatalogMutationCoordinator.server";
import { runShopCatalogOutboxRuntime } from "@/lib/shopCatalogOutboxRuntime.server";

const burgerImportProductSelect = {
  ...adminProductImportMergeSelect,
  catalogVersion: true,
};

type BurgerImportProduct = {
  title: string | { ua?: string; en?: string };
  titleUa?: string;
  titleEn?: string;
  slug: string;
  sku?: string | null;
  shopifyProductId?: number;
  sourceProductId?: number;
  descriptionEn?: string | null;
  descriptionUa?: string | null;
  shortDescription?: { ua?: string; en?: string } | null;
  seo?: {
    titleUa?: string; titleEn?: string; descriptionUa?: string; descriptionEn?: string;
  } | null;
  priceUsd: number;
  tags: string[];
  productType?: string | null;
  vendor?: string | null;
  internalOptionOnly?: boolean;
  manualQuoteRequired?: boolean;
  requiresShipping?: boolean;
  selectedVariant?: string | null;
  media?: Array<{ url?: string | null; alt?: string | null }>;
  image?: string | null;
  gallery?: string[];
  options?: Array<{ name: string; position?: number; values: string[] }>;
  variants?: Array<{
    sourceVariantId?: number | string;
    title?: string | null;
    sku?: string | null;
    internalKey?: string | null;
    position?: number;
    optionValues?: string[];
    priceUsd?: number | null;
    priceEur?: number | null;
    compareAtPriceUsd?: number | null;
    available?: boolean;
    isDefault?: boolean;
    requiresShipping?: boolean;
    weightKg?: number | null;
    packageWeightKg?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    image?: string | null;
    packageDimensionsCm?: { length?: number; width?: number; height?: number };
  }>;
};

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const filePath = path.join(process.cwd(), "data", "burger-products.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "data/burger-products.json not found. Run scraper first." },
        { status: 400 }
      );
    }

    const products = JSON.parse(fs.readFileSync(filePath, "utf-8")) as BurgerImportProduct[];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const catalog: ShopCatalogCoordinatedMutationResult[] = [];

    for (const p of products) {
      try {
        if (p.internalOptionOnly || p.tags?.includes("catalog:hidden")) {
          skipped++;
          errors.push(`[${p.slug}] ${p.title}: internal Product Options/service record, excluded from storefront import`);
          continue;
        }
        if (p.manualQuoteRequired) {
          skipped++;
          errors.push(`[${p.slug}] ${p.title}: manual supplier quote required before pricing/import`);
          continue;
        }
        const shopifyProductId = p.shopifyProductId ?? p.sourceProductId;
        if (!Number.isSafeInteger(shopifyProductId) || Number(shopifyProductId) <= 0) {
          throw new Error("Missing valid Shopify product id");
        }
        const slug = `burger-${p.slug}`;
        const defaultSourceVariant = p.variants?.find((variant) => variant.isDefault) ?? p.variants?.[0];
        const sku = p.sku || defaultSourceVariant?.sku || `BURGER-${shopifyProductId}`;
        const titleEn = typeof p.title === "string" ? p.title : p.title?.en || p.title?.ua || p.slug;
        const titleUa = p.titleUa || (typeof p.title === "string" ? p.title : p.title?.ua) || titleEn;

        // Match by slug only — slug is the unique key. SKU is non-unique in the
        // Burger catalog (39 duplicate-SKU pairs in source), so matching by SKU
        // causes the second product with a colliding SKU to overwrite the first.
        const existing = await prisma.shopProduct.findUnique({
          where: { slug },
          select: burgerImportProductSelect,
        });

        const variants = Array.isArray(p.variants) && p.variants.length
          ? p.variants
          : [{
              title: p.selectedVariant || "Default",
              sku: p.sku,
              priceUsd: p.priceUsd,
              available: true,
              isDefault: true,
            }];
        const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];
        const productPriceUsd = Number(defaultVariant.priceUsd ?? p.priceUsd ?? 0);
        const priceEur = Number.isFinite(defaultVariant.priceEur)
          ? Number(defaultVariant.priceEur)
          : Math.round(productPriceUsd * 0.92 * 100) / 100;
        const media = Array.isArray(p.media)
          ? p.media
              .map((item) => ({
                src: String(item?.url ?? "").trim(),
                altText: item?.alt || titleEn,
              }))
              .filter((item: { src: string }) => Boolean(item.src))
          : Array.isArray(p.gallery)
            ? p.gallery.map((src, position) => ({ src, altText: titleEn, position, mediaType: "IMAGE" as const }))
            : p.image ? [{ src: p.image, altText: titleEn, position: 0, mediaType: "IMAGE" as const }] : [];

        const data = {
          titleEn,
          titleUa,
          slug,
          sku,
          brand: "Burger Motorsports",
          shortDescEn: p.shortDescription?.en ?? p.seo?.descriptionEn ?? null,
          shortDescUa: p.shortDescription?.ua ?? p.seo?.descriptionUa ?? null,
          bodyHtmlEn: sanitizeRichTextHtml(p.descriptionEn || ""),
          bodyHtmlUa: sanitizeRichTextHtml(p.descriptionUa || ""),
          priceEur,
          priceUsd: productPriceUsd,
          tags: p.tags,
          isPublished: true,
          image: media[0]?.src || null,
          gallery: media.map((item: { src: string }) => item.src),
          productType: p.productType || null,
          seoTitleUa: p.seo?.titleUa ?? null,
          seoTitleEn: p.seo?.titleEn ?? null,
          seoDescriptionUa: p.seo?.descriptionUa ?? null,
          seoDescriptionEn: p.seo?.descriptionEn ?? null,
          vendor: p.vendor || "Burger Motorsports Inc",
        };
        const normalized = normalizeAdminProductPayload({
          ...data,
          scope: "auto",
          storefront: "main",
          status: "ACTIVE",
          stock: variants.some((variant) => variant.available !== false) ? "inStock" : "preOrder",
          media: media.map((item: { src: string; altText?: string }, index: number) => ({
            ...item,
            position: index,
            mediaType: "IMAGE",
          })),
          options: p.options ?? [],
          variants: variants.map((variant, index) => {
            const variantPriceUsd = Number(variant.priceUsd ?? productPriceUsd);
            const variantPriceEur = Number.isFinite(variant.priceEur)
              ? Number(variant.priceEur)
              : Math.round(variantPriceUsd * 0.92 * 100) / 100;
            const sourceVariantId = variant.sourceVariantId == null
              ? null
              : String(variant.sourceVariantId);
            const variantSku = variant.sku?.trim() && !/\s/.test(variant.sku)
              ? variant.sku.trim()
              : variant.internalKey || (sourceVariantId ? `BURGER-V-${sourceVariantId}` : sku);
            const packageWeightKg = variant.packageWeightKg ?? variant.weightKg;
            return {
              title: variant.title || p.selectedVariant || "Default",
              sku: variantSku,
              priceEur: variantPriceEur,
              priceUsd: variantPriceUsd,
              inventoryQty: variant.available === false ? 0 : 999,
              requiresShipping: variant.requiresShipping ?? p.requiresShipping ?? true,
              position: variant.position ?? index,
              option1Value: variant.optionValues?.[0] ?? null,
              option2Value: variant.optionValues?.[1] ?? null,
              option3Value: variant.optionValues?.[2] ?? null,
              weight: packageWeightKg == null ? undefined : Number(packageWeightKg) * 1000,
              length: variant.lengthCm ?? variant.packageDimensionsCm?.length ?? undefined,
              width: variant.widthCm ?? variant.packageDimensionsCm?.width ?? undefined,
              height: variant.heightCm ?? variant.packageDimensionsCm?.height ?? undefined,
              image: variant.image ?? undefined,
              isDefault: variant.isDefault ?? index === 0,
            };
          }),
        });
        if (normalized.errors.length) {
          throw new Error(normalized.errors.join("; "));
        }

        if (existing) {
          catalog.push(
            await publishShopCatalogImportUpdate({
              productId: existing.id,
              expectedCatalogVersion: existing.catalogVersion,
              updateData: buildAdminProductSnapshotMergeUpdateData(normalized.data, existing),
              session,
              reason: "import.burger.update",
            })
          );
          updated++;
        } else {
          catalog.push(
            await publishShopCatalogImportCreation({
              createData: buildAdminProductCreateData(normalized.data),
              session,
              reason: "import.burger.create",
            })
          );
          created++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const unknownArg = msg.match(/Unknown argument `(\w+)`/);
        const missing = msg.match(/Argument `(\w+)` is missing/);
        const unique = msg.match(/Unique constraint.*`(\w+)`/);
        const detail = unknownArg
          ? `Unknown arg: ${unknownArg[1]}`
          : missing
            ? `Missing arg: ${missing[1]}`
            : unique
              ? `Duplicate: ${unique[1]}`
              : msg.slice(0, 300);
        errors.push(`[${p.slug}] ${p.title}: ${detail}`);
        skipped++;
        if (skipped <= 5) console.error(`IMPORT ERROR [${p.slug}]: ${detail}`);
      }
    }

    if (catalog.length) {
      after(async () => {
        try {
          await runShopCatalogOutboxRuntime({
            workerId: `catalog-burger:${process.env.VERCEL_REGION || "local"}:${randomUUID()}`,
            limit: Math.min(50, Math.max(10, catalog.length)),
          });
        } catch (error) {
          console.error("[shop-catalog.burger] immediate publish failed; cron recovery remains active", {
            outboxIds: catalog.map((mutation) => mutation.outboxId),
            error,
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      total: products.length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 20),
      catalog: catalog.map((mutation) => ({
        productId: mutation.productId,
        version: mutation.canonicalVersion,
        revisionId: mutation.revisionId,
        outboxId: mutation.outboxId,
        status: "SAVED",
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
