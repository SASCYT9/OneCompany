import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.shopProduct.findMany({
  where: { brand: { in: ["DO88", "do88", "Do88"] } },
  select: { sku: true, slug: true, titleEn: true, titleUa: true },
  orderBy: { sku: "asc" },
});

console.log(`total do88 products: ${rows.length}\n`);

// Suspicious patterns: trailing lowercase 1-2 letters after a digit, or
// trailing -<digit><lowercase letter> like -3r / -2br that look like a
// scraper-leftover color option rather than a real SKU.
const suspicious = rows.filter((r) => {
  const sku = r.sku || "";
  if (!sku) return false;
  // Real do88 SKUs are ALL-UPPERCASE. Any lowercase letter is suspicious.
  return /[a-z]/.test(sku);
});

console.log(`suspicious (any lowercase letter in SKU): ${suspicious.length}`);
console.log();
for (const r of suspicious) {
  console.log(`  ${r.sku.padEnd(22)}  ${r.slug.padEnd(35)}  ${r.titleEn?.slice(0, 60)}`);
}

await prisma.$disconnect();
