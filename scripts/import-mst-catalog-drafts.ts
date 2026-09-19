import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  adminProductImportMergeSelect,
  buildAdminProductCreateData,
  buildAdminProductSnapshotMergeUpdateData,
  type AdminShopProductPayload,
} from "../src/lib/shopAdminCatalog";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import {
  coordinateShopCatalogProductCreationWithClient,
  coordinateShopCatalogProductMutationWithClient,
} from "../src/lib/shopCatalogMutationCoordinator.server";
import {
  buildMstSupplierFitment,
  calculateMstRetailPrice,
  type MstCatalogProduct,
} from "../src/lib/mstCatalog";
import { SUPPLIER_FITMENT_KEY, SUPPLIER_FITMENT_NAMESPACE } from "../src/lib/shopImportFitment";

const SOURCE_PATH = path.resolve("data/mst-products.json");
const CHANGE_DOMAINS = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "PRICE",
  "INVENTORY",
  "FITMENT",
  "TAXONOMY",
  "VISIBILITY",
] as const;

type MstCatalogFile = {
  schemaVersion: number;
  generatedAt: string;
  products: MstCatalogProduct[];
};

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!(code === "P1017" || code === "P2024" || code === "P2034") || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw new Error("MST import retry loop exhausted");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlDescription(summary: string, heading: string, sellingPoints: string[]) {
  const items = sellingPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  return `<p>${escapeHtml(summary)}</p><p><strong>${escapeHtml(heading)}</strong></p><ul>${items}</ul>`;
}

function fitmentFor(product: MstCatalogProduct) {
  return buildMstSupplierFitment(product);
}

