/**
 * Audit ShopProduct rows where the search API would return `price: null`
 * — i.e. priceUsd AND priceEur AND priceUsdB2b AND priceEurB2b all empty
 * — so they render as "On request" on /shop/stock.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  // Spot-check products from screenshot.
  const samples = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { in: ["8317", "8178", "WM-BM/CA/3/M", "WM-BM/CA/3/G", "P-HF1132", "s-BM/T/27H"] } },
        { sku: { contains: "8317" } },
        { sku: { contains: "8178" } },
      ],
    },
    select: {
      brand: true,
      sku: true,
      titleEn: true,
      stock: true,
      priceUsd: true,
      priceEur: true,
      priceUah: true,
      priceUsdB2b: true,
      priceEurB2b: true,
      compareAtUsd: true,
      compareAtEur: true,
      isPublished: true,
      status: true,
    },
  });
  console.log("=== Screenshot products ===");
  for (const p of samples) {
    console.log(`  [${p.brand}|${p.sku}] stock=${p.stock} pub=${p.isPublished} st=${p.status}`);
    console.log(`    priceUsd=${p.priceUsd} priceEur=${p.priceEur} priceUah=${p.priceUah}`);
    console.log(`    priceUsdB2b=${p.priceUsdB2b} priceEurB2b=${p.priceEurB2b}`);
    console.log(`    compareAtUsd=${p.compareAtUsd} compareAtEur=${p.compareAtEur}`);
  }

  // Aggregate: per brand, how many products have NO price at all?
  const brands = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { isPublished: true, status: "ACTIVE", brand: { not: null } },
    _count: true,
    orderBy: { _count: { brand: "desc" } },
  });

  console.log("\n=== Per-brand price coverage ===");
  for (const b of brands) {
    const brand = b.brand!;
    const noPrice = await prisma.shopProduct.count({
      where: {
        brand,
        isPublished: true,
        status: "ACTIVE",
        priceUsd: null,
        priceEur: null,
        priceUsdB2b: null,
        priceEurB2b: null,
      },
    });
    const hasUah = await prisma.shopProduct.count({
      where: {
        brand,
        isPublished: true,
        status: "ACTIVE",
        priceUsd: null,
        priceEur: null,
        priceUsdB2b: null,
        priceEurB2b: null,
        priceUah: { not: null },
      },
    });
    if (noPrice === 0) continue;
    const pct = ((noPrice / b._count) * 100).toFixed(1);
    console.log(
      `  ${brand.padEnd(22)} ${noPrice}/${b._count} (${pct}% on-request, ${hasUah} have UAH-only)`
    );
  }

  await prisma.$disconnect();
})();
