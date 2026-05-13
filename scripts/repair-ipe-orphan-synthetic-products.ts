#!/usr/bin/env tsx
/**
 * Targeted rebuild for the 8 iPE products that ended Phase 3 with synthetic
 * IPE-* SKUs because the iPE Shopify manifest didn't map them to Excel rows.
 * Manual inspection of the 2026 Excel parsed list confirms they ARE in the
 * catalog under specific model tokens — we just need hand-tuned mapping.
 *
 * For each target we hardcode (a) the Excel brand+model-token filter that
 * locates its rows, and (b) any cross-vehicle exclusions to avoid matching
 * the wrong trim. Pipeline is identical to rebuild-ipe-from-excel.ts:
 *   groupSectionCandidates → selectIpeTipOptions → matrix rebuild.
 *
 * Flag --apply to write; default is dry-run.
 */

import fs from "node:fs/promises";
import path from "node:path";

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
} from "../src/lib/ipeCatalogImport";

config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

type Target = {
  slug: string;
  brand: string;
  /** All tokens must appear in row.model (lowercase substring match) */
  modelTokensAll: string[];
  /** Tokens that must NOT appear in row.model — used to avoid cross-trim bleed */
  modelTokensExclude?: string[];
  /** Optional override: include rows whose section matches one of these */
  sectionAllowlist?: string[];
};

const TARGETS: Target[] = [
  {
    slug: "ipe-audi-rs3-sedan-sportback-8v-2-exhaust",
    brand: "Audi",
    modelTokensAll: ["rs3 8v.2"],
  },
  {
    slug: "ipe-audi-rs3-sportback-8v-exhaust",
    brand: "Audi",
    modelTokensAll: ["rs3 8v.1"],
  },
  {
    slug: "ipe-bmw-m240i-g42-exhaust-system",
    brand: "BMW",
    modelTokensAll: ["g42-m240"],
  },
  {
    slug: "ipe-porsche-718-gts-4-0-718-cayman-gt4-718-spyder-exhaust",
    brand: "Porsche",
    // 718 GTS 4.0 / Spyder / Cayman GT4 (NOT GT4 RS, NOT 2.5T bodykit)
    modelTokensAll: ["982", "718"],
    modelTokensExclude: ["gt4 rs", "spyder rs", "bodykit", "2.5t"],
  },
  {
    slug: "ipe-porsche-911-turbo-turbo-s-991-991-2-exhaust",
    brand: "Porsche",
    modelTokensAll: ["991", "turbo"],
    modelTokensExclude: ["996", "997"],
  },
  {
    slug: "ipe-porsche-911-turbo-turbo-s-997-2-exhaust",
    brand: "Porsche",
    modelTokensAll: ["997.2", "turbo"],
  },
  {
    slug: "ipe-porsche-cayenne-cayenne-coupe-e3-exhaust",
    brand: "Porsche",
    // Cayenne 3.0T / Cayenne Coupe 3.0T E3 (NOT Cayenne S / NOT Turbo)
    modelTokensAll: ["cayenne", "e3", "3.0t"],
    modelTokensExclude: ["turbo", "2.9t", "cayenne s"],
  },
  {
    slug: "ipe-porsche-cayenne-s-cayenne-s-coupe-e3-exhaust",
    brand: "Porsche",
    // Cayenne S 2.9T E3
    modelTokensAll: ["cayenne", "e3", "2.9t"],
    modelTokensExclude: ["turbo"],
  },
];

function variantSig(values: ReadonlyArray<string | null | undefined>): string {
  return values
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

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
  const section = (row.section ?? "").trim();
  const desc = (row.description ?? "").trim();
  if (section && section.toLowerCase() !== "tips") {
    if (/\(/.test(section)) return section;
    if (/\bopf\b/i.test(desc) && !/\bopf\b/i.test(section)) {
      return `${section} (${desc.match(/non[- ]?opf|opf/i)?.[0] ?? ""})`
        .replace(/\(\)$/, "")
        .trim();
    }
    return section;
  }
  return desc.split("|")[0]?.trim() || section || "Cat Back System";
}

type SectionCandidate = {
  rows: IpeParsedPriceListRow[];
  optionValue: string;
  primarySku: string;
  msrp: number;
};

function groupSectionCandidates(rows: IpeParsedPriceListRow[]): SectionCandidate[] {
  const baseRows = rows.filter(isBaseSectionRow);
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
    let optionValue = sectionAxisLabel(first);
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
    });
  }
  // Dedupe optionValue with #2 / #3 suffix
  const seen = new Map<string, number>();
  for (const c of out) {
    const k = c.optionValue.toLowerCase();
    const i = (seen.get(k) ?? 0) + 1;
    seen.set(k, i);
    if (i > 1) c.optionValue = `${c.optionValue} #${i}`;
  }
  out.sort((a, b) => a.msrp - b.msrp);
  return out;
}

