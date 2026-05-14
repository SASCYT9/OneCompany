import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const rows = await p.shopProduct.findMany({
    where: { brand: { in: ["DO88", "do88"] } },
    select: { slug: true, sku: true, titleEn: true, titleUa: true, priceEur: true },
    orderBy: { sku: "asc" },
  });
  console.log("total:", rows.length);
  // Flag suspicious: title contains "SportDesign" or "Sport package" but SKU does NOT end in -SD
  const flagged = rows.filter((r) => {
    const t = (r.titleEn || "") + " " + (r.titleUa || "");
    const hasSD = /sportdesign|sport design|sport-design|sport package/i.test(t);
    const skuLooksSD = /-SD$|-SD-/i.test(r.sku || "");
    return hasSD && !skuLooksSD;
  });
  console.log("\nFLAGGED (title mentions SportDesign but SKU does not end in -SD):");
  for (const r of flagged) console.log(`  ${r.sku}  |  ${r.slug}  |  ${r.titleEn}`);

  // Also show all -Cr/Carrera-suffixed do88 products for cross-ref
  const crSku = rows.filter((r) => /-Cr$|-CR$/.test(r.sku || ""));
  console.log(`\nAll -Cr/-CR SKUs (${crSku.length}):`);
  for (const r of crSku) console.log(`  ${r.sku}  |  ${r.slug}  |  ${r.titleEn}`);
  await p.$disconnect();
})();
