#!/usr/bin/env tsx
/**
 * Excel-driven rebuild of iPE products whose variant structure didn't come
 * from the iPE Shopify snapshot. Covers two scopes:
 *
 *   --scope=premium        Premium-tier products (Ferrari Purosangue,
 *                          Lamborghini Revuelto, Porsche 992 GT3 Pro) — not
 *                          published as multi-axis on iPE Shopify but priced
 *                          in the Excel "2026 Premium products" sheet.
 *
 *   --scope=synthetic      The ~34 single-axis products whose DB variants all
 *                          carry IPE-* synthetic SKUs (no link back to Excel).
 *
 *   --scope=all            Both of the above (default).
 *
 * For each target we:
 *   1. Pull priceRows by manifest mapping when available, else by brand+model
 *      token match against parsed.items.
 *   2. Group "absolute" rows by section signature (Downpipe / Cat Back System
 *      / Full System / Header Back / Pro Version Full System / ...) — these
 *      become the BASE axis values.
 *   3. Compute the Tips axis via selectIpeTipOptions() (per-model > universal
 *      Add-on fallback).
 *   4. Materialize an N x M variant matrix; each variant gets the section's
 *      real Excel SKU (or the per-model tip SKU if more specific) and price
 *      = computeIpeRetailPrice(section.msrp + tip.msrpDelta).
 *
 * Flags:
 *   --apply              write to DB (default: dry-run)
 *   --handle <slug>      restrict to one DB product slug (without "ipe-" or
 *                        the iPE Shopify handle is also accepted)
 *   --scope=premium|synthetic|all  see above
 */

import fs from "node:fs/promises";
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";

import { config } from "dotenv";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient, Prisma } from "@prisma/client";

import {
  computeIpeRetailPrice,
  inferQuadTipsFromText,
  selectIpeTipOptions,
  type IpeAddonsCatalog,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
  type IpeTipOption,
} from "../src/lib/ipeCatalogImport";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const HANDLE_FILTER =
  process.argv.find((a) => a.startsWith("--handle="))?.slice("--handle=".length) ?? null;
const SCOPE_ARG =
  process.argv.find((a) => a.startsWith("--scope="))?.slice("--scope=".length) ?? "all";

const ART_ROOT = path.join(process.cwd(), "artifacts");
const AUDIT_DIR = path.join(ART_ROOT, "ipe-audit-2026-05-13");
const NEW_PRICE_LIST_PATH = path.join(ART_ROOT, "ipe-price-list", "2026-04-pricelist.parsed.json");
const ADDONS_PATH = path.join(ART_ROOT, "ipe-price-list", "2026-04-addons.parsed.json");

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

/**
 * Hand-tuned Premium-tier targets. Each maps a DB slug + brand/model tokens
 * used to locate Excel rows when the manifest lacks coverage (Ferrari
 * Purosangue is in Excel's Premium sheet but absent from iPE Shopify).
 */
type PremiumTarget = {
  slug: string;
  excelBrand: string;
  modelTokenAll: string[]; // tokens that MUST appear in row.model
  excludeModelTokens?: string[]; // tokens that must NOT appear (avoid matching siblings)
  quadTips?: boolean; // explicit override; default = inferred from product
};

const PREMIUM_TARGETS: PremiumTarget[] = [
  {
    slug: "ipe-ferrari-purosangue-titanium-exhaust",
    excelBrand: "Ferrari",
    modelTokenAll: ["purosangue"],
  },
  {
    slug: "ipe-lamborghini-revuelto-exhaust",
    excelBrand: "Lamborghini",
    modelTokenAll: ["revuelto"],
  },
  {
    slug: "ipe-porsche-992-gt3-pro-version-full-exhaust-system",
    excelBrand: "Porsche",
    modelTokenAll: ["992", "gt3", "pro"],
  },
];

