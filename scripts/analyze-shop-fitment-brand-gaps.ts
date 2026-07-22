import { extractProductFitment } from "../src/lib/crossShopFitment";
import { prisma } from "../src/lib/prisma";

const brand = process.argv[2]?.trim();
const limit = Math.max(1, Math.min(100, Number(process.argv[3] ?? 25) || 25));

if (!brand) {
  throw new Error("Usage: tsx scripts/analyze-shop-fitment-brand-gaps.ts <brand> [limit]");
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: {
      isPublished: true,
      status: "ACTIVE",
      brand: { contains: brand, mode: "insensitive" },
    },
    orderBy: { sku: "asc" },
    select: {
      slug: true,
      sku: true,
      scope: true,
      brand: true,
      vendor: true,
      productType: true,
      tags: true,
      titleUa: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
      shortDescUa: true,
      shortDescEn: true,
      longDescUa: true,
      longDescEn: true,
      bodyHtmlUa: true,
      bodyHtmlEn: true,
      collectionUa: true,
      collectionEn: true,
      highlights: true,
    },
  });

  const gaps = rows
    .map((row) => {
      const product = {
        slug: row.slug,
        sku: row.sku,
        scope: row.scope,
        brand: row.brand,
        vendor: row.vendor,
        productType: row.productType ?? undefined,
        tags: row.tags,
        title: { ua: row.titleUa, en: row.titleEn },
        category: { ua: row.categoryUa ?? "", en: row.categoryEn ?? "" },
        shortDescription: { ua: row.shortDescUa ?? "", en: row.shortDescEn ?? "" },
        longDescription: { ua: row.longDescUa ?? "", en: row.longDescEn ?? "" },
        bodyHtml: { ua: row.bodyHtmlUa ?? "", en: row.bodyHtmlEn ?? "" },
        collection: { ua: row.collectionUa ?? "", en: row.collectionEn ?? "" },
        highlights: row.highlights,
        leadTime: { ua: "", en: "" },
        stock: "inStock" as const,
        price: { eur: 0, usd: 0, uah: 0 },
        image: "",
      };
      const fitment = extractProductFitment(product);
      return { row, fitment };
    })
    .filter(({ fitment }) => fitment.models.length === 0);

  console.log(
    JSON.stringify(
      {
        brand,
        total: rows.length,
        missingModel: gaps.length,
        samples: gaps.slice(0, limit).map(({ row, fitment }) => ({
          sku: row.sku,
          title: row.titleEn,
          productType: row.productType,
          make: fitment.make,
          chassis: fitment.chassisCodes,
          tags: row.tags.filter((tag) => /^(?:brand|make|model|vehicle|fits-|car_)/i.test(tag)),
        })),
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
