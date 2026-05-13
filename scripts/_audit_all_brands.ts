import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

(async () => {
  const products = await p.shopProduct.findMany({
    include: {
      variants: {
        select: {
          sku: true,
          priceUsd: true,
          priceUah: true,
          option1Value: true,
          option2Value: true,
          option3Value: true,
        },
      },
      options: { select: { name: true } },
    },
  });

  type Bucket = {
    total: number;
    published: number;
    unpublished: number;
    nullPriceUsd: number;
    nullPriceUah: number;
    syntheticSkuOnly: number;
    realSku: number;
    noSku: number;
    flatPriceProducts: number; // multi-variant products where all variants share same price
    avgVariantsPerProduct: number;
    totalVariants: number;
    examplesSyntheticOnly: string[];
    examplesNullPrice: string[];
    examplesFlat: string[];
  };

  const buckets = new Map<string, Bucket>();

  for (const prod of products) {
    const brandKey = (prod.brand ?? "(none)").trim() || "(none)";
    if (!buckets.has(brandKey)) {
      buckets.set(brandKey, {
        total: 0,
        published: 0,
        unpublished: 0,
        nullPriceUsd: 0,
        nullPriceUah: 0,
        syntheticSkuOnly: 0,
        realSku: 0,
        noSku: 0,
        flatPriceProducts: 0,
        avgVariantsPerProduct: 0,
        totalVariants: 0,
        examplesSyntheticOnly: [],
        examplesNullPrice: [],
        examplesFlat: [],
      });
    }
    const b = buckets.get(brandKey)!;
    b.total += 1;
    if (prod.isPublished) b.published += 1;
    else b.unpublished += 1;
    if (prod.priceUsd == null) b.nullPriceUsd += 1;
    if (prod.priceUah == null) b.nullPriceUah += 1;
    b.totalVariants += prod.variants.length;

    let hasSynth = false,
      hasReal = false,
      hasSku = false;
    for (const v of prod.variants) {
      if (!v.sku) continue;
      hasSku = true;
      if (v.sku.startsWith("IPE-") || /^[A-Z]+-[A-Z0-9]{8,}$/.test(v.sku)) hasSynth = true;
      else hasReal = true;
    }
    if (!hasSku) b.noSku += 1;
    else if (hasSynth && !hasReal) {
      b.syntheticSkuOnly += 1;
      if (b.examplesSyntheticOnly.length < 3) b.examplesSyntheticOnly.push(prod.slug);
    } else if (hasReal) {
      b.realSku += 1;
    }

    if (prod.priceUsd == null && b.examplesNullPrice.length < 3) {
      b.examplesNullPrice.push(prod.slug);
    }

    // Flat-price check: multi-variant product where all variants have identical price
    if (prod.variants.length >= 2) {
      const priceSet = new Set(prod.variants.map((v) => v.priceUsd?.toString() ?? "null"));
      const optsSet = new Set(
        prod.variants.map((v) =>
          [v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(" | ")
        )
      );
      if (priceSet.size === 1 && optsSet.size > 1) {
        b.flatPriceProducts += 1;
        if (b.examplesFlat.length < 3) b.examplesFlat.push(prod.slug);
      }
    }
  }

  const rows = Array.from(buckets.entries())
    .map(([brand, b]) => ({
      brand,
      total: b.total,
      published: b.published,
      unpub: b.unpublished,
      noPriceUsd: b.nullPriceUsd,
      noPriceUah: b.nullPriceUah,
      synthOnly: b.syntheticSkuOnly,
      noSku: b.noSku,
      flat: b.flatPriceProducts,
      vars: b.totalVariants,
      avg: b.total > 0 ? Math.round((b.totalVariants / b.total) * 10) / 10 : 0,
      _b: b,
    }))
    .sort((a, b) => b.total - a.total);

  console.log("\n=== Brand audit ===");
  console.log(
    "brand".padEnd(28),
    "total".padStart(6),
    "pub".padStart(5),
    "unpub".padStart(6),
    "noUsd".padStart(6),
    "noUah".padStart(6),
    "syntO".padStart(6),
    "noSku".padStart(6),
    "flat".padStart(5),
    "vars".padStart(6),
    "avg".padStart(5)
  );
  for (const r of rows) {
    console.log(
      r.brand.padEnd(28),
      String(r.total).padStart(6),
      String(r.published).padStart(5),
      String(r.unpub).padStart(6),
      String(r.noPriceUsd).padStart(6),
      String(r.noPriceUah).padStart(6),
      String(r.synthOnly).padStart(6),
      String(r.noSku).padStart(6),
      String(r.flat).padStart(5),
      String(r.vars).padStart(6),
      String(r.avg).padStart(5)
    );
  }

  console.log("\n=== Issue samples (per brand, top problematic) ===");
  for (const r of rows.filter((r) => r.synthOnly + r.noPriceUsd + r.flat > 0).slice(0, 30)) {
    console.log(
      `\n[${r.brand}] total=${r.total}  synthOnly=${r.synthOnly} noPriceUsd=${r.noPriceUsd} flat=${r.flat}`
    );
    if (r._b.examplesSyntheticOnly.length) console.log(`  synth ex:`, r._b.examplesSyntheticOnly);
    if (r._b.examplesNullPrice.length) console.log(`  no-price ex:`, r._b.examplesNullPrice);
    if (r._b.examplesFlat.length) console.log(`  flat ex:`, r._b.examplesFlat);
  }

  await p.$disconnect();
})();
