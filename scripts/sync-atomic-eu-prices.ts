import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

import {
  fetchAtomicEuNetPriceBySku,
  normalizeAtomicSku,
  type AtomicEuPriceResult,
} from "./_lib/atomic-eu-prices";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

type CliOptions = {
  commit: boolean;
  limit: number | null;
  sku: string | null;
  delayMs: number;
  progressEvery: number;
};

type VariantCandidate = {
  id: string;
  sku: string | null;
  priceEurEurope: unknown;
  productId: string;
  product: {
    id: string;
    slug: string;
    brand: string | null;
    vendor: string | null;
    priceEurEurope: unknown;
  };
};

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    commit: false,
    limit: null,
    sku: null,
    delayMs: 250,
    progressEvery: 100,
  };

  for (const arg of argv) {
    if (arg === "--commit") options.commit = true;
    if (arg === "--dry-run") options.commit = false;
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.slice("--limit=".length));
      options.limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    }
    if (arg.startsWith("--sku=")) {
      options.sku = arg.slice("--sku=".length).trim() || null;
    }
    if (arg.startsWith("--delay-ms=")) {
      const parsed = Number(arg.slice("--delay-ms=".length));
      options.delayMs =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : options.delayMs;
    }
    if (arg.startsWith("--progress-every=")) {
      const parsed = Number(arg.slice("--progress-every=".length));
      options.progressEvery =
        Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : options.progressEvery;
    }
  }

  return options;
}

function decimalToNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sleep(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function buildArtifactPath(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "artifacts", "atomic-eu-prices");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${stamp}.json`);
}

function writeArtifact(artifactPath: string, artifact: Record<string, unknown>) {
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

async function syncProductEuropePrices(productIds: string[]) {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (!uniqueProductIds.length) return 0;

  const defaultVariants = await prisma.shopProductVariant.findMany({
    where: {
      productId: { in: uniqueProductIds },
      isDefault: true,
    },
    select: {
      productId: true,
      priceEurEurope: true,
    },
  });

  if (!defaultVariants.length) return 0;

  await prisma.$transaction(
    defaultVariants.map((variant) =>
      prisma.shopProduct.update({
        where: { id: variant.productId },
        data: { priceEurEurope: variant.priceEurEurope },
      })
    )
  );

  return defaultVariants.length;
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const where = options.sku
    ? { sku: options.sku }
    : {
        sku: {
          not: null,
        },
      };

  const variants = (await prisma.shopProductVariant.findMany({
    where,
    orderBy: [{ sku: "asc" }, { position: "asc" }],
    take: options.limit ?? undefined,
    select: {
      id: true,
      sku: true,
      priceEurEurope: true,
      productId: true,
      product: {
        select: {
          id: true,
          slug: true,
          brand: true,
          vendor: true,
          priceEurEurope: true,
        },
      },
    },
  })) as VariantCandidate[];

  const skuGroups = new Map<string, VariantCandidate[]>();
  for (const variant of variants) {
    const normalizedSku = normalizeAtomicSku(variant.sku);
    if (!normalizedSku) continue;
    const existing = skuGroups.get(normalizedSku) ?? [];
    existing.push(variant);
    skuGroups.set(normalizedSku, existing);
  }

  const artifact: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode: options.commit ? "commit" : "dry-run",
    source: "https://atomic-shop.eu",
    marketCountry: "UA",
    exactSkuOnly: true,
    createdProducts: 0,
    touchedFields: ["ShopProductVariant.priceEurEurope", "ShopProduct.priceEurEurope"],
    untouchedFields: [
      "priceEur",
      "priceUsd",
      "priceUah",
      "priceEurB2b",
      "priceUsdB2b",
      "priceUahB2b",
    ],
    totals: {
      scannedVariants: variants.length,
      scannedSkuGroups: skuGroups.size,
      matchedSkuGroups: 0,
      skippedSkuGroups: 0,
      changedVariants: 0,
      changedProducts: 0,
    },
    matches: [] as unknown[],
    skipped: [] as unknown[],
  };

  const totals = artifact.totals as Record<string, number>;
  const matches = artifact.matches as unknown[];
  const skipped = artifact.skipped as unknown[];
  const touchedProductIds: string[] = [];
  const changedProductIds = new Set<string>();
  const artifactPath = buildArtifactPath();
  let processedSkuGroups = 0;

  function markProgress() {
    processedSkuGroups += 1;
    if (processedSkuGroups === skuGroups.size || processedSkuGroups % options.progressEvery === 0) {
      writeArtifact(artifactPath, artifact);
      console.log(
        `[Atomic EU prices] Progress ${processedSkuGroups}/${skuGroups.size}: ` +
          `${totals.matchedSkuGroups} matched, ${totals.skippedSkuGroups} skipped, ` +
          `${totals.changedVariants} variant changes.`
      );
    }
  }

  for (const [normalizedSku, group] of skuGroups.entries()) {
    const sku = group[0]?.sku ?? normalizedSku;
    const result: AtomicEuPriceResult = await fetchAtomicEuNetPriceBySku(sku);

    if (result.status !== "matched") {
      totals.skippedSkuGroups += 1;
      skipped.push({
        sku,
        normalizedSku,
        reason: result.reason,
        message: result.message ?? null,
        variantIds: group.map((variant) => variant.id),
        productIds: Array.from(new Set(group.map((variant) => variant.productId))),
        observations: result.observations,
      });
      await sleep(options.delayMs);
      markProgress();
      continue;
    }

    totals.matchedSkuGroups += 1;
    const nextPrice = roundMoney(result.priceEurNet);
    const changedVariants = group.filter(
      (variant) => decimalToNumber(variant.priceEurEurope) !== nextPrice
    );
    totals.changedVariants += changedVariants.length;
    touchedProductIds.push(...group.map((variant) => variant.productId));
    if (changedVariants.length) {
      for (const productId of group.map((variant) => variant.productId)) {
        changedProductIds.add(productId);
      }
    }

    matches.push({
      sku,
      normalizedSku,
      variantIds: group.map((variant) => variant.id),
      productIds: Array.from(new Set(group.map((variant) => variant.productId))),
      productSlugs: Array.from(new Set(group.map((variant) => variant.product.slug))),
      oldVariantPrices: group.map((variant) => ({
        variantId: variant.id,
        priceEurEurope: decimalToNumber(variant.priceEurEurope),
      })),
      nextPriceEurEurope: nextPrice,
      atomic: {
        handle: result.handle,
        productTitle: result.productTitle,
        vendor: result.vendor,
        variantId: result.variantId,
        variantSku: result.variantSku,
        rawPrice: result.rawPrice,
        sourceUrl: result.sourceUrl,
        observations: result.observations,
      },
    });

    if (options.commit && changedVariants.length) {
      await prisma.shopProductVariant.updateMany({
        where: { id: { in: changedVariants.map((variant) => variant.id) } },
        data: { priceEurEurope: nextPrice },
      });
    }

    await sleep(options.delayMs);
    markProgress();
  }

  if (options.commit) {
    totals.changedProducts = await syncProductEuropePrices(touchedProductIds);
  } else {
    totals.changedProducts = changedProductIds.size;
  }

  writeArtifact(artifactPath, artifact);

  console.log(
    `[Atomic EU prices] ${options.commit ? "Committed" : "Dry run"}: ` +
      `${totals.matchedSkuGroups} matched, ${totals.skippedSkuGroups} skipped, ` +
      `${totals.changedVariants} variant changes.`
  );
  console.log(`[Atomic EU prices] Artifact: ${artifactPath}`);
}

main()
  .catch((error) => {
    console.error("[Atomic EU prices] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
