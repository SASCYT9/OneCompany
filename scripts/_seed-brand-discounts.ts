/**
 * Seed sample system-level per-brand B2B discounts so we can visually verify
 * the discount engine across brand-shops and B2B Склад.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const lib = await import("../src/lib/shopBrandB2bDiscounts");
  const samples = [
    { brand: "Akrapovic", discountPct: 15, notes: "seed" },
    { brand: "Ilmberger Carbon", discountPct: 10, notes: "seed" },
    { brand: "Remus", discountPct: 20, notes: "seed" },
    { brand: "Brabus", discountPct: 8, notes: "seed" },
  ];
  for (const s of samples) {
    await lib.upsertBrandB2bDiscount(prisma, s);
    console.log(`  upserted ${s.brand} → ${s.discountPct}%`);
  }
  const all = await lib.listBrandB2bDiscounts(prisma);
  console.log(`\nAll system rules: ${all.length}`);
  for (const r of all) console.log(`  ${r.brand}: ${r.discountPct}%`);
  await prisma.$disconnect();
}
main().catch(console.error);