function payloadFor(
  product: MstCatalogProduct,
  sourceGeneratedAt: string
): AdminShopProductPayload {
  if (!product.pricing.priceUsd || !product.pricing.sourceIncVatGbp || !product.pricing.sellGbp) {
    throw new Error(`Cannot build a priced MST draft for ${product.sku}`);
  }
  const bodyHtmlEn = htmlDescription(
    product.shortDescEn,
    "Why it is worth upgrading",
    product.sellingPointsEn
  );
  const bodyHtmlUa = htmlDescription(
    product.shortDescUa,
    "Чому варто оновити",
    product.sellingPointsUa
  );
  const fitment = fitmentFor(product);
  return {
    slug: product.slug,
    sku: product.sku,
    scope: "auto",
    storefront: "main",
    brand: "MST Performance",
    vendor: "MST Performance",
    productType: product.categoryEn,
    productCategory: product.categoryEn,
    categoryId: null,
    tags: product.tags,
    collectionIds: [],
    status: "DRAFT",
    titleUa: product.titleUa,
    titleEn: product.titleEn,
    categoryUa: product.categoryUa,
    categoryEn: product.categoryEn,
    shortDescUa: product.shortDescUa,
    shortDescEn: product.shortDescEn,
    longDescUa: bodyHtmlUa,
    longDescEn: bodyHtmlEn,
    bodyHtmlUa,
    bodyHtmlEn,
    leadTimeUa: null,
    leadTimeEn: null,
    // Sendit availability is supplier availability, not OneCompany warehouse stock.
    // Until a warehouse quantity is confirmed, expose these as preorder items.
    stock: "preOrder",
    collectionUa: product.categoryUa,
    collectionEn: product.categoryEn,
    priceEur: null,
    priceEurEurope: null,
    priceUsd: product.pricing.priceUsd,
    priceUah: null,
    priceEurB2b: null,
    priceUsdB2b: null,
    priceUahB2b: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
    image: product.images[0] ?? null,
    seoTitleUa: product.titleUa,
    seoTitleEn: product.titleEn,
    seoDescriptionUa: product.shortDescUa,
    seoDescriptionEn: product.shortDescEn,
    isPublished: false,
    publishedAt: null,
    gallery: product.images,
    highlights: {
      ua: product.sellingPointsUa,
      en: product.sellingPointsEn,
    },
    media: product.images.map((src, position) => ({
      src,
      altText: product.titleEn,
      position: position + 1,
      mediaType: "IMAGE",
    })),
    options: [],
    variants: [
      {
        title: "Default",
        sku: product.sku,
        position: 1,
        inventoryQty: 0,
        inventoryPolicy: "CONTINUE",
        fulfillmentService: "manual",
        priceEur: null,
        priceEurEurope: null,
        priceUsd: product.pricing.priceUsd,
        priceUah: null,
        priceEurB2b: null,
        priceUsdB2b: null,
        priceUahB2b: null,
        compareAtEur: null,
        compareAtUsd: null,
        compareAtUah: null,
        compareAtEurB2b: null,
        compareAtUsdB2b: null,
        compareAtUahB2b: null,
        requiresShipping: true,
        taxable: true,
        image: product.images[0] ?? null,
        isDefault: true,
      },
    ],
    metafields: [
      {
        namespace: SUPPLIER_FITMENT_NAMESPACE,
        key: SUPPLIER_FITMENT_KEY,
        value: JSON.stringify(fitment),
        valueType: "json",
      },
      {
        namespace: "mst_import",
        key: "official_url",
        value: product.source.officialUrl,
        valueType: "url",
      },
      {
        namespace: "mst_import",
        key: "sendit_url",
        value: product.source.senditUrl!,
        valueType: "url",
      },
      {
        namespace: "mst_import",
        key: "sendit_sku",
        value: product.source.senditMatchedSku!,
        valueType: "single_line_text_field",
      },
      {
        namespace: "mst_import",
        key: "manufacturer_availability",
        value: product.source.manufacturerAvailability ?? "unknown",
        valueType: "single_line_text_field",
      },
      {
        namespace: "mst_import",
        key: "sendit_availability",
        value: product.source.senditAvailability ?? "unknown",
        valueType: "single_line_text_field",
      },
      {
        namespace: "mst_import",
        key: "sendit_inc_vat_gbp",
        value: product.pricing.sourceIncVatGbp.toFixed(2),
        valueType: "number_decimal",
      },
      {
        namespace: "mst_import",
        key: "sell_gbp",
        value: product.pricing.sellGbp.toFixed(2),
        valueType: "number_decimal",
      },
      {
        namespace: "mst_import",
        key: "gbp_to_usd_rate",
        value: "1.37",
        valueType: "number_decimal",
      },
      {
        namespace: "mst_import",
        key: "price_formula",
        value: "Sendit inc. VAT GBP × 1.10, then × 1.37 and round USD up to the next 5",
        valueType: "single_line_text_field",
      },
      {
        namespace: "mst_import",
        key: "source_generated_at",
        value: sourceGeneratedAt,
        valueType: "date_time",
      },
    ],
  };
}

function validateSource(source: MstCatalogFile) {
  if (source.schemaVersion !== 1) throw new Error(`Unsupported MST schema ${source.schemaVersion}`);
  if (!source.generatedAt || Number.isNaN(Date.parse(source.generatedAt))) {
    throw new Error("MST source generatedAt is invalid");
  }
  const slugs = new Set<string>();
  const skus = new Set<string>();
  for (const product of source.products) {
    if (product.pricing.status !== "matched") {
      throw new Error(`Unpriced MST product must not be present in the catalog: ${product.sku}`);
    }
    if (slugs.has(product.slug)) throw new Error(`Duplicate MST slug ${product.slug}`);
    if (skus.has(product.sku)) throw new Error(`Duplicate MST SKU ${product.sku}`);
    slugs.add(product.slug);
    skus.add(product.sku);
    if (product.pricing.status === "matched") {
      const expected = calculateMstRetailPrice(product.pricing.sourceIncVatGbp!);
      if (
        expected.sellGbp !== product.pricing.sellGbp ||
        expected.priceUsd !== product.pricing.priceUsd
      ) {
        throw new Error(`Derived MST price mismatch for ${product.sku}`);
      }
      if (!product.source.senditUrl || !product.source.senditMatchedSku) {
        throw new Error(`Matched MST price is missing Sendit provenance for ${product.sku}`);
      }
    }
  }
}

