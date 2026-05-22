/**
 * Seed script for the One Company Forged brand.
 *
 * What it does:
 *   1. Adds (or updates) the `brandShippingRules` row for "One Company Forged"
 *      in ShopSettings JSON, configured as `manual_quote` — every forged
 *      order goes through manual freight calculation by an operator.
 *   2. Logs the configured brand logistics overrides (these come from a
 *      static export in src/lib/shippingCalc.ts and don't need DB writes).
 *   3. Lists the design catalog (static TS data, no DB writes — the
 *      designs live in src/data/forgedDesigns.ts).
 *
 * Run modes:
 *   --dry-run (default): prints what WOULD change, no DB writes
 *   --commit            : performs the brandShippingRules upsert
 *
 * Usage:
 *   npx tsx scripts/seed-forged-brand.ts                # dry run
 *   npx tsx scripts/seed-forged-brand.ts --commit       # actually write
 *
 * Safety: this script does NOT migrate the Prisma schema. It only
 * touches the existing ShopSettings.brandShippingRules JSON column.
 * Per project policy (single shared production DB), always run in
 * dry-run first and review the diff before --commit.
 */

import { PrismaClient } from "@prisma/client";

import { FORGED_BRAND_NAME, FORGED_DESIGNS } from "../src/data/forgedDesigns";

const prisma = new PrismaClient();

const FORGED_SHIPPING_RULE = {
  id: `rule-${Date.now().toString(36)}-forged`,
  brandName: FORGED_BRAND_NAME,
  mode: "manual_quote" as const,
  value: 0,
  warehouseRatePerKg: 0,
  currency: "EUR" as const,
  enabled: true,
  brackets: [],
};

type ExistingRule = {
  id: string;
  brandName: string;
  mode: string;
  value: number;
  warehouseRatePerKg: number;
  currency: string;
  enabled: boolean;
  brackets?: Array<{ maxAmount: number | null; fee: number }>;
};

async function main() {
  const isCommit = process.argv.includes("--commit");
  const mode = isCommit ? "COMMIT" : "DRY-RUN";

  console.log(`\nForged brand seed — mode: ${mode}\n`);

  console.log("--- Static design catalog ---");
  for (const d of FORGED_DESIGNS) {
    console.log(
      `  · ${d.slug}  ${d.nameEn.padEnd(28)}  base €${d.basePriceEur}  lead ${d.leadTimeWeeksAl}w  ${
        d.isReplicaStyle ? "(replica-style)" : "(original)"
      }`
    );
  }
  console.log(`  total: ${FORGED_DESIGNS.length} designs\n`);

  console.log("--- Brand shipping rule ---");
  console.log("  target ShopSettings.brandShippingRules entry:");
  console.log("  ", JSON.stringify(FORGED_SHIPPING_RULE, null, 2).split("\n").join("\n  "));
  console.log("");

  const settings = await prisma.shopSettings.findFirst({
    select: { key: true, brandShippingRules: true },
  });

  if (!settings) {
    console.log("⚠ No ShopSettings row exists yet. Aborting — bootstrap base settings first.");
    process.exit(1);
  }

  const existingRules: ExistingRule[] = Array.isArray(settings.brandShippingRules)
    ? (settings.brandShippingRules as unknown as ExistingRule[])
    : [];

  const alreadyHas = existingRules.find(
    (r) => r.brandName?.toLowerCase() === FORGED_BRAND_NAME.toLowerCase()
  );

  if (alreadyHas) {
    console.log(
      `→ existing rule found for "${FORGED_BRAND_NAME}" (id=${alreadyHas.id}, mode=${alreadyHas.mode}). ` +
        `Will UPDATE to mode=manual_quote.`
    );
  } else {
    console.log(`→ no existing rule for "${FORGED_BRAND_NAME}". Will INSERT.`);
  }

  const nextRules: ExistingRule[] = alreadyHas
    ? existingRules.map((r) =>
        r.brandName?.toLowerCase() === FORGED_BRAND_NAME.toLowerCase()
          ? { ...r, ...FORGED_SHIPPING_RULE, id: r.id }
          : r
      )
    : [...existingRules, FORGED_SHIPPING_RULE];

  if (!isCommit) {
    console.log("\n[dry-run] no DB writes performed. Re-run with --commit to apply.\n");
    await prisma.$disconnect();
    return;
  }

  await prisma.shopSettings.update({
    where: { key: settings.key },
    data: {
      // brandShippingRules is Json; cast to satisfy Prisma input type
      brandShippingRules: nextRules as unknown as object,
    },
  });

  console.log("\n✓ Wrote brandShippingRules. Forged brand ready for manual_quote shipping mode.\n");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
