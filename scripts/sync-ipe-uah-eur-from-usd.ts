#!/usr/bin/env tsx
/**
 * Mirrors priceUsd → priceUah / priceEur for all iPE variants using
 * ShopSettings.currencyRates, then propagates the default-variant USD/UAH/EUR
 * to the parent ShopProduct (top-level) so listing pages and "from $X" badges
 * read consistent prices.
 *
 * Flags:
 *   --apply             write to DB (default: dry-run)
 *
 * Currency-rate semantics: ShopSettings.currencyRates is a JSON map of
 *   { USD: rate, UAH: rate, EUR: rate }
 * where the rates are relative to the same anchor currency (Prisma seed
 * defaults to all-1.0). Conversion: priceX = priceUsd * (rates.X / rates.USD).
 */

import { config } from "dotenv";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient, Prisma } from "@prisma/client";

config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

type Rates = { USD: number; UAH: number; EUR: number };

function parseRates(raw: unknown): Rates {
  const obj = (raw ?? {}) as Record<string, number>;
  const USD = Number(obj.USD ?? 1);
  const UAH = Number(obj.UAH ?? 1);
  const EUR = Number(obj.EUR ?? 1);
  if (!Number.isFinite(USD) || USD <= 0) throw new Error(`Invalid USD rate: ${obj.USD}`);
  if (!Number.isFinite(UAH) || UAH <= 0) throw new Error(`Invalid UAH rate: ${obj.UAH}`);
  if (!Number.isFinite(EUR) || EUR <= 0) throw new Error(`Invalid EUR rate: ${obj.EUR}`);
  return { USD, UAH, EUR };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.shopSettings.findFirst();
  if (!settings) throw new Error("ShopSettings row missing");
  const rates = parseRates(settings.currencyRates);
  const usdToUah = rates.UAH / rates.USD;
  const usdToEur = rates.EUR / rates.USD;

  console.log(`Rates from ShopSettings: USD=${rates.USD} UAH=${rates.UAH} EUR=${rates.EUR}`);
  console.log(`  1 USD = ${usdToUah.toFixed(4)} UAH = ${usdToEur.toFixed(4)} EUR`);
  console.log(`  Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const products = await prisma.shopProduct.findMany({
    where: { brand: { contains: "iPE", mode: "insensitive" } },
    include: { variants: true },
  });

  let variantUpdates = 0;
  let productUpdates = 0;
  let variantsSkippedNoUsd = 0;
  let productsSkippedNoVariant = 0;

  const variantBatch: Array<{
    id: string;
    uah: number;
    eur: number;
    oldUah: number | null;
    oldEur: number | null;
  }> = [];
  const productBatch: Array<{
    id: string;
    slug: string;
    usd: number;
    uah: number;
    eur: number;
    oldUsd: number | null;
  }> = [];

  for (const product of products) {
    // Per-variant UAH/EUR sync
    for (const v of product.variants) {
      if (v.priceUsd == null) {
        variantsSkippedNoUsd += 1;
        continue;
      }
      const usd = Number(v.priceUsd);
      const newUah = round2(usd * usdToUah);
      const newEur = round2(usd * usdToEur);
      const oldUah = v.priceUah != null ? Number(v.priceUah) : null;
      const oldEur = v.priceEur != null ? Number(v.priceEur) : null;
      if (
        oldUah != null &&
        oldEur != null &&
        Math.abs(oldUah - newUah) < 0.01 &&
        Math.abs(oldEur - newEur) < 0.01
      ) {
        continue;
      }
      variantBatch.push({ id: v.id, uah: newUah, eur: newEur, oldUah, oldEur });
      variantUpdates += 1;
    }

    // Product top-level mirror from default (or first) variant
    const defVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
    if (!defVariant || defVariant.priceUsd == null) {
      productsSkippedNoVariant += 1;
      continue;
    }
    const defUsd = Number(defVariant.priceUsd);
    const newUsd = round2(defUsd);
    const newUah = round2(defUsd * usdToUah);
    const newEur = round2(defUsd * usdToEur);
    const oldUsd = product.priceUsd != null ? Number(product.priceUsd) : null;
    const oldUah = product.priceUah != null ? Number(product.priceUah) : null;
    const oldEur = product.priceEur != null ? Number(product.priceEur) : null;
    if (
      oldUsd != null &&
      Math.abs(oldUsd - newUsd) < 0.01 &&
      oldUah != null &&
      Math.abs(oldUah - newUah) < 0.01 &&
      oldEur != null &&
      Math.abs(oldEur - newEur) < 0.01
    ) {
      continue;
    }
    productBatch.push({
      id: product.id,
      slug: product.slug,
      usd: newUsd,
      uah: newUah,
      eur: newEur,
      oldUsd,
    });
    productUpdates += 1;
  }

  console.log(`\nVariants to update (UAH+EUR diff): ${variantUpdates}`);
  console.log(`Variants skipped (no USD): ${variantsSkippedNoUsd}`);
  console.log(`Products to update (top-level): ${productUpdates}`);
  console.log(`Products skipped (no priced default variant): ${productsSkippedNoVariant}`);

  if (variantBatch.length) {
    console.log(`\nSample 10 variant changes:`);
    for (const b of variantBatch.slice(0, 10)) {
      console.log(
        `  variantId=${b.id}  UAH: ${b.oldUah ?? "?"} -> ${b.uah}  EUR: ${b.oldEur ?? "?"} -> ${b.eur}`
      );
    }
  }
  if (productBatch.length) {
    console.log(`\nSample 10 product top-level changes:`);
    for (const b of productBatch.slice(0, 10)) {
      console.log(`  ${b.slug}  USD: ${b.oldUsd ?? "?"} -> ${b.usd}`);
    }
  }

  if (!APPLY) {
    console.log("\n(dry run — pass --apply to write)");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying...`);
  let n = 0;
  for (const b of variantBatch) {
    await prisma.shopProductVariant.update({
      where: { id: b.id },
      data: {
        priceUah: new Prisma.Decimal(b.uah.toFixed(2)),
        priceEur: new Prisma.Decimal(b.eur.toFixed(2)),
      },
    });
    n += 1;
    if (n % 50 === 0) console.log(`  ...${n} variants updated`);
  }
  console.log(`  ${n} variants updated`);

  let m = 0;
  for (const b of productBatch) {
    await prisma.shopProduct.update({
      where: { id: b.id },
      data: {
        priceUsd: new Prisma.Decimal(b.usd.toFixed(2)),
        priceUah: new Prisma.Decimal(b.uah.toFixed(2)),
        priceEur: new Prisma.Decimal(b.eur.toFixed(2)),
      },
    });
    m += 1;
  }
  console.log(`  ${m} products updated`);
  console.log("\nDone.");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