async function main() {
  const [newList, addons] = await Promise.all([
    fs
      .readFile("artifacts/ipe-price-list/2026-04-pricelist.parsed.json", "utf8")
      .then(JSON.parse) as Promise<IpeParsedPriceList>,
    fs
      .readFile("artifacts/ipe-price-list/2026-04-addons.parsed.json", "utf8")
      .then(JSON.parse) as Promise<IpeAddonsCatalog>,
  ]);

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  let appliedCount = 0;
  for (const target of TARGETS) {
    const dbProduct = await prisma.shopProduct.findFirst({
      where: { slug: target.slug },
      include: { variants: true, options: true },
    });
    if (!dbProduct) {
      console.log(`[${target.slug}] not in DB, skip`);
      continue;
    }

    // Filter Excel rows for this target
    const priceRows: IpeParsedPriceListRow[] = newList.items.filter((r) => {
      if (r.brand !== target.brand) return false;
      const hay = `${r.model ?? ""} ${r.section ?? ""} ${r.description ?? ""}`.toLowerCase();
      if (!target.modelTokensAll.every((t) => hay.includes(t.toLowerCase()))) return false;
      if (target.modelTokensExclude?.some((t) => hay.includes(t.toLowerCase()))) return false;
      return true;
    });

    const sections = groupSectionCandidates(priceRows);
    if (sections.length === 0) {
      console.log(
        `[${target.slug}] ⚠ no base sections after filtering ${priceRows.length} candidate rows`
      );
      continue;
    }

    const tipOptions = selectIpeTipOptions(priceRows, addons, {
      quadTips: inferQuadTipsFromText(dbProduct.titleEn, dbProduct.titleUa),
    });
    const seenTipLabels = new Set<string>();
    const dedupedTips = tipOptions.filter((t) => {
      const k = t.label.toLowerCase();
      if (seenTipLabels.has(k)) return false;
      seenTipLabels.add(k);
      return true;
    });

    console.log(`\n[${target.slug}]`);
    console.log(
      `  matched ${priceRows.length} Excel rows; ${sections.length} sections; ${dedupedTips.length} tips`
    );
    console.log(`  Before: ${dbProduct.variants.length}v / ${dbProduct.options.length} axes`);

    const axes: Array<{ name: string; position: number; values: string[] }> = [
      { name: "Комплектація", position: 1, values: sections.map((s) => s.optionValue) },
    ];
    if (dedupedTips.length > 1) {
      axes.push({ name: "Насадки", position: 2, values: dedupedTips.map((t) => t.label) });
    }

    type NewV = {
      title: string;
      position: number;
      isDefault: boolean;
      option1Value: string;
      option2Value: string | null;
      sku: string;
      priceUsd: number;
    };
    const variants: NewV[] = [];
    let pos = 0;
    for (let si = 0; si < sections.length; si++) {
      const section = sections[si];
      const tips: Array<{ label: string; sku: string | null; msrpDelta: number } | null> =
        dedupedTips.length > 1 ? (dedupedTips as any) : [null];
      for (let ti = 0; ti < tips.length; ti++) {
        const tip = tips[ti];
        const tipDelta = tip?.msrpDelta ?? 0;
        const totalMsrp = section.msrp + tipDelta;
        const retail = computeIpeRetailPrice(totalMsrp);
        if (retail == null || retail <= 0) continue;
        pos += 1;
        variants.push({
          title: tip ? `${section.optionValue} · ${tip.label}` : section.optionValue,
          position: pos,
          isDefault: si === 0 && ti === 0,
          option1Value: section.optionValue,
          option2Value: tip?.label ?? null,
          sku: section.primarySku,
          priceUsd: Number(retail.toFixed(2)),
        });
      }
    }
    console.log(`  After:  ${variants.length}v / ${axes.length} axes`);
    for (const a of axes) {
      console.log(
        `    ${a.position}. ${a.name}  (${a.values.length}: ${a.values.slice(0, 5).join(" | ")}${a.values.length > 5 ? " ..." : ""})`
      );
    }
    for (const v of variants.slice(0, 6)) {
      console.log(
        `    [${v.option1Value}${v.option2Value ? " / " + v.option2Value : ""}]  sku=${v.sku}  $${v.priceUsd}${v.isDefault ? " [DEF]" : ""}`
      );
    }
    if (variants.length > 6) console.log(`    ... and ${variants.length - 6} more`);

    if (!APPLY) continue;

    // FK guard
    const oldIds = dbProduct.variants.map((v) => v.id);
    if (oldIds.length) {
      const refs =
        (await prisma.shopOrderItem.count({ where: { variantId: { in: oldIds } } })) +
        (await prisma.shopCartItem.count({ where: { variantId: { in: oldIds } } }));
      if (refs > 0) {
        console.log(`  ⚠ ${refs} FK refs, skipping`);
        continue;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.shopProductOption.deleteMany({ where: { productId: dbProduct.id } });
      await tx.shopProductVariant.deleteMany({ where: { productId: dbProduct.id } });
      for (const a of axes) {
        await tx.shopProductOption.create({
          data: { productId: dbProduct.id, name: a.name, position: a.position, values: a.values },
        });
      }
      for (const v of variants) {
        await tx.shopProductVariant.create({
          data: {
            productId: dbProduct.id,
            title: v.title,
            sku: v.sku,
            position: v.position,
            isDefault: v.isDefault,
            option1Value: v.option1Value,
            option2Value: v.option2Value,
            option3Value: null,
            priceUsd: new Prisma.Decimal(v.priceUsd),
            inventoryQty: 0,
            inventoryPolicy: "CONTINUE",
            requiresShipping: true,
            taxable: true,
          },
        });
      }
      const def = variants.find((v) => v.isDefault) ?? variants[0];
      if (def) {
        await tx.shopProduct.update({
          where: { id: dbProduct.id },
          data: { priceUsd: new Prisma.Decimal(def.priceUsd), sku: def.sku, isPublished: true },
        });
      }
    });
    appliedCount += 1;
    console.log(`  ✓ rebuilt`);
  }
  console.log(`\n${APPLY ? "Applied" : "Would apply"}: ${appliedCount}/${TARGETS.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
