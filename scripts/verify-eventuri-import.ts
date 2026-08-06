import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildProductsFromShopifyCsv } from "../src/lib/shopAdminCsv";

const DEFAULT_SOURCE = "D:\\products_export_EVENTURI.csv";
const prisma = new PrismaClient();

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function metafield(
  product: { metafields: Array<{ namespace: string; key: string; value: string }> },
  namespace: string,
  key: string
) {
  return (
    product.metafields.find((item) => item.namespace === namespace && item.key === key)?.value ?? ""
  );
}

function parseFitment(value: string) {
  try {
    return JSON.parse(value) as { mode?: string };
  } catch {
    return null;
  }
}

async function main() {
  const source = path.resolve(argValue("--source") ?? DEFAULT_SOURCE);
  const outputDir = path.resolve(argValue("--output") ?? "artifacts/eventuri-import");
  const parsed = buildProductsFromShopifyCsv(await readFile(source, "utf8"));
  const products = await prisma.shopProduct.findMany({
    where: { brand: "Eventuri" },
    select: {
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      status: true,
      isPublished: true,
      stock: true,
      titleEn: true,
      bodyHtmlEn: true,
      seoDescriptionEn: true,
      priceUah: true,
      image: true,
      media: { select: { src: true, position: true } },
      variants: { select: { sku: true, priceUah: true, position: true } },
      metafields: { select: { namespace: true, key: true, value: true } },
    },
  });
  const [knowledgeStats] = await prisma.$queryRaw<
    Array<{
      records: bigint;
      activeRevision: bigint;
      ready: bigint;
      needsReview: bigint;
      processing: bigint;
      blocked: bigint;
      embeddingBacklogChunks: bigint;
      embeddingBacklogProducts: bigint;
      activeApplications: bigint;
    }>
  >`
    SELECT
      COUNT(DISTINCT knowledge."id")::bigint AS "records",
      COUNT(DISTINCT knowledge."id") FILTER (WHERE knowledge."activeRevision" > 0)::bigint AS "activeRevision",
      COUNT(DISTINCT knowledge."id") FILTER (WHERE knowledge."status" = 'READY')::bigint AS "ready",
      COUNT(DISTINCT knowledge."id") FILTER (WHERE knowledge."status" = 'NEEDS_REVIEW')::bigint AS "needsReview",
      COUNT(DISTINCT knowledge."id") FILTER (WHERE knowledge."status" = 'PROCESSING')::bigint AS "processing",
      COUNT(DISTINCT knowledge."id") FILTER (WHERE knowledge."status" = 'BLOCKED')::bigint AS "blocked",
      COUNT(DISTINCT chunk."id") FILTER (
        WHERE chunk."embedding" IS NULL OR chunk."embeddingModel" IS DISTINCT FROM 'gemini-embedding-2'
      )::bigint AS "embeddingBacklogChunks",
      COUNT(DISTINCT chunk."productId") FILTER (
        WHERE chunk."embedding" IS NULL OR chunk."embeddingModel" IS DISTINCT FROM 'gemini-embedding-2'
      )::bigint AS "embeddingBacklogProducts",
      COUNT(DISTINCT application."id") FILTER (WHERE application."isActive" = true)::bigint AS "activeApplications"
    FROM "ShopProductKnowledge" knowledge
    JOIN "ShopProduct" product ON product."id" = knowledge."productId"
    LEFT JOIN "ShopKnowledgeChunk" chunk
      ON chunk."knowledgeId" = knowledge."id"
     AND chunk."revision" = knowledge."revision"
    LEFT JOIN "ShopVehicleApplication" application
      ON application."knowledgeId" = knowledge."id"
     AND application."revision" = knowledge."revision"
    WHERE product."brand" = 'Eventuri'
  `;
  const cyrillic = /[А-Яа-яІіЇїЄєҐґ]/;
  const media = products.flatMap((product) => product.media);
  const variants = products.flatMap((product) => product.variants);
  const skuMap = new Map<string, string[]>();
  for (const product of products) {
    for (const sku of new Set(
      product.variants.map((variant) => variant.sku).filter(Boolean) as string[]
    )) {
      skuMap.set(sku, [...(skuMap.get(sku) ?? []), product.slug]);
    }
  }
  const duplicateSkus = [...skuMap]
    .filter(([, slugs]) => slugs.length > 1)
    .map(([sku, slugs]) => ({ sku, slugs }));
  const report = {
    generatedAt: new Date().toISOString(),
    source,
    csv: {
      rows: parsed.totalRows,
      products: parsed.products.length,
      variants: parsed.variantsCount,
      uniqueMediaUrls: new Set(
        parsed.products.flatMap((product) => product.media.map((item) => item.src))
      ).size,
    },
    db: {
      products: products.length,
      variants: variants.length,
      mediaReferences: media.length,
      uniqueBlobUrls: new Set(media.map((item) => item.src)).size,
      statuses: {
        draft: products.filter((product) => product.status === "DRAFT").length,
        active: products.filter((product) => product.status === "ACTIVE").length,
        archived: products.filter((product) => product.status === "ARCHIVED").length,
        published: products.filter((product) => product.isPublished).length,
      },
    },
    brand: {
      brandValues: [...new Set(products.map((product) => product.brand))],
      vendorValues: [...new Set(products.map((product) => product.vendor))],
      eventuriShopUkraineRows: products.filter(
        (product) =>
          product.brand === "Eventuri Shop Ukraine" || product.vendor === "Eventuri Shop Ukraine"
      ).length,
    },
    publication: {
      allDraft: products.every((product) => product.status === "DRAFT" && !product.isPublished),
      allPreOrder: products.every((product) => product.stock === "preOrder"),
    },
    pricing: {
      productPriced: products.filter(
        (product) => product.priceUah !== null && Number(product.priceUah) > 0
      ).length,
      variantPriced: variants.filter(
        (variant) => variant.priceUah !== null && Number(variant.priceUah) > 0
      ).length,
      productZeroOrMissing: products
        .filter((product) => product.priceUah === null || Number(product.priceUah) <= 0)
        .map((product) => ({ slug: product.slug, sku: product.sku })),
      variantZeroOrMissing: variants
        .filter((variant) => variant.priceUah === null || Number(variant.priceUah) <= 0)
        .map((variant) => variant.sku),
      indMissing: products
        .filter(
          (product) => metafield(product, "eventuri_import", "ind_pricing_status") === "missing"
        )
        .map((product) => ({
          slug: product.slug,
          skus: product.variants.map((variant) => variant.sku),
        })),
    },
    media: {
      mainImageMissing: products
        .filter((product) => !product.image)
        .map((product) => ({ slug: product.slug, sku: product.sku })),
      mainImageBlob: products.filter((product) =>
        product.image?.includes("blob.vercel-storage.com")
      ).length,
      mainImageShopifyCdn: products.filter((product) => product.image?.includes("cdn.shopify.com"))
        .length,
      referencesBlob: media.filter((item) => item.src.includes("blob.vercel-storage.com")).length,
      referencesShopifyCdn: media.filter((item) => item.src.includes("cdn.shopify.com")).length,
      positionsValid: products.every((product) =>
        product.media.every((item, index) => item.position === index + 1)
      ),
    },
    fitment: {
      vehicleSpecific: products.filter(
        (product) =>
          parseFitment(metafield(product, "onecompany", "supplier_fitment"))?.mode ===
          "vehicle_specific"
      ).length,
      needsReview: products
        .filter(
          (product) =>
            parseFitment(metafield(product, "onecompany", "supplier_fitment"))?.mode ===
            "needs_review"
        )
        .map((product) => ({ slug: product.slug, sku: product.sku })),
    },
    translations: {
      incomplete: products
        .filter(
          (product) =>
            !product.titleEn ||
            !product.bodyHtmlEn ||
            !product.seoDescriptionEn ||
            cyrillic.test(product.titleEn) ||
            cyrillic.test(product.seoDescriptionEn)
        )
        .map((product) => product.slug),
    },
    knowledge: {
      records: Number(knowledgeStats?.records ?? 0),
      activeRevision: Number(knowledgeStats?.activeRevision ?? 0),
      ready: Number(knowledgeStats?.ready ?? 0),
      needsReview: Number(knowledgeStats?.needsReview ?? 0),
      processing: Number(knowledgeStats?.processing ?? 0),
      blocked: Number(knowledgeStats?.blocked ?? 0),
      activeApplications: Number(knowledgeStats?.activeApplications ?? 0),
      embeddingBacklogChunks: Number(knowledgeStats?.embeddingBacklogChunks ?? 0),
      embeddingBacklogProducts: Number(knowledgeStats?.embeddingBacklogProducts ?? 0),
    },
    duplicateSkus,
  };
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "post-import-verification.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        db: report.db,
        brand: report.brand,
        publication: report.publication,
        pricing: {
          productPriced: report.pricing.productPriced,
          variantPriced: report.pricing.variantPriced,
          missingProducts: report.pricing.productZeroOrMissing.length,
          missingVariants: report.pricing.variantZeroOrMissing.length,
        },
        media: report.media,
        fitment: report.fitment,
        translations: report.translations,
        knowledge: report.knowledge,
        duplicateSkuGroups: report.duplicateSkus.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