type SectionCandidate = {
  rows: IpeParsedPriceListRow[]; // 1+ rows that share the same section signature
  optionValue: string; // user-facing section label (axis value)
  primarySku: string; // representative Excel SKU
  msrp: number; // section's MSRP (cheapest non-null among rows)
  material: string | null;
};

type RebuildPlan = {
  slug: string;
  dbProductId: string;
  reason: "premium" | "synthetic";
  beforeVariantCount: number;
  beforeOptionCount: number;
  axes: Array<{ name: string; position: number; values: string[] }>;
  variants: Array<{
    title: string;
    position: number;
    isDefault: boolean;
    option1Value: string;
    option2Value: string | null;
    option3Value: string | null;
    priceUsd: number;
    sku: string;
    baseSku: string;
    tipLabel: string | null;
  }>;
  preservedOverrides: Map<string, { compareAtUsd: number | null; image: string | null }>;
  warnings: string[];
};

function variantSig(values: ReadonlyArray<string | null | undefined>): string {
  return values
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function tokenize(s: string | null | undefined): string[] {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function modelMatches(row: IpeParsedPriceListRow, target: PremiumTarget): boolean {
  if (row.brand !== target.excelBrand) return false;
  const haystack = `${row.model ?? ""} ${row.section ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (!target.modelTokenAll.every((t) => haystack.includes(t.toLowerCase()))) return false;
  if (target.excludeModelTokens?.some((t) => haystack.includes(t.toLowerCase()))) return false;
  return true;
}

/**
 * Classify rows that represent a "base" section the customer can purchase
 * standalone (Downpipe / Cat Back / Full System / Header Back / Cat Pipe etc.).
 * Tips and remote/OBDII rows are excluded — they become add-on options.
 */
function isBaseSectionRow(row: IpeParsedPriceListRow): boolean {
  if (row.price_kind !== "absolute") return false;
  if (row.msrp_usd == null || row.msrp_usd <= 0) return false;
  const text = `${row.section ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (/\btips?\b|\btailpipes?\b/.test(text)) return false;
  if (/\bremote\s*control\b|\bobdii\b|\bcel\s*sync\b|\bheat\s*protector\b|\bengraving\b/.test(text))
    return false;
  return true;
}

function sectionAxisLabel(row: IpeParsedPriceListRow): string {
  // Prefer the cleaner Excel section name; fall back to description.
  const section = (row.section ?? "").trim();
  const desc = (row.description ?? "").trim();
  if (section && section.toLowerCase() !== "tips") {
    // For Premium "Pro Version Full System (Cat Pipe)" we keep the full label.
    if (/\(/.test(section)) return section;
    // Suffix the description's OPF / non-OPF / mat hint when it disambiguates.
    if (/\bopf\b/i.test(desc) && !/\bopf\b/i.test(section)) {
      return `${section} (${desc.match(/non[- ]?opf|opf/i)?.[0] ?? ""})`
        .replace(/\(\)$/, "")
        .trim();
    }
    return section;
  }
  return desc.split("|")[0]?.trim() || section || "Cat Back System";
}

function groupSectionCandidates(rows: IpeParsedPriceListRow[]): SectionCandidate[] {
  const baseRows = rows.filter(isBaseSectionRow);
  // Group by stable key = section + material + an OPF marker if present in
  // the description.
  const groups = new Map<string, IpeParsedPriceListRow[]>();
  for (const row of baseRows) {
    const mat = (row.material ?? "").trim().toLowerCase();
    const desc = (row.description ?? "").toLowerCase();
    const opfTag = /non[- ]?opf/.test(desc) ? "non-opf" : /\bopf\b/.test(desc) ? "opf" : "";
    const cattedTag = /catless/.test(desc) ? "catless" : /\bcatted\b/.test(desc) ? "catted" : "";
    const key = [(row.section ?? "").trim().toLowerCase(), mat, opfTag, cattedTag]
      .filter(Boolean)
      .join("|");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const out: SectionCandidate[] = [];
  for (const list of groups.values()) {
    const sorted = list.slice().sort((a, b) => (a.msrp_usd ?? 0) - (b.msrp_usd ?? 0));
    const first = sorted[0];
    const label = sectionAxisLabel(first);
    // Ensure unique optionValue per group (so customer-facing axis values
    // are distinct). If two groups collapse to the same label, append the
    // material/feature flag.
    let optionValue = label;
    if (first.material) {
      const matAbbr = first.material.trim();
      const desc = (first.description ?? "").toLowerCase();
      const opfHint = /non[- ]?opf/.test(desc) ? "Non-OPF" : /\bopf\b/.test(desc) ? "OPF" : null;
      const cattedHint = /catless/.test(desc)
        ? "Catless"
        : /\bcatted\b/.test(desc)
          ? "Catted"
          : null;
      const suffix = [matAbbr, opfHint, cattedHint].filter(Boolean).join(" / ");
      if (suffix && !optionValue.toLowerCase().includes(suffix.toLowerCase())) {
        optionValue = `${optionValue} · ${suffix}`;
      }
    }
    out.push({
      rows: sorted,
      optionValue,
      primarySku: first.sku ?? "",
      msrp: Number(first.msrp_usd ?? 0),
      material: first.material,
    });
  }
  // De-dup optionValue
  const seen = new Map<string, number>();
  for (const c of out) {
    const key = c.optionValue.toLowerCase();
    const idx = (seen.get(key) ?? 0) + 1;
    seen.set(key, idx);
    if (idx > 1) c.optionValue = `${c.optionValue} #${idx}`;
  }
  // Sort by msrp ascending (cheapest first → likely default)
  out.sort((a, b) => a.msrp - b.msrp);
  return out;
}

async function buildPlanForProduct(args: {
  slug: string;
  reason: "premium" | "synthetic";
  newList: IpeParsedPriceList;
  addons: IpeAddonsCatalog;
  manifestRowsForHandle: Map<string, Array<{ rowIndex: number; sku: string; brand: string }>>;
  snapshotByHandle: Map<string, any>;
  premiumTarget?: PremiumTarget;
}): Promise<RebuildPlan | null> {
  const { slug, reason, newList, addons, manifestRowsForHandle, snapshotByHandle, premiumTarget } =
    args;

  const dbProduct = await prisma.shopProduct.findFirst({
    where: { slug },
    include: { variants: true, options: true },
  });
  if (!dbProduct) return null;

  const handle = slug.replace(/^ipe-/, "");
  const warnings: string[] = [];

  // Gather price rows
  let priceRows: IpeParsedPriceListRow[] = [];
  const manifestRows = manifestRowsForHandle.get(handle) ?? [];
  for (const m of manifestRows) {
    const row = newList.items[m.rowIndex];
    if (row && row.sku === m.sku) priceRows.push(row);
  }
  // For Premium products without manifest coverage, scan all parsed rows
  if (premiumTarget && priceRows.length === 0) {
    priceRows = newList.items.filter((r) => modelMatches(r, premiumTarget));
  }
  // Synthetic-only fallback: if no manifest and no premium hint, try to fish
  // out rows by matching the existing DB variant SKUs against parsed list.
  if (priceRows.length === 0) {
    const dbSkus = new Set(
      dbProduct.variants
        .map((v) => v.sku)
        .filter((s): s is string => Boolean(s) && !s.startsWith("IPE-"))
    );
    if (dbSkus.size) {
      priceRows = newList.items.filter((r) => r.sku && dbSkus.has(r.sku));
    }
  }
  if (priceRows.length === 0) {
    warnings.push("no priceRows located for this product");
    return {
      slug,
      dbProductId: dbProduct.id,
      reason,
      beforeVariantCount: dbProduct.variants.length,
      beforeOptionCount: dbProduct.options.length,
      axes: [],
      variants: [],
      preservedOverrides: new Map(),
      warnings,
    };
  }

  const sections = groupSectionCandidates(priceRows);
  if (sections.length === 0) {
    warnings.push("no base section candidates extracted from Excel rows");
    return {
      slug,
      dbProductId: dbProduct.id,
      reason,
      beforeVariantCount: dbProduct.variants.length,
      beforeOptionCount: dbProduct.options.length,
      axes: [],
      variants: [],
      preservedOverrides: new Map(),
      warnings,
    };
  }

  // Decide tip axis. Premium target may force quad/dual hint; otherwise
  // detect from snapshot product or DB title.
  const snapshotProduct = snapshotByHandle.get(handle);
  const quadHintText = [
    snapshotProduct?.title,
    snapshotProduct?.bodyHtml,
    dbProduct.titleEn ?? "",
    dbProduct.titleUa ?? "",
    ...sections.flatMap((s) => s.rows.map((r) => r.description ?? "")),
  ];
  const quadTips = premiumTarget?.quadTips ?? inferQuadTipsFromText(...quadHintText);
  const tipOptions = selectIpeTipOptions(priceRows, addons, { quadTips });

  // Preserve admin overrides keyed by signature for variants we drop.
  const preservedOverrides = new Map<
    string,
    { compareAtUsd: number | null; image: string | null }
  >();
  for (const v of dbProduct.variants) {
    const sig = variantSig([v.option1Value, v.option2Value, v.option3Value]);
    if (!sig) continue;
    if (!preservedOverrides.has(sig)) {
      preservedOverrides.set(sig, {
        compareAtUsd: v.compareAtUsd != null ? Number(v.compareAtUsd) : null,
        image: v.image ?? null,
      });
    }
  }

  // Axes
  const axes: Array<{ name: string; position: number; values: string[] }> = [];
  // Use Ukrainian "Комплектація" for section axis (matches existing locale)
  axes.push({
    name: sections.length === 1 ? "Комплектація" : "Комплектація",
    position: 1,
    values: sections.map((s) => s.optionValue),
  });
  // Dedupe tip options by normalized label (some Add-on sources collapse to
  // the same axis value — e.g., the Titanium row also normalises to a finish
  // already in the SS list).
  const dedupedTipOptions: IpeTipOption[] = [];
  const seenTipLabels = new Set<string>();
  for (const t of tipOptions) {
    const key = t.label.trim().toLowerCase();
    if (seenTipLabels.has(key)) continue;
    seenTipLabels.add(key);
    dedupedTipOptions.push(t);
  }
  if (dedupedTipOptions.length > 1) {
    axes.push({
      name: "Насадки",
      position: 2,
      values: dedupedTipOptions.map((t) => t.label),
    });
  }

  // Variants matrix
  const variants: RebuildPlan["variants"] = [];
  let pos = 0;
  const defaultSectionIdx = 0; // cheapest section after sort
  const defaultTipIdx = 0;
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];
    const tipsToIterate: Array<IpeTipOption | null> =
      dedupedTipOptions.length > 1 ? dedupedTipOptions : [null];
    for (let ti = 0; ti < tipsToIterate.length; ti++) {
      const tip = tipsToIterate[ti];
      const tipDelta = tip?.msrpDelta ?? 0;
      const totalMsrp = section.msrp + tipDelta;
      const retail = computeIpeRetailPrice(totalMsrp);
      if (retail == null || retail <= 0) {
        warnings.push(
          `could not compute retail for ${section.optionValue}/${tip?.label ?? "no-tip"}`
        );
        continue;
      }
      pos += 1;
      variants.push({
        title: tip ? `${section.optionValue} · ${tip.label}` : section.optionValue,
        position: pos,
        isDefault: si === defaultSectionIdx && ti === defaultTipIdx,
        option1Value: section.optionValue,
        option2Value: tip?.label ?? null,
        option3Value: null,
        priceUsd: Number(retail.toFixed(2)),
        sku: section.primarySku || (tip?.sku ?? ""),
        baseSku: section.primarySku,
        tipLabel: tip?.label ?? null,
      });
    }
  }

  return {
    slug,
    dbProductId: dbProduct.id,
    reason,
    beforeVariantCount: dbProduct.variants.length,
    beforeOptionCount: dbProduct.options.length,
    axes,
    variants,
    preservedOverrides,
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

  await prisma.$transaction(async (tx) => {
    await tx.shopProductOption.deleteMany({ where: { productId: plan.dbProductId } });
    await tx.shopProductVariant.deleteMany({ where: { productId: plan.dbProductId } });

    for (const opt of plan.axes) {
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
      const override = plan.preservedOverrides.get(sig);
      await tx.shopProductVariant.create({
        data: {
          productId: plan.dbProductId,
          title: v.title,
          sku: v.sku || null,
          position: v.position,
          isDefault: v.isDefault,
          option1Value: v.option1Value,
          option2Value: v.option2Value,
          option3Value: v.option3Value,
          priceUsd: new Prisma.Decimal(v.priceUsd),
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

    const defVariant = plan.variants.find((v) => v.isDefault) ?? plan.variants[0];
    if (defVariant?.priceUsd != null) {
      await tx.shopProduct.update({
        where: { id: plan.dbProductId },
        data: {
          priceUsd: new Prisma.Decimal(defVariant.priceUsd),
          sku: defVariant.sku || undefined,
          isPublished: true, // un-orphan products we are rebuilding
        },
      });
    }
  });
}

async function main() {
  const SNAPSHOT_DIR = resolveSnapshotDir();
  console.log(`Snapshot dir: ${path.basename(SNAPSHOT_DIR)}`);
  console.log(`Scope: ${SCOPE_ARG}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  if (HANDLE_FILTER) console.log(`Handle filter: ${HANDLE_FILTER}`);

  const [snap, manifest, newList, addons] = await Promise.all([
    fs.readFile(path.join(SNAPSHOT_DIR, "official-snapshot.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(SNAPSHOT_DIR, "match-manifest.json"), "utf8").then(JSON.parse),
    fs.readFile(NEW_PRICE_LIST_PATH, "utf8").then(JSON.parse) as Promise<IpeParsedPriceList>,
    fs.readFile(ADDONS_PATH, "utf8").then(JSON.parse) as Promise<IpeAddonsCatalog>,
  ]);

  const snapshotByHandle = new Map<string, any>();
  for (const p of snap.products) snapshotByHandle.set(p.handle, p);

  const manifestRowsForHandle = new Map<
    string,
    Array<{ rowIndex: number; sku: string; brand: string }>
  >();
  for (const r of manifest.rows as Array<{
    officialHandle?: string;
    rowIndex: number;
    sku: string;
    brand: string;
  }>) {
    if (!r.officialHandle) continue;
    const list = manifestRowsForHandle.get(r.officialHandle) ?? [];
    list.push({ rowIndex: r.rowIndex, sku: r.sku, brand: r.brand });
    manifestRowsForHandle.set(r.officialHandle, list);
  }

  // Discover targets
  const targets: Array<{
    slug: string;
    reason: "premium" | "synthetic";
    premiumTarget?: PremiumTarget;
  }> = [];
  if (SCOPE_ARG === "premium" || SCOPE_ARG === "all") {
    for (const t of PREMIUM_TARGETS) {
      const exists = await prisma.shopProduct.findFirst({
        where: { slug: t.slug },
        select: { id: true },
      });
      if (!exists) continue;
      targets.push({ slug: t.slug, reason: "premium", premiumTarget: t });
    }
  }
  if (SCOPE_ARG === "synthetic" || SCOPE_ARG === "all") {
    const allIpe = await prisma.shopProduct.findMany({
      where: { brand: { contains: "iPE", mode: "insensitive" } },
      include: { variants: { select: { sku: true } } },
    });
    const premiumSlugs = new Set(PREMIUM_TARGETS.map((p) => p.slug));
    for (const prod of allIpe) {
      if (premiumSlugs.has(prod.slug)) continue;
      const hasReal = prod.variants.some((v) => v.sku && !v.sku.startsWith("IPE-"));
      const hasSynth = prod.variants.some((v) => v.sku && v.sku.startsWith("IPE-"));
      if (hasSynth && !hasReal) {
        targets.push({ slug: prod.slug, reason: "synthetic" });
      }
    }
  }

  const filtered = HANDLE_FILTER
    ? targets.filter((t) => t.slug === HANDLE_FILTER || t.slug === `ipe-${HANDLE_FILTER}`)
    : targets;

  console.log(
    `\nTargets discovered: ${filtered.length} (${filtered.filter((t) => t.reason === "premium").length} premium, ${filtered.filter((t) => t.reason === "synthetic").length} synthetic)`
  );

  const plans: RebuildPlan[] = [];
  for (const t of filtered) {
    const plan = await buildPlanForProduct({
      slug: t.slug,
      reason: t.reason,
      newList,
      addons,
      manifestRowsForHandle,
      snapshotByHandle,
      premiumTarget: t.premiumTarget,
    });
    if (plan) plans.push(plan);
  }

  for (const plan of plans) {
    console.log(`\n[${plan.slug}]  (${plan.reason})`);
    console.log(`  Before: ${plan.beforeVariantCount}v / ${plan.beforeOptionCount} axes`);
    console.log(`  After:  ${plan.variants.length}v / ${plan.axes.length} axes`);
    for (const a of plan.axes) {
      console.log(
        `    Axis ${a.position}. ${a.name}  (${a.values.length}: ${a.values.slice(0, 6).join(" | ")}${a.values.length > 6 ? " ..." : ""})`
      );
    }
    for (const v of plan.variants) {
      const def = v.isDefault ? " [DEF]" : "";
      console.log(
        `    ${v.position}. [${v.option1Value}${v.option2Value ? " / " + v.option2Value : ""}]  sku=${v.sku}  $${v.priceUsd}${def}`
      );
    }
    if (plan.warnings.length) {
      console.log(`  ⚠ Warnings:`);
      for (const w of plan.warnings) console.log(`    - ${w}`);
    }
  }

  await fs.mkdir(AUDIT_DIR, { recursive: true });
  const auditPath = path.join(
    AUDIT_DIR,
    `phase2-excel-driven-${APPLY ? "applied" : "dryrun"}.json`
  );
  await fs.writeFile(
    auditPath,
    JSON.stringify(
      {
        committedAt: new Date().toISOString(),
        apply: APPLY,
        plans: plans.map((p) => ({
          ...p,
          preservedOverrides: Array.from(p.preservedOverrides.entries()).map(([sig, ov]) => ({
            sig,
            ...ov,
          })),
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`\nFull plan JSON: ${auditPath}`);

  const totalDel = plans.reduce((s, p) => s + p.beforeVariantCount, 0);
  const totalCreate = plans.reduce((s, p) => s + p.variants.length, 0);
  console.log(`\n=== Summary ===`);
  console.log(`Products: ${plans.length}`);
  console.log(`Variants to DELETE: ${totalDel}`);
  console.log(`Variants to CREATE: ${totalCreate}`);

  if (!APPLY) {
    console.log("\n(dry run — pass --apply to write)");
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying...`);
  let ok = 0;
  for (const plan of plans) {
    if (!plan.variants.length) {
      console.log(`  ⤫ ${plan.slug} skipped (no variants planned)`);
      continue;
    }
    try {
      await applyPlan(plan);
      ok += 1;
      console.log(`  ✓ ${plan.slug}`);
    } catch (e) {
      console.error(`  ✗ ${plan.slug}: ${(e as Error).message}`);
    }
  }
  console.log(`\nApplied: ${ok}/${plans.filter((p) => p.variants.length).length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
