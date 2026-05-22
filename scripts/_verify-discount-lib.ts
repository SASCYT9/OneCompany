import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const lib = await import("../src/lib/shopBrandB2bDiscounts");
  console.log("exports:", Object.keys(lib).sort().join(", "));
  console.log("typeof listBrandB2bDiscounts:", typeof lib.listBrandB2bDiscounts);
  const rows = await lib.listBrandB2bDiscounts(prisma);
  console.log("Current ShopBrandB2bDiscount rows:", rows.length);
  console.log('normalize("  Akrapovic  ") →', lib.normalizeBrandKey("  Akrapovic  "));
  console.log(
    "resolve customer-brand wins:",
    lib.resolveBrandDiscount(
      "Akrapovic",
      new Map([["akrapovic", 20]]),
      new Map([["akrapovic", 15]]),
      10
    )
  );
  console.log(
    "resolve system-brand:",
    lib.resolveBrandDiscount("Brembo", new Map(), new Map([["brembo", 15]]), 10)
  );
  console.log(
    "resolve global fallback:",
    lib.resolveBrandDiscount("XYZ", new Map(), new Map(), 10)
  );
  console.log("resolve none:", lib.resolveBrandDiscount("XYZ", new Map(), new Map(), 0));

  // Live insert + cleanup
  await lib.upsertBrandB2bDiscount(prisma, { brand: "Akrapovic", discountPct: 17, notes: "audit" });
  const after = await lib.listBrandB2bDiscounts(prisma);
  console.log("After upsert:", after);
  await lib.deleteBrandB2bDiscount(prisma, "Akrapovic");
  console.log("After delete:", await lib.listBrandB2bDiscounts(prisma));
  await prisma.$disconnect();
}
main().catch(console.error);
