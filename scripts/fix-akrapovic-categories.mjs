// Fix Akrapovič catalog category assignments. Dry-run by default.
// Issues this script addresses (found via audit-akrapovic-catalog.mjs),
// renamed to match akrapovic.com official line taxonomy.
//
//   1. The category "Системи кат-бек (задня частина)" is contradictory and
//      mixes two distinct Akrapovič lines:
//        - Slip-On Line + Slip-On Race Line  → ARE the rear section
//          (Akrapovič calls this Slip-On; technical name: Axleback).
//        - Evolution Line → IS cat-back (mid + rear).
//      → Split into "Slip-On Line (задня частина)" and
//        "Evolution Line (Cat-back)".
//
//   2. "Спойлери і аксесуари" contains Mounting Kits (P-HF*) which are
//      installation hardware for exhaust systems, NOT spoilers.
//      → Move Mounting Kits to "Аксесуари вихлопної системи".
//
//   3. Merch sits in three single-item categories ("Сорочки", "Головні
//      убори", "GPS, Dash-консолі і аксесуари" with a USB flash drive).
//      Akrapovič's own site groups these as "Apparel" + "Lifestyle".
//      → Consolidate the 3 into "Apparel & Lifestyle" / "Одяг та сувеніри".
//
// Usage:
//   node scripts/fix-akrapovic-categories.mjs                # dry-run
//   node scripts/fix-akrapovic-categories.mjs --apply        # write to DB

import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const APPLY = process.argv.includes('--apply');
const p = new PrismaClient();

const NEW_CATEGORIES = {
  slipOn: {
    ua: 'Slip-On Line (задня частина)',
    en: 'Slip-On Line (rear section)',
  },
  evolution: {
    ua: 'Evolution Line (Cat-back)',
    en: 'Evolution Line (Cat-back)',
  },
  exhaustAccessories: {
    ua: 'Аксесуари вихлопної системи',
    en: 'Exhaust system accessories',
  },
  apparelLifestyle: {
    ua: 'Одяг та сувеніри',
    en: 'Apparel & Lifestyle',
  },
};

const APPAREL_LIFESTYLE_FROM = new Set([
  'Сорочки',
  'Головні убори',
  'GPS, Dash-консолі і аксесуари',
]);

const DOWNPIPES_CATEGORY_UA = 'Даунпайпи, аппайпи та каталізатори';

function classifyExhaustLine(titleEn, sku) {
  const t = (titleEn || '').toLowerCase();
  const skuStr = (sku || '').toUpperCase();
  if (/slip[- ]?on\s*race/.test(t)) return 'slipOnRace';
  if (/slip[- ]?on/.test(t)) return 'slipOn';
  if (/evolution/.test(t)) return 'evolution';
  if (/link\s*pipe/i.test(titleEn || '') || /^L-/.test(skuStr)) return 'linkPipe';
  if (/mounting\s*kit/i.test(titleEn) || /\bP-HF/.test(titleEn || '')) return 'mountingKit';
  // SKU-prefix fallback for titles that omit the line name (e.g. "S-RE/T/4H Exhaust System ...").
  // Akrapovič SKU prefixes: S- = Slip-On, ME-/MTP- = Evolution Line, DP- = Downpipe.
  if (/^S-/.test(skuStr)) return 'slipOn';
  if (/^(ME-|MTP-|E-)/.test(skuStr)) return 'evolution';
  if (/^DP-/.test(skuStr)) return 'downpipe';
  return null;
}

