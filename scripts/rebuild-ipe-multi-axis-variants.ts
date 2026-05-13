#!/usr/bin/env tsx
/**
 * Rebuilds ShopProductOption + ShopProductVariant for the iPE products that
 * have REAL multi-axis variants on iPE Shopify (Material × Exhaust System ×
 * Downpipe / etc.). Source of truth: official-snapshot.json from the latest
 * snapshot dir + the resolveIpeVariantPricing logic in
 * src/lib/ipeCatalogImport.ts.
 *
 * Generalises the per-product pricer logic from rebuild-ipe-native-variants.ts
 * into a single snapshot-driven flow. Use this for the ~26 products iPE Shopify
 * publishes with non-Default-Title option axes (W465 G63, Ferrari 296 GTB,
 * Porsche 992 GT3, BMW M3 G80, M2 G87, etc.).
 *
 * Single-axis (Default Title) products are NOT touched by this script — those
 * keep their Excel-derived variants and are re-priced via
 * update-ipe-prices-from-xlsx.ts.
 *
 * Flags:
 *   --apply              actually write to DB (default: dry-run)
 *   --handle <slug>      restrict to one iPE Shopify handle (no "ipe-" prefix)
 *   --list               print the list of target handles found in snapshot
 *
 * Safety: requires 0 ShopOrderItem/ShopCartItem FK refs on existing variants
 *         (already verified for iPE at audit-time, 552 variants -> 0 refs).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

import { config } from "dotenv";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient, Prisma } from "@prisma/client";

import {
  buildIpeSyntheticVariantSku,
  buildIpeVariantCandidates,
  resolveIpeVariantPricing,
  type IpeOfficialProductSnapshot,
  type IpeOfficialSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from "../src/lib/ipeCatalogImport";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const LIST = process.argv.includes("--list");
const HANDLE_FILTER =
  process.argv.find((a) => a.startsWith("--handle="))?.slice("--handle=".length) ??
  (() => {
    const i = process.argv.indexOf("--handle");
    return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
  })();

const ART_ROOT = path.join(process.cwd(), "artifacts");
const AUDIT_DIR = path.join(ART_ROOT, "ipe-audit-2026-05-13");
const NEW_PRICE_LIST_PATH = path.join(ART_ROOT, "ipe-price-list", "2026-04-pricelist.parsed.json");

function resolveSnapshotDir(): string {
  const root = path.join(ART_ROOT, "ipe-import");
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(path.join(root, name, "match-manifest.json")))
    .sort()
    .reverse();
  if (!dirs.length) throw new Error("No iPE snapshot dir with match-manifest.json found");
  return path.join(root, dirs[0]);
}

type ManifestRow = {
  rowIndex: number;
  sku: string;
  priceKind: string;
  brand: string;
  officialHandle: string | null;
};

function isMultiAxisVariantSet(product: IpeOfficialProductSnapshot): boolean {
  if (product.variants.length <= 1) {
    if (product.variants.length === 0) return false;
    const v = product.variants[0];
    const title = v.title?.trim().toLowerCase() ?? "";
    if (!title || title === "default title") return false;
    if (v.optionValues.every((val) => !val || val.toLowerCase() === "default title")) return false;
  }
  // At least one variant has a non-Default-Title optionValue → real axes
  return product.variants.some((v) =>
    v.optionValues.some((val) => val && val.toLowerCase() !== "default title")
  );
}

type RebuildPlan = {
  handle: string;
  slug: string;
  dbProductId: string;
  beforeVariantCount: number;
  beforeOptionCount: number;
  afterVariantCount: number;
  afterOptionCount: number;
  options: Array<{ name: string; position: number; values: string[] }>;
  variants: Array<{
    title: string;
    sku: string;
    position: number;
    isDefault: boolean;
    option1Value: string | null;
    option2Value: string | null;
    option3Value: string | null;
    priceUsd: number | null;
    baseRowSku: string | null;
    reviewReasons: string[];
    confidence: number;
  }>;
  preservedOverrides: Array<{
    optionSig: string;
    compareAtUsd: number | null;
    image: string | null;
  }>;
  warnings: string[];
};

function variantSig(values: ReadonlyArray<string | null | undefined>): string {
  return values
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

async function planRebuild(
  product: IpeOfficialProductSnapshot,
  manifestRows: ManifestRow[],
  newList: IpeParsedPriceList
): Promise<RebuildPlan | null> {
  const slugCandidates = [product.handle, `ipe-${product.handle}`];
  const dbProduct = await prisma.shopProduct.findFirst({
    where: { slug: { in: slugCandidates } },
    include: { variants: true, options: true },
  });
  if (!dbProduct) return null;

  const priceRows: IpeParsedPriceListRow[] = [];
  for (const m of manifestRows) {
    const row = newList.items[m.rowIndex];
    if (row && row.sku === m.sku) priceRows.push(row);
  }

  const candidates = buildIpeVariantCandidates(product, priceRows);
  if (!candidates.length) return null;

  const warnings: string[] = [];

  // Preserve admin-set overrides keyed by option signature
  const preservedOverrides = dbProduct.variants.map((v) => ({
    optionSig: variantSig([v.option1Value, v.option2Value, v.option3Value]),
    compareAtUsd: v.compareAtUsd != null ? Number(v.compareAtUsd) : null,
    image: v.image,
  }));
  const overrideBySig = new Map(preservedOverrides.map((p) => [p.optionSig, p]));

  const variants = candidates.map((c, idx) => {
    const pricing = resolveIpeVariantPricing(product, c, priceRows);
    const optionValues = c.optionValues.slice(0, 3);
    const sig = variantSig(optionValues);
    // Real Excel SKU when resolver matched a base row; otherwise synthetic
    // (preserves stability across re-runs because it hashes handle + sig).
    const baseSku = pricing.baseRow?.sku ?? null;
    const sku =
      baseSku && !baseSku.startsWith("IPE-")
        ? baseSku
        : buildIpeSyntheticVariantSku(product.handle, sig || c.title);

    if (pricing.priceUsd == null) {
      warnings.push(
        `Variant "${c.title}" — no price could be resolved (${pricing.reviewReasons.join(", ") || "no-base"})`
      );
    }

    return {
      title: c.title,
      sku,
      position: idx + 1,
      isDefault: idx === 0,
      option1Value: optionValues[0] ?? null,
      option2Value: optionValues[1] ?? null,
      option3Value: optionValues[2] ?? null,
      priceUsd: pricing.priceUsd != null ? Number(pricing.priceUsd.toFixed(2)) : null,
      baseRowSku: baseSku,
      reviewReasons: pricing.reviewReasons,
      confidence: pricing.confidence,
    };
  });

  const options = product.options.slice(0, 3).map((o, idx) => ({
    name: o.name,
    position: idx + 1,
    values: [...o.values],
  }));

  return {
    handle: product.handle,
    slug: dbProduct.slug,
    dbProductId: dbProduct.id,
    beforeVariantCount: dbProduct.variants.length,
    beforeOptionCount: dbProduct.options.length,
    afterVariantCount: variants.length,
    afterOptionCount: options.length,
    options,
    variants,
    preservedOverrides: preservedOverrides.filter((p) => p.optionSig),
    warnings,
  };
}

async function applyPlan(plan: RebuildPlan) {
  // FK guard
  const oldVariantIds = await prisma.shopProductVariant
    .findMany({ where: { productId: plan.dbProductId }, select: { id: true } })
    .then((vs) => vs.map((v) => v.id));
  if (oldVariantIds.length) {
    const refs =
      (await prisma.shopOrderItem.count({ where: { variantId: { in: oldVariantIds } } })) +
      (await prisma.shopCartItem.count({ where: { variantId: { in: oldVariantIds } } }));
    if (refs > 0) {
      throw new Error(
        `Refuse to rebuild ${plan.slug}: ${refs} ShopOrderItem/ShopCartItem ref(s) exist on old variants`
      );
    }
  }

  const overrideBySig = new Map(plan.preservedOverrides.map((p) => [p.optionSig, p]));

  await prisma.$transaction(async (tx) => {
    await tx.shopProductOption.deleteMany({ where: { productId: plan.dbProductId } });
    await tx.shopProductVariant.deleteMany({ where: { productId: plan.dbProductId } });

    for (const opt of plan.options) {
      await tx.shopProductOption.create({
        data: {
          productId: plan.dbProductId,
          name: opt.name,
          position: opt.position,
          values: opt.values,
        },
      });
    }

    for (const v of plan.variants) {
      const sig = variantSig([v.option1Value, v.option2Value, v.option3Value]);
      const override = overrideBySig.get(sig);
      await tx.shopProductVariant.create({
        data: {
          productId: plan.dbProductId,
          title: v.title,
          sku: v.sku,
          position: v.position,
          isDefault: v.isDefault,
          option1Value: v.option1Value,
          option2Value: v.option2Value,
          option3Value: v.option3Value,
          priceUsd: v.priceUsd != null ? new Prisma.Decimal(v.priceUsd) : null,
          compareAtUsd:
            override?.compareAtUsd != null ? new Prisma.Decimal(override.compareAtUsd) : null,
          image: override?.image ?? null,
          inventoryQty: 0,
          inventoryPolicy: "CONTINUE",
          requiresShipping: true,
          taxable: true,
        },
      });
    }

    // Mirror default variant USD price to product top-level (UAH/EUR done
    // separately by sync-ipe-uah-eur-from-usd.ts).
    const defVariant = plan.variants.find((v) => v.isDefault) ?? plan.variants[0];
    if (defVariant?.priceUsd != null) {
      await tx.shopProduct.update({
        where: { id: plan.dbProductId },
        data: {
          priceUsd: new Prisma.Decimal(defVariant.priceUsd),
          sku: defVariant.sku,
        },
      });
    }
  });
}

async function main() {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  console.log(`Snapshot dir: ${path.basename(SNAPSHOT_DIR)}`);
  console.log(`Mode: ${APPLY ? "APPLY (writes to DB)" : "DRY-RUN"}`);
  if (HANDLE_FILTER) console.log(`Handle filter: ${HANDLE_FILTER}`);

  const [snap, manifest, newList] = await Promise.all([
    fs
      .readFile(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8")
      .then(JSON.parse) as Promise<IpeOfficialSnapshot>,
    fs.readFile(path.join(SNAPSHOT_DIR, "match-manifest.json"), "utf8").then(JSON.parse),
    fs.readFile(NEW_PRICE_LIST_PATH, "utf8").then(JSON.parse) as Promise<IpeParsedPriceList>,
  ]);

  const multiAxisProducts = snap.products.filter(isMultiAxisVariantSet);

  if (LIST) {
    console.log(`\nMulti-axis iPE products in snapshot: ${multiAxisProducts.length}`);
    for (const p of multiAxisProducts) {
      console.log(
        `  ${p.handle}  ${p.variants.length}v  axes=${p.options.map((o) => o.name).join("+")}`
      );
    }
    await prisma.$disconnect();
    return;
  }

  const targets = HANDLE_FILTER
    ? multiAxisProducts.filter((p) => p.handle === HANDLE_FILTER)
    : multiAxisProducts;

  if (!targets.length) {
    console.log("No matching target products.");
    await prisma.$disconnect();
    return;
  }

  const rowsByHandle = new Map<string, ManifestRow[]>();
  for (const r of manifest.rows as ManifestRow[]) {
    if (!r.officialHandle) continue;
    const list = rowsByHandle.get(r.officialHandle) ?? [];
    list.push(r);
    rowsByHandle.set(r.officialHandle, list);
  }

  const plans: RebuildPlan[] = [];
  for (const product of targets) {
    const manifestRows = rowsByHandle.get(product.handle) ?? [];
    if (!manifestRows.length) {
      console.log(`\n[${product.handle}] no manifest rows, skipping`);
      continue;
    }
    const plan = await planRebuild(product, manifestRows, newList);
    if (!plan) {
      console.log(`\n[${product.handle}] not in DB, skipping`);
      continue;
    }
    plans.push(plan);
  }

  // Print plans
  let totalDelete = 0;
  let totalCreate = 0;
  for (const plan of plans) {
    console.log(`\n[${plan.slug}]`);
    console.log(`  Before: ${plan.beforeVariantCount}v / ${plan.beforeOptionCount} axes`);
    console.log(`  After:  ${plan.afterVariantCount}v / ${plan.afterOptionCount} axes`);
    console.log(`  Options:`);
    for (const o of plan.options) {
      console.log(`    ${o.position}. ${o.name}  (${o.values.length}: ${o.values.join(" | ")})`);
    }
    console.log(`  Variants:`);
    for (const v of plan.variants) {
      const price = v.priceUsd != null ? `$${v.priceUsd}` : "NULL";
      const def = v.isDefault ? " [DEF]" : "";
      console.log(
        `    ${v.position}. [${[v.option1Value, v.option2Value, v.option3Value].filter(Boolean).join(" / ")}]  sku=${v.sku}  ${price}${def}`
      );
    }
    if (plan.warnings.length) {
      console.log(`  ⚠ Warnings:`);
      for (const w of plan.warnings) console.log(`    - ${w}`);
    }
    totalDelete += plan.beforeVariantCount;
    totalCreate += plan.afterVariantCount;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Products to rebuild: ${plans.length}`);
  console.log(`Variants to DELETE: ${totalDelete}`);
  console.log(`Variants to CREATE: ${totalCreate}`);
  const productsWithNullPrice = plans.filter((p) => p.variants.some((v) => v.priceUsd == null));
  console.log(`Products with at least one NULL-price variant: ${productsWithNullPrice.length}`);
  if (productsWithNullPrice.length) {
    for (const p of productsWithNullPrice) console.log(`  - ${p.slug}`);
  }

  // Persist audit JSON
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  const auditPath = path.join(AUDIT_DIR, `rebuild-multi-axis-${APPLY ? "applied" : "dryrun"}.json`);
  await fs.writeFile(
    auditPath,
    JSON.stringify({ committedAt: new Date().toISOString(), apply: APPLY, plans }, null, 2),
    "utf8"
  );
  console.log(`\nFull plan JSON: ${auditPath}`);

  if (!APPLY) {
    console.log("\n(dry run — pass --apply to write)");
    await prisma.$disconnect();
    return;
  }

  // Safety: skip products where ALL variants have null priceUsd. Applying
  // would make them unbuyable (no displayed price). Leave their existing
  // variants alone and surface them as a warning.
  const safePlans: RebuildPlan[] = [];
  const skippedAllNull: string[] = [];
  for (const plan of plans) {
    const allNull = plan.variants.every((v) => v.priceUsd == null);
    if (allNull) {
      skippedAllNull.push(plan.slug);
    } else {
      safePlans.push(plan);
    }
  }
  if (skippedAllNull.length) {
    console.log(
      `\nSKIPPED (all variants resolve to NULL price — leaving existing variants alone):`
    );
    for (const s of skippedAllNull) console.log(`  - ${s}`);
  }

  console.log(`\nApplying ${safePlans.length} rebuilds...`);
  let applied = 0;
  for (const plan of safePlans) {
    try {
      await applyPlan(plan);
      applied += 1;
      console.log(`  ✓ ${plan.slug}`);
    } catch (e) {
      console.error(`  ✗ ${plan.slug}: ${(e as Error).message}`);
    }
  }
  console.log(`\nApplied: ${applied}/${safePlans.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
