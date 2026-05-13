#!/usr/bin/env tsx
/**
 * Targeted repair for 3 multi-axis snapshot iPE products where Phase 1
 * rebuild produced FLAT pricing (all variants share the same SKU+price)
 * because the generic resolver couldn't differentiate the combos against
 * Excel rows that span multiple sections.
 *
 * For each product we hand-map each iPE Shopify variant combo to the
 * specific Excel row, then update the DB variant's sku + priceUsd.
 *
 * Flag --apply to write; default is dry-run.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient, Prisma } from "@prisma/client";
import { computeIpeRetailPrice } from "../src/lib/ipeCatalogImport";

const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient();

type ComboMap = {
  // Match against the joined lower-cased option signature (option1 | option2 | option3)
  matchOptions: (sig: string) => boolean;
  sku: string;
  msrp: number;
};

type ProductRepair = {
  slug: string;
  combos: ComboMap[];
  fallback?: { sku: string; msrp: number };
};

const REPAIRS: ProductRepair[] = [
  // Porsche 992 GT3 Full Exhaust System — 12 combos: Material × Headers
  {
    slug: "ipe-porsche-992-gt3-full-exhaust-system",
    combos: [
      // Titanium combos — Excel has only 1 Ti row, all Ti variants share it
      { matchOptions: (s) => /titanium/.test(s), sku: "1P92G3-23-EVP0-6N", msrp: 5700 },
      // SS / Equal Length Headers / 200 Cell — catted equal-length full system
      {
        matchOptions: (s) =>
          /stainless/.test(s) && /equal length headers/.test(s) && /200 cell/.test(s),
        sku: "1P92G3-01-A0M0-1S",
        msrp: 8700,
      },
      // SS / Equal Length Headers / Catless — catless equal-length full system
      {
        matchOptions: (s) =>
          /stainless/.test(s) && /equal length headers/.test(s) && /catless/.test(s),
        sku: "1P92G3-01-B0M0-1S",
        msrp: 7900,
      },
      // SS / 200 Cell or Catless without Equal Length Headers — Header Back System SS
      {
        matchOptions: (s) => /stainless/.test(s) && !/equal length/.test(s),
        sku: "0P92G3-NVPM0-2",
        msrp: 5300,
      },
    ],
  },
  // Porsche 911 GT3 / GT3 RS 992 Full Exhaust — 3 combos
  {
    slug: "ipe-porsche-911-gt3-gt3-rs-992-full-exhaust-system",
    combos: [
      // SS / Equal Length Headers / 200 Cell — catted EL Full System SS
      {
        matchOptions: (s) => /equal length headers/.test(s) && /200 cell/.test(s),
        sku: "1P92G3-01-A0M0-1S",
        msrp: 8700,
      },
      // SS / Equal Length Headers / Catless — catless EL Full System SS
      {
        matchOptions: (s) => /equal length headers/.test(s) && /catless/.test(s),
        sku: "1P92G3-01-B0M0-1S",
        msrp: 7900,
      },
      // SS / Catback — Header Back System SS
      { matchOptions: (s) => /catback/.test(s), sku: "0P92G3-NVPM0-2", msrp: 5300 },
    ],
  },
  // Porsche 911 Carrera 4 S/4S 992 — 16 combos: Material × Exhaust System × Downpipes
  // This product was matched to GT3 Pro Version Full System ($15,000) — completely wrong model.
  // Per Excel for Carrera 4S 992: Header with Cat/Catless Straight + Cat Back System + Header Back System
  {
    slug: "ipe-porsche-911-carrera-4-s-4s-992-exhaust",
    combos: [
      // Full System combos — Catted Downpipe + Cat Back (combination price)
      // Per Excel: Header w/ Cat (catted) + Cat Back System
      {
        matchOptions: (s) =>
          /full system/.test(s) && /catted/.test(s) && /opf/.test(s) && !/non[- ]?opf/.test(s),
        sku: "0P991N-A0N00-3",
        msrp: 3000 + 5300,
      },
      {
        matchOptions: (s) => /full system/.test(s) && /catted/.test(s) && /non[- ]?opf/.test(s),
        sku: "0P991N-A0N00-3",
        msrp: 3000 + 5300,
      },
      {
        matchOptions: (s) =>
          /full system/.test(s) && /catless/.test(s) && /opf/.test(s) && !/non[- ]?opf/.test(s),
        sku: "0P991N-B0N00-3",
        msrp: 2600 + 5300,
      },
      {
        matchOptions: (s) => /full system/.test(s) && /catless/.test(s) && /non[- ]?opf/.test(s),
        sku: "0P991N-B0N00-3",
        msrp: 2600 + 5300,
      },
      // Header combos — standalone header
      {
        matchOptions: (s) =>
          /^|\bheader\b/.test(s) && /catted/.test(s) && !/full system|catback/.test(s),
        sku: "0P991N-A0N00-3",
        msrp: 3000,
      },
      {
        matchOptions: (s) =>
          /\bheader\b/.test(s) && /catless/.test(s) && !/full system|catback/.test(s),
        sku: "0P991N-B0N00-3",
        msrp: 2600,
      },
      // Catback combos — Cat Back System only
      {
        matchOptions: (s) => /catback system/.test(s) && /catted/.test(s),
        sku: "0P991N-A0N00-3",
        msrp: 5300,
      },
      {
        matchOptions: (s) => /catback system/.test(s) && /catless/.test(s),
        sku: "0P991N-B0N00-3",
        msrp: 5300,
      },
      // Downpipes-only combos — Header with Cat/Catless Straight
      {
        matchOptions: (s) => /downpipes/.test(s) && /catted/.test(s),
        sku: "0P991N-A0N00-3",
        msrp: 3000,
      },
      {
        matchOptions: (s) => /downpipes/.test(s) && /catless/.test(s),
        sku: "0P991N-B0N00-3",
        msrp: 2600,
      },
    ],
    fallback: { sku: "0P991N-A0N00-3", msrp: 5300 },
  },
];

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  for (const repair of REPAIRS) {
    const prod = await prisma.shopProduct.findFirst({
      where: { slug: repair.slug },
      include: { variants: { orderBy: { position: "asc" } } },
    });
    if (!prod) {
      console.log(`\n[${repair.slug}] not in DB, skipping`);
      continue;
    }
    console.log(`\n[${repair.slug}]  ${prod.variants.length} variants`);
    const updates: Array<{
      id: string;
      sku: string;
      priceUsd: number;
      old: { sku: string | null; price: string };
    }> = [];
    for (const v of prod.variants) {
      const sig = [v.option1Value, v.option2Value, v.option3Value]
        .filter(Boolean)
        .join(" | ")
        .toLowerCase();
      const combo = repair.combos.find((c) => c.matchOptions(sig));
      const pick = combo ?? repair.fallback;
      if (!pick) {
        console.log(`  ⚠ no combo match for "${sig}"`);
        continue;
      }
      const retail = computeIpeRetailPrice(pick.msrp);
      if (retail == null || retail <= 0) {
        console.log(`  ⚠ retail null for sig="${sig}" msrp=${pick.msrp}`);
        continue;
      }
      const newPrice = Number(retail.toFixed(2));
      const oldPrice = v.priceUsd != null ? Number(v.priceUsd) : null;
      const oldSku = v.sku;
      const changed =
        oldSku !== pick.sku || oldPrice == null || Math.abs(oldPrice - newPrice) > 0.01;
      if (changed) {
        updates.push({
          id: v.id,
          sku: pick.sku,
          priceUsd: newPrice,
          old: { sku: oldSku, price: String(oldPrice) },
        });
      }
      console.log(
        `  [${sig}]  ${oldSku} $${oldPrice}  →  ${pick.sku} $${newPrice}${changed ? "" : "  (no change)"}`
      );
    }
    if (!APPLY) continue;
    for (const u of updates) {
      await prisma.shopProductVariant.update({
        where: { id: u.id },
        data: { sku: u.sku, priceUsd: new Prisma.Decimal(u.priceUsd) },
      });
    }
    console.log(`  Applied ${updates.length}/${prod.variants.length}`);
    // Update top-level priceUsd + sku from the lowest-priced variant (default)
    const sorted = [...prod.variants].sort(
      (a, b) => Number(a.priceUsd ?? 0) - Number(b.priceUsd ?? 0)
    );
    const def = sorted[0];
    const matchedDef = repair.combos.find((c) =>
      c.matchOptions(
        [def?.option1Value, def?.option2Value, def?.option3Value]
          .filter(Boolean)
          .join(" | ")
          .toLowerCase()
      )
    );
    if (matchedDef) {
      const retail = computeIpeRetailPrice(matchedDef.msrp);
      if (retail != null) {
        await prisma.shopProduct.update({
          where: { id: prod.id },
          data: { sku: matchedDef.sku, priceUsd: new Prisma.Decimal(Number(retail.toFixed(2))) },
        });
      }
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
