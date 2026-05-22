import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  // Pull a handful of REMUS bundles to compare with CSV `Name` column.
  const rows = await prisma.shopProduct.findMany({
    where: { brand: "Remus" },
    select: {
      sku: true,
      slug: true,
      titleEn: true,
      titleUa: true,
      categoryEn: true,
      tags: true,
    },
    take: 8,
    orderBy: { createdAt: "desc" },
  });

  for (const r of rows) {
    const fits = (r.tags ?? []).filter((t) => t.startsWith("fits:")).length;
    const fitsMake = (r.tags ?? []).filter((t) => t.startsWith("fits-make:")).length;
    console.log(`\n${r.sku} [${r.slug}]`);
    console.log(`  titleEn: ${r.titleEn}`);
    console.log(`  titleUa: ${r.titleUa}`);
    console.log(`  categoryEn: ${r.categoryEn}`);
    console.log(`  tags: ${(r.tags ?? []).length} total, ${fits} fits:, ${fitsMake} fits-make:`);
  }

  // Now show the SUM of how many distinct brand=Remus exist
  const counts = await prisma.shopProduct.groupBy({
    by: ["brand"],
    where: { brand: "Remus" },
    _count: true,
  });
  console.log("\n=== REMUS row count ===");
  console.log(counts);

  await prisma.$disconnect();
})();
