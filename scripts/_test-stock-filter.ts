/**
 * Simulates `handleShopSearch` exactly with brand=Remus + make=BMW + model=M2.
 * Mirrors the where-clause logic in `src/app/api/shop/stock/search/route.ts`.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  const brand = "Remus";
  const vMake = "bmw";
  const vModel = "m2";

  const fitTagsRequired: string[] = [`fits-model:${vMake}:${vModel}`];
  const where: any = {
    isPublished: true,
    status: "ACTIVE",
    tags: { hasEvery: fitTagsRequired },
    OR: [
      { brand: { contains: brand, mode: "insensitive" } },
      { vendor: { contains: brand, mode: "insensitive" } },
    ],
  };

  console.log("WHERE:", JSON.stringify(where, null, 2));

  const total = await prisma.shopProduct.count({ where });
  console.log(`\nTotal results: ${total}`);

  const sample = await prisma.shopProduct.findMany({
    where,
    select: { sku: true, titleEn: true, tags: true, brand: true, vendor: true },
    take: 5,
  });
  for (const r of sample) {
    const ft = (r.tags ?? []).filter((t) => t.startsWith("fits-")).slice(0, 4);
    console.log(`\n[${r.sku}] brand=${r.brand} vendor=${r.vendor}`);
    console.log(`  ${r.titleEn}`);
    console.log(`  fits-* sample: ${ft.join(", ")}`);
  }

  // Also test WITHOUT the brand filter — does the issue come from OR + tags interaction?
  const noBrandWhere: any = {
    isPublished: true,
    status: "ACTIVE",
    tags: { hasEvery: fitTagsRequired },
    brand: "Remus",
  };
  const totalNoBrandOr = await prisma.shopProduct.count({ where: noBrandWhere });
  console.log(`\nSAME filter with brand="Remus" (exact, no contains): ${totalNoBrandOr}`);

  await prisma.$disconnect();
})();
