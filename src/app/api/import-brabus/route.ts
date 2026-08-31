import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertAdminRequest } from "@/lib/adminAuth";
import { ADMIN_PERMISSIONS } from "@/lib/admin/adminPermissions";
import {
  buildBrabusProductSlug,
  buildBrabusSeoDescription,
  cleanBrabusHtmlDescription,
  cleanBrabusTitle,
} from "@/lib/brabusCatalogCleanup";
import { prisma } from "@/lib/prisma";
import { replaceStorefrontTag } from "@/lib/shopProductStorefront";
import { sanitizeRichTextHtml } from "@/lib/sanitizeRichTextHtml";
import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
  normalizeAdminProductPayload,
} from "@/lib/shopAdminCatalog";

type BrabusImportProduct = {
  sku?: string | number | null;
  title?: string | null;
  titleEn?: string | null;
  titleUk?: string | null;
  descriptionEn?: string | null;
  descriptionUk?: string | null;
  category?: string | null;
  sourceUrlDe?: string | null;
  priceEUR_final?: number | null;
  images?: unknown;
};

function determineCollections(product: BrabusImportProduct): {
  collectionEn: string;
  collectionUa: string;
  handle: string;
} {
  const t = (product.titleEn || "").toLowerCase();
  const c = (product.category || "").toLowerCase();
  const url = (product.sourceUrlDe || "").toLowerCase();

  if (t.includes("g-class") || t.includes("w 46") || url.includes("g-klasse")) {
    return { collectionEn: "G-Class Tuning", collectionUa: "Тюнінг G-Class", handle: "g-class" };
  }
  if (t.includes("s-class") || t.includes("w 22") || url.includes("s-klasse")) {
    return {
      collectionEn: "S-Class Executive",
      collectionUa: "S-Class Executive",
      handle: "s-class",
    };
  }
  if (t.includes("porsche") || url.includes("porsche")) {
    return {
      collectionEn: "Supercar Programme",
      collectionUa: "Програма Суперкарів",
      handle: "porsche",
    };
  }
  if (t.includes("rolls-royce") || url.includes("rolls")) {
    return {
      collectionEn: "Brabus Supercars",
      collectionUa: "Суперкари Brabus",
      handle: "rolls-royce",
    };
  }
  if (
    t.includes("monoblock") ||
    t.includes("wheel") ||
    c.includes("wheel") ||
    url.includes("raeder")
  ) {
    return { collectionEn: "Forged Wheels", collectionUa: "Ковані Диски", handle: "wheels" };
  }

  return {
    collectionEn: "Brabus Accessories",
    collectionUa: "Аксесуари Brabus",
    handle: "accessories",
  };
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    await assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_IMPORTS_MANAGE);
    const body: unknown = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected an array of Brabus products" }, { status: 400 });
    }
    const products = body as BrabusImportProduct[];
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const sku = String(p.sku ?? "").trim();

      try {
        if (!sku) {
          throw new Error("Brabus import requires a non-empty SKU");
        }
        const slug = buildBrabusProductSlug(sku);
        const colls = determineCollections(p);
        const priceEur = p.priceEUR_final;
        const images = Array.isArray(p.images)
          ? p.images.map((image: unknown) => String(image ?? "").trim()).filter(Boolean)
          : [];
        const mainImage = images[0] ?? null;
        const titleUa = cleanBrabusTitle("ua", p.titleUk || p.titleEn || p.title);
        const titleEn = cleanBrabusTitle("en", p.titleEn || p.title);
        const bodyHtmlUa = p.descriptionUk
          ? cleanBrabusHtmlDescription("ua", sanitizeRichTextHtml(p.descriptionUk))
          : null;
        const bodyHtmlEn = p.descriptionEn
          ? cleanBrabusHtmlDescription("en", sanitizeRichTextHtml(p.descriptionEn))
          : null;

        const tags = replaceStorefrontTag(["Brabus", "Tuning", colls.handle], "brabus");
        if (p.category) tags.push(p.category);

        const data = {
          slug,
          sku,
          scope: "auto",
          brand: "Brabus",
          vendor: "Brabus",
          productType: "Premium Tuning",
          productCategory: p.category,
          status: "ACTIVE" as const,
          titleUa,
          titleEn,
          seoTitleEn: titleEn,
          seoTitleUa: titleUa,
          bodyHtmlUa,
          bodyHtmlEn,
          longDescEn: bodyHtmlEn,
          longDescUa: bodyHtmlUa,
          seoDescriptionEn:
            buildBrabusSeoDescription("en", { longHtml: bodyHtmlEn, title: titleEn }) || null,
          seoDescriptionUa:
            buildBrabusSeoDescription("ua", { longHtml: bodyHtmlUa, title: titleUa }) || null,
          stock: "inStock",
          collectionUa: colls.collectionUa,
          collectionEn: colls.collectionEn,
          priceEur: priceEur,
          image: mainImage,
          isPublished: true,
          tags,
        };
        const normalized = normalizeAdminProductPayload({
          ...data,
          storefront: "brabus",
          gallery: images,
          media: images.map((src: string, index: number) => ({
            src,
            altText: p.titleEn || p.title,
            position: index + 1,
            mediaType: "IMAGE",
          })),
          variants: [
            {
              title: "Default Title",
              sku,
              position: 1,
              inventoryQty: 0,
              priceEur,
              requiresShipping: true,
              image: mainImage,
              isDefault: true,
            },
          ],
        });
        if (normalized.errors.length) {
          throw new Error(normalized.errors.join("; "));
        }

        const existingBySlug = await prisma.shopProduct.findUnique({
          where: { slug },
          select: adminProductImportMergeSelect,
        });
        const skuCandidates = existingBySlug
          ? []
          : await prisma.shopProduct.findMany({
              where: { sku: { equals: sku, mode: "insensitive" } },
              select: adminProductImportMergeSelect,
              take: 2,
            });
        if (skuCandidates.length > 1) {
          throw new Error(`Ambiguous Brabus product SKU: ${sku}`);
        }
        const existing = existingBySlug ?? skuCandidates[0];

        if (existing) {
          await prisma.shopProduct.update({
            where: { id: existing.id },
            data: buildAdminProductSnapshotMergeUpdateData(normalized.data, existing),
          });
          updated++;
        } else {
          await prisma.shopProduct.create({
            data: buildAdminProductCreateData(normalized.data),
          });
          created++;
        }
      } catch (err: unknown) {
        errors++;
        console.error(`Error on sku ${p.sku}:`, err);
      }
    }

    return NextResponse.json({ success: true, created, updated, errors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