async function main() {
  const commit = process.argv.includes("--commit-draft");
  const source = JSON.parse(await readFile(SOURCE_PATH, "utf8")) as MstCatalogFile;
  validateSource(source);
  const pricedProducts = source.products.filter(
    (product) =>
      product.pricing.status === "matched" && product.pricing.priceUsd && product.images.length
  );
  const skipped = source.products
    .filter((product) => !pricedProducts.includes(product))
    .map((product) => ({
      sku: product.sku,
      reason:
        product.pricing.status !== "matched"
          ? "Sendit inc. VAT price is missing"
          : "Official MST imagery is missing",
    }));
  if (!commit) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          source: SOURCE_PATH,
          sourceGeneratedAt: source.generatedAt,
          requestedProducts: source.products.length,
          importableDrafts: pricedProducts.length,
          intake: pricedProducts.filter((product) => product.categoryKey === "intake").length,
          turboPipes: pricedProducts.filter((product) => product.categoryKey === "turbo-pipes")
            .length,
          skipped,
          published: 0,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  const outboxIds: string[] = [];
  try {
    for (const sourceProduct of pricedProducts) {
      const product = payloadFor(sourceProduct, source.generatedAt);
      const [bySlug, bySku] = await Promise.all([
        prisma.shopProduct.findUnique({
          where: { slug: product.slug },
          select: {
            ...adminProductImportMergeSelect,
            brand: true,
            status: true,
            isPublished: true,
            catalogVersion: true,
          },
        }),
        prisma.shopProduct.findFirst({
          where: { sku: product.sku },
          select: { id: true, slug: true, brand: true },
        }),
      ]);
      if (bySku && bySku.slug !== product.slug) {
        throw new Error(`MST SKU ${product.sku} already belongs to ${bySku.slug}`);
      }
      if (bySlug && bySlug.brand !== "MST Performance") {
        throw new Error(`MST slug ${product.slug} belongs to brand ${bySlug.brand ?? "(empty)"}`);
      }
      if (bySlug?.isPublished || bySlug?.status === "ACTIVE") {
        throw new Error(
          `Refusing to overwrite active MST product ${product.slug} with a draft import`
        );
      }
      if (bySlug) {
        const mutation = await retryTransient(() =>
          coordinateShopCatalogProductMutationWithClient(prisma, {
            productId: bySlug.id,
            expectedCatalogVersion: bySlug.catalogVersion.toString(),
            changeDomains: CHANGE_DOMAINS,
            async mutateAndSnapshot(tx, nextCatalogVersion) {
              await tx.shopProduct.update({
                where: { id: bySlug.id },
                data: buildAdminProductSnapshotMergeUpdateData(product, bySlug),
              });
              return buildShopCatalogAdminSnapshot(tx, bySlug.id, nextCatalogVersion, {
                type: "IMPORT",
                id: "mst-import@system.local",
                reason: "mst.draft-update",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        updated += 1;
      } else {
        const createData = buildAdminProductCreateData(product);
        const mutation = await retryTransient(() =>
          coordinateShopCatalogProductCreationWithClient(prisma, {
            changeDomains: CHANGE_DOMAINS,
            async create(tx) {
              return (await tx.shopProduct.create({ data: createData, select: { id: true } })).id;
            },
            snapshot(tx, productId, initialCatalogVersion) {
              return buildShopCatalogAdminSnapshot(tx, productId, initialCatalogVersion, {
                type: "IMPORT",
                id: "mst-import@system.local",
                reason: "mst.draft-create",
              });
            },
          })
        );
        outboxIds.push(mutation.outboxId);
        created += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "commit-draft",
        requestedProducts: source.products.length,
        created,
        updated,
        skipped,
        published: 0,
        catalogOutboxIds: outboxIds,
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
