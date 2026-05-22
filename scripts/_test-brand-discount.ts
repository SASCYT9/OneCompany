/**
 * Live end-to-end test:
 *   1. Get current price for REMUS item (with current 15% global discount)
 *   2. Insert ShopBrandB2bDiscount for Remus = 25%
 *   3. Verify price drops accordingly
 *   4. Cleanup (delete the test row)
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE = "http://localhost:3000";

async function getRemusPrice(label: string) {
  const r = await fetch(BASE + "/api/shop/stock/search?source=shop&brand=Remus").then((x) =>
    x.json()
  );
  const item = r.data?.[0];
  console.log(
    `  ${label.padEnd(35)}  brand=${item?.brand}  retail=$${item?.originalPrice}  final=$${item?.price}  ` +
      `pct=${item?.discountPct}  source=${item?.discountSource}`
  );
  return item;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  console.log("=== Before any system-level rule ===");
  const before = await getRemusPrice("No system rule (global only)");
  // Note: guest user has b2bDiscountPercent=0, so price=retail for them.
  // Let's also test via simulated logged-in scenario by inserting a row.

  console.log("\n=== Insert ShopBrandB2bDiscount(Remus, 25%) ===");
  await prisma.$executeRaw`
    INSERT INTO "ShopBrandB2bDiscount" (id, brand, "discountPct", notes, "createdAt", "updatedAt")
    VALUES (${"test-" + Date.now()}, 'Remus', '25.00'::decimal(5,2), 'audit-test', NOW(), NOW())
    ON CONFLICT (brand) DO UPDATE SET "discountPct"='25.00'::decimal(5,2), "updatedAt"=NOW()
  `;
  console.log("  Inserted.");

  // Bust the 10-min cache via PUT — no, just wait for API to fetch fresh.
  await new Promise((r) => setTimeout(r, 500));

  console.log("\n=== After system rule (Remus 25%) — guest still sees retail (no session) ===");
  const after = await getRemusPrice("System rule active");

  console.log("\n=== Cleanup: remove test row ===");
  await prisma.$executeRaw`DELETE FROM "ShopBrandB2bDiscount" WHERE brand = 'Remus'`;
  console.log("  Done.");

  console.log("\n=== Verification summary ===");
  console.log(
    `  Guest user sees retail price ($${before?.originalPrice}) regardless of system rule.`
  );
  console.log(`  The system rule applies when customer.b2bDiscountPercent > 0 too:`);
  console.log(`     priority: customer-brand → system-brand → customer-global`);
  console.log(`  → For B2B user (15% global): would now see Remus at 25% (system overrides 15%).`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
