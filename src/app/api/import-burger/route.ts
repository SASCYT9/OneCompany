import { NextResponse } from "next/server";
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

type BurgerImportProduct = {
  title: string;
  slug: string;
  sku?: string | null;
  shopifyProductId: number;
  descriptionEn?: string | null;
  descriptionUa?: string | null;
  priceUsd: number;
  tags: string[];
  productType?: string | null;
  vendor?: string | null;
  selectedVariant?: string | null;
  media?: Array<{ url?: string | null; alt?: string | null }>;
};

export async function POST() {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
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

    for (const p of products) {
      try {
        const slug = `burger-${p.slug}`;
        const sku = p.sku || `BURGER-${p.shopifyProductId}`;

        // Match by slug only — slug is the unique key. SKU is non-unique in the
        // Burger catalog (39 duplicate-SKU pairs in source), so matching by SKU
        // causes the second product with a colliding SKU to overwrite the first.
        const existing = await prisma.shopProduct.findUnique({
          where: { slug },
          select: adminProductImportMergeSelect,
        });

        const priceEur = Math.round(p.priceUsd * 0.92 * 100) / 100;
        const media = Array.isArray(p.media)
          ? p.media
              .map((item) => ({
                src: String(item?.url ?? "").trim(),
                altText: item?.alt || p.title,
              }))
              .filter((item: { src: string }) => Boolean(item.src))
          : [];

        const data = {
          titleEn: p.title,
          titleUa: p.title,
          slug,
          sku,
          brand: "Burger Motorsports",
          bodyHtmlEn: sanitizeRichTextHtml(p.descriptionEn || ""),
          bodyHtmlUa: sanitizeRichTextHtml(p.descriptionUa || ""),
          priceEur,
          priceUsd: p.priceUsd,
          tags: p.tags,
          isPublished: true,
          image: media[0]?.src || null,
          gallery: media.map((item: { src: string }) => item.src),
          productType: p.productType || null,
          vendor: p.vendor || "Burger Motorsports Inc",
        };
        const normalized = normalizeAdminProductPayload({
          ...data,
          scope: "auto",
          storefront: "main",
          status: "ACTIVE",
          stock: "inStock",
          media: media.map((item: { src: string; altText?: string }, index: number) => ({
            ...item,
            position: index,
            mediaType: "IMAGE",
          })),
          variants: [
            {
              title: p.selectedVariant || "Default",
              sku,
              priceEur,
              priceUsd: p.priceUsd,
              inventoryQty: 999,
              position: 0,
              isDefault: true,
            },
          ],
        });
        if (normalized.errors.length) {
          throw new Error(normalized.errors.join("; "));
        }

        if (existing) {
          await prisma.shopProduct.update({
            where: { id: existing.id },
            data: buildAdminProductSnapshotMergeUpdateData(normalized.data, existing),
          });
          updated++;
        } else {
          await prisma.shopProduct.create({ data: buildAdminProductCreateData(normalized.data) });
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

    return NextResponse.json({
      success: true,
      total: products.length,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
