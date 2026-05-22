/**
 * Two audits:
 *   A. Search false-positives — does "Akrapovic" return ONLY Akrapovic items,
 *      or also Ilmberger items that mention "Akrapovic" in description?
 *   B. B2B price coverage — how many products have priceUsdB2b set, vs
 *      relying on session-level b2bDiscountPercent applied dynamically?
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE = "http://localhost:3000";
function pad(s: any, n: number) {
  return String(s).padEnd(n);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log("========================================");
  console.log("A. SEARCH FALSE-POSITIVES");
  console.log("========================================\n");

  const probes = [
    { q: "akrapovic", expected_brand: "Akrapovic" },
    { q: "ilmberger", expected_brand: "Ilmberger Carbon" },
    { q: "brabus", expected_brand: "Brabus" },
    { q: "remus", expected_brand: "Remus" },
    { q: "do88", expected_brand: "do88" },
  ];

  for (const p of probes) {
    const r = await fetch(BASE + `/api/shop/stock/search?source=shop&q=${p.q}`).then((x) =>
      x.json()
    );
    const items = r.data || [];
    const total = r.meta?.totalItems ?? 0;
    const wrongBrand = items.filter(
      (i: any) => i.brand && !i.brand.toLowerCase().includes(p.q.toLowerCase())
    );
    const sample = wrongBrand
      .slice(0, 3)
      .map((i: any) => `[${i.brand}] ${String(i.name).slice(0, 40)}`);
    console.log(
      `  q="${p.q}" → total=${pad(total, 5)} | wrong-brand=${pad(wrongBrand.length, 3)} of ${pad(items.length, 3)} returned`
    );
    if (sample.length > 0) {
      console.log(`     samples: ${sample.join(" | ")}`);
    }
  }

  console.log("\n========================================");
  console.log("B. B2B PRICE COVERAGE");
  console.log("========================================\n");

  // Coverage per brand: how many products have priceUsdB2b set?
  const coverage = await prisma.$queryRaw<
    Array<{
      brand: string;
      total: bigint;
      with_b2b_usd: bigint;
      with_retail_usd: bigint;
      with_retail_eur: bigint;
    }>
  >`
    SELECT
      COALESCE(brand, vendor, '(none)') AS brand,
      COUNT(*)::bigint AS total,
      COUNT("priceUsdB2b") FILTER (WHERE "priceUsdB2b" IS NOT NULL)::bigint AS with_b2b_usd,
      COUNT("priceUsd") FILTER (WHERE "priceUsd" IS NOT NULL)::bigint AS with_retail_usd,
      COUNT("priceEur") FILTER (WHERE "priceEur" IS NOT NULL)::bigint AS with_retail_eur
    FROM "ShopProduct"
    WHERE "isPublished" = true AND status = 'ACTIVE'
    GROUP BY COALESCE(brand, vendor, '(none)')
    HAVING COUNT(*) >= 20
    ORDER BY total DESC
    LIMIT 25
  `;
  console.log("Brand                          | total | retail-USD | retail-EUR | B2B-USD set");
  console.log("-".repeat(82));
  for (const c of coverage) {
    const total = Number(c.total);
    const retUsd = Number(c.with_retail_usd);
    const retEur = Number(c.with_retail_eur);
    const b2b = Number(c.with_b2b_usd);
    const b2bPct = total > 0 ? Math.round((b2b / total) * 100) : 0;
    console.log(
      `${pad(c.brand, 30)} | ${pad(total, 5)} | ${pad(retUsd + "/" + total, 10)} | ${pad(retEur + "/" + total, 10)} | ${pad(b2b + " (" + b2bPct + "%)", 12)}`
    );
  }

  console.log("\n─── Summary ───");
  const totalAll = await prisma.shopProduct.count({
    where: { isPublished: true, status: "ACTIVE" },
  });
  const withB2bAll = await prisma.shopProduct.count({
    where: { isPublished: true, status: "ACTIVE", priceUsdB2b: { not: null } },
  });
  const withRetailAll = await prisma.shopProduct.count({
    where: { isPublished: true, status: "ACTIVE", priceUsd: { not: null } },
  });
  console.log(`  Total published+active products:  ${totalAll}`);
  console.log(
    `  with priceUsd (retail) set:       ${withRetailAll} (${((withRetailAll / totalAll) * 100).toFixed(1)}%)`
  );
  console.log(
    `  with priceUsdB2b explicitly set:  ${withB2bAll} (${((withB2bAll / totalAll) * 100).toFixed(1)}%)`
  );
  console.log(`  → ${totalAll - withB2bAll} products rely on session-level b2bDiscountPercent`);

  // Show example of B2B price calc that's currently in handleShopSearch:
  console.log("\n─── Current B2B pricing logic ───");
  console.log("  IF priceUsdB2b set      → use it directly");
  console.log("  ELSE IF b2bDiscountPercent > 0 (session) → priceUsd × (1 - discount/100)");
  console.log("  ELSE                    → show priceUsd as-is");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