async function run() {
  const products = await p.shopProduct.findMany({
    where: {
      brand: { contains: 'akrapovi', mode: 'insensitive' },
      isPublished: true,
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      titleEn: true,
      categoryUa: true,
      categoryEn: true,
    },
  });

  const plan = [];

  for (const row of products) {
    const cat = (row.categoryUa || '').trim();

    // Issue 1: split "Системи кат-бек (задня частина)"
    if (cat === 'Системи кат-бек (задня частина)') {
      const line = classifyExhaustLine(row.titleEn, row.sku);
      if (line === 'slipOn' || line === 'slipOnRace') {
        plan.push({
          id: row.id,
          slug: row.slug,
          titleEn: (row.titleEn || '').slice(0, 80),
          fromUa: cat,
          toUa: NEW_CATEGORIES.slipOn.ua,
          toEn: NEW_CATEGORIES.slipOn.en,
          reason: 'Slip-On is rear-only, not cat-back',
        });
      } else if (line === 'evolution') {
        plan.push({
          id: row.id,
          slug: row.slug,
          titleEn: (row.titleEn || '').slice(0, 80),
          fromUa: cat,
          toUa: NEW_CATEGORIES.evolution.ua,
          toEn: NEW_CATEGORIES.evolution.en,
          reason: 'Evolution Line is cat-back (mid+rear)',
        });
      } else if (line === 'linkPipe' || line === 'downpipe') {
        plan.push({
          id: row.id,
          slug: row.slug,
          titleEn: (row.titleEn || '').slice(0, 80),
          fromUa: cat,
          toUa: DOWNPIPES_CATEGORY_UA,
          toEn: 'Downpipes, Up-pipes & Catalysts (incl. Link Pipes)',
          reason: 'Link / Down pipe belongs with the front-section family',
        });
      }
      continue;
    }

    // Issue 2: move mounting kits out of "Спойлери і аксесуари"
    if (cat === 'Спойлери і аксесуари') {
      const line = classifyExhaustLine(row.titleEn, row.sku);
      if (line === 'mountingKit') {
        plan.push({
          id: row.id,
          slug: row.slug,
          titleEn: (row.titleEn || '').slice(0, 80),
          fromUa: cat,
          toUa: NEW_CATEGORIES.exhaustAccessories.ua,
          toEn: NEW_CATEGORIES.exhaustAccessories.en,
          reason: 'Mounting kit belongs in exhaust accessories, not spoilers',
        });
      }
    }

    // Issue 3: consolidate single-item merch categories into Apparel & Lifestyle
    if (APPAREL_LIFESTYLE_FROM.has(cat)) {
      plan.push({
        id: row.id,
        slug: row.slug,
        titleEn: (row.titleEn || '').slice(0, 80),
        fromUa: cat,
        toUa: NEW_CATEGORIES.apparelLifestyle.ua,
        toEn: NEW_CATEGORIES.apparelLifestyle.en,
        reason: 'Consolidate merch under Apparel & Lifestyle (matches akrapovic.com)',
      });
    }
  }

  // Summary by transition
  const byTransition = new Map();
  for (const item of plan) {
    const key = `${item.fromUa}  →  ${item.toUa}`;
    byTransition.set(key, (byTransition.get(key) || 0) + 1);
  }

  console.log(`=== Akrapovič category migration plan ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY-RUN (no DB writes)'}`);
  console.log(`Total reassignments: ${plan.length}\n`);
  for (const [k, v] of byTransition) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  console.log(`\nFirst 10 items:`);
  for (const it of plan.slice(0, 10)) {
    console.log(`  - ${it.slug}`);
    console.log(`      ${it.titleEn}`);
    console.log(`      ${it.fromUa}`);
    console.log(`      → ${it.toUa}`);
  }

  if (APPLY && plan.length) {
    console.log(`\nApplying ${plan.length} updates...`);
    let done = 0;
    for (const it of plan) {
      await p.shopProduct.update({
        where: { id: it.id },
        data: { categoryUa: it.toUa, categoryEn: it.toEn },
      });
      done += 1;
      if (done % 25 === 0) console.log(`  applied ${done}/${plan.length}`);
    }
    console.log(`Done. Applied ${done} updates.`);
  } else if (!APPLY) {
    console.log(`\n(dry-run) Re-run with --apply to write changes.`);
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
