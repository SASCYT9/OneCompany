/**
 * Increase DO88 EUR prices by 5% and round up to the nearest 5 EUR.
 *
 * Rules:
 *   - Only touches ShopProduct.priceEur and ShopProductVariant.priceEur.
 *   - Selects DO88 products by brand/vendor contains "do88" case-insensitive.
 *   - Defaults to dry-run. Requires --commit to write.
 *   - Writes a backup JSON before commit with old/new prices for products and variants.
 *
 * Usage:
 *   npx tsx --env-file=.env.production.local scripts/do88/increase-prices-5pct.ts
 *   npx tsx --env-file=.env.production.local scripts/do88/increase-prices-5pct.ts --commit
 */

import { Prisma, PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const COMMIT = process.argv.includes("--commit");
const INCREASE_FACTOR = 1.05;
const ROUND_STEP_EUR = 5;
const SAMPLE_LIMIT = 10;

const prisma = new PrismaClient();

type PriceValue = Prisma.Decimal | number | string | null;

type PriceChange = {
  id: string;
  productId?: string;
  slug?: string;
  sku: string | null;
  oldPriceEur: number;
  newPriceEur: number;
  deltaEur: number;
  deltaPct: number;
};

function toNumber(value: PriceValue): number | null {
  if (value === null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function increaseAndRound(oldPrice: number): number {
  return Math.ceil((oldPrice * INCREASE_FACTOR) / ROUND_STEP_EUR) * ROUND_STEP_EUR;
}

function buildChange(row: {
  id: string;
  slug?: string;
  sku: string | null;
  priceEur: PriceValue;
  productId?: string;
}): PriceChange | null {
  const oldPriceEur = toNumber(row.priceEur);
  if (oldPriceEur === null) return null;

  const newPriceEur = increaseAndRound(oldPriceEur);
  const deltaEur = +(newPriceEur - oldPriceEur).toFixed(2);
  const deltaPct = oldPriceEur > 0 ? +((deltaEur / oldPriceEur) * 100).toFixed(2) : 0;

  return {
    id: row.id,
    productId: row.productId,
    slug: row.slug,
    sku: row.sku,
    oldPriceEur,
    newPriceEur,
    deltaEur,
    deltaPct,
  };
}

function summarize(changes: PriceChange[]) {
  const deltas = changes.map((change) => change.deltaEur);
  const oldTotal = changes.reduce((sum, change) => sum + change.oldPriceEur, 0);
  const newTotal = changes.reduce((sum, change) => sum + change.newPriceEur, 0);

  return {
    count: changes.length,
    minDeltaEur: deltas.length ? Math.min(...deltas) : 0,
    maxDeltaEur: deltas.length ? Math.max(...deltas) : 0,
    oldTotalEur: +oldTotal.toFixed(2),
    newTotalEur: +newTotal.toFixed(2),
    totalDeltaEur: +(newTotal - oldTotal).toFixed(2),
  };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupPathFor(ts: string) {
  return path.join(process.cwd(), "backups", `do88-price-increase-${ts}.json`);
}

async function main() {
  const productRows = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { brand: { contains: "do88", mode: "insensitive" } },
        { vendor: { contains: "do88", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      brand: true,
      vendor: true,
      priceEur: true,
      priceUsd: true,
      priceUah: true,
      priceEurB2b: true,
      priceUsdB2b: true,
      priceUahB2b: true,
      compareAtEur: true,
      compareAtUsd: true,
      compareAtUah: true,
      compareAtEurB2b: true,
      compareAtUsdB2b: true,
      compareAtUahB2b: true,
    },
    orderBy: [{ sku: "asc" }, { slug: "asc" }],
  });

  const productIds = productRows.map((row) => row.id);
  const variantRows = productIds.length
    ? await prisma.shopProductVariant.findMany({
        where: { productId: { in: productIds } },
        select: {
          id: true,
          productId: true,
          sku: true,
          priceEur: true,
          priceUsd: true,
          priceUah: true,
          priceEurB2b: true,
          priceUsdB2b: true,
          priceUahB2b: true,
          compareAtEur: true,
          compareAtUsd: true,
          compareAtUah: true,
          compareAtEurB2b: true,
          compareAtUsdB2b: true,
          compareAtUahB2b: true,
        },
        orderBy: [{ sku: "asc" }, { id: "asc" }],
      })
    : [];

  const nullablePriceFields = [
    "priceUsd",
    "priceUah",
    "priceEurB2b",
    "priceUsdB2b",
    "priceUahB2b",
    "compareAtEur",
    "compareAtUsd",
    "compareAtUah",
    "compareAtEurB2b",
    "compareAtUsdB2b",
    "compareAtUahB2b",
  ] as const;

  const nonNullProductSideFields = nullablePriceFields.filter((field) =>
    productRows.some((row) => row[field] !== null)
  );
  const nonNullVariantSideFields = nullablePriceFields.filter((field) =>
    variantRows.some((row) => row[field] !== null)
  );

  const productChanges = productRows
    .map(buildChange)
    .filter((change): change is PriceChange => Boolean(change));
  const variantChanges = variantRows
    .map(buildChange)
    .filter((change): change is PriceChange => Boolean(change));

  const productSummary = summarize(productChanges);
  const variantSummary = summarize(variantChanges);
  const sample = productChanges.slice(0, SAMPLE_LIMIT).map((change) => ({
    sku: change.sku,
    slug: change.slug,
    oldPriceEur: change.oldPriceEur,
    newPriceEur: change.newPriceEur,
    deltaEur: change.deltaEur,
    deltaPct: change.deltaPct,
  }));

  const report = {
    mode: COMMIT ? "commit" : "dry-run",
    rule: {
      increaseFactor: INCREASE_FACTOR,
      round: `ceil(price * ${INCREASE_FACTOR} / ${ROUND_STEP_EUR}) * ${ROUND_STEP_EUR}`,
      touchedFields: ["ShopProduct.priceEur", "ShopProductVariant.priceEur"],
    },
    counts: {
      selectedProducts: productRows.length,
      productsWithPriceEur: productChanges.length,
      selectedVariants: variantRows.length,
      variantsWithPriceEur: variantChanges.length,
    },
    sideFieldCheck: {
      nonNullProductSideFields,
      nonNullVariantSideFields,
    },
    productSummary,
    variantSummary,
    sample,
  };

  console.log(JSON.stringify(report, null, 2));

  if (nonNullProductSideFields.length || nonNullVariantSideFields.length) {
    throw new Error(
      "Unexpected non-null side price fields found for DO88. Aborting without writes."
    );
  }

  if (!COMMIT) {
    console.log("\nDry run only. Re-run with --commit to write.");
    return;
  }

  const ts = timestamp();
  const backupPath = backupPathFor(ts);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        report,
        products: productChanges,
        variants: variantChanges,
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\nBackup written: ${backupPath}`);

  await prisma.$transaction(
    async (tx) => {
      for (const change of productChanges) {
        await tx.shopProduct.update({
          where: { id: change.id },
          data: { priceEur: new Prisma.Decimal(change.newPriceEur) },
        });
      }

      for (const change of variantChanges) {
        await tx.shopProductVariant.update({
          where: { id: change.id },
          data: { priceEur: new Prisma.Decimal(change.newPriceEur) },
        });
      }
    },
    { maxWait: 30_000, timeout: 180_000 }
  );

  console.log(
    `Committed ${productChanges.length} product updates and ${variantChanges.length} variant updates.`
  );
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
