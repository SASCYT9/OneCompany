import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const groups = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { isPublished: true, brand: { not: null } },
    _count: true,
    orderBy: { _count: { brand: "desc" } },
  });
  console.log("=== All distinct brands ===");
  for (const g of groups) console.log(`  ${g.brand} = ${g._count}`);
  console.log();

  const rows = await prisma.shopProduct.findMany({
    where: {
      brand: {
        in: [
          "Range Rover",
          "Land Rover",
          "Mercedes-Benz",
          "Audi",
          "Lamborghini",
          "Volkswagen",
          "Bentley",
          "Rolls-Royce",
        ],
      },
    },
    select: { brand: true, slug: true, sku: true, titleEn: true, categoryEn: true, tags: true },
    take: 50,
  });
  const byBrand = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byBrand.get(r.brand!) ?? [];
    if (arr.length < 6) arr.push(r);
    byBrand.set(r.brand!, arr);
  }
  for (const [brand, list] of byBrand.entries()) {
    console.log(`\n=== ${brand} ===`);
    for (const r of list) {
      console.log(`  slug=${r.slug}`);
      console.log(`  title=${(r.titleEn ?? "").slice(0, 90)}`);
      console.log(`  cat=${(r.categoryEn ?? "").slice(0, 70)}`);
      const chassis = (r.tags ?? []).filter((t) => /^[A-Z]\s?\d{3}[A-Z]?$/.test(t)).slice(0, 5);
      if (chassis.length) console.log(`  chassis-tags: ${chassis.join(", ")}`);
    }
  }
  await prisma.$disconnect();
})();
