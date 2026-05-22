/**
 * Audit Ilmberger filter behavior — simulate what the storefront filters
 * actually return for each BMW model, and surface false positives where
 * substring-matching captures the wrong products (e.g. filter "S 1000 R"
 * picks up "S 1000 RR" because "s 1000 r" is a prefix of "s 1000 rr").
 */
import { PrismaClient } from "@prisma/client";

const MODELS = ["S 1000 R", "M 1000 R", "S 1000 RR", "M 1000 RR", "S 1000 XR", "M 1000 XR"];

const prisma = new PrismaClient();
const rows = await prisma.shopProduct.findMany({
  where: { brand: "Ilmberger Carbon" },
  select: {
    sku: true,
    slug: true,
    titleEn: true,
    titleUa: true,
    categoryEn: true,
    categoryUa: true,
    tags: true,
  },
});
console.log(`Loaded ${rows.length} Ilmberger products from DB\n`);

// Same getSearchableText as the storefront (Catalog & VehicleFilter)
function searchableText(p) {
  return [p.titleEn, p.titleUa, p.categoryEn, p.categoryUa, p.sku, ...(p.tags ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterByModelSubstring(model) {
  const lc = model.toLowerCase();
  const noSpace = lc.replace(/\s+/g, "");
  return rows.filter((p) => {
    const t = searchableText(p);
    return t.includes(lc) || t.replace(/\s+/g, "").includes(noSpace);
  });
}

function filterByModelTag(model) {
  return rows.filter((p) => (p.tags ?? []).includes(model));
}

console.log("Model            │ NEW (tag) │ OLD (substring) │ False positives avoided");
console.log("─────────────────┼───────────┼─────────────────┼─────────────────────────");
const falsePositivesByModel = {};
for (const model of MODELS) {
  const tagged = filterByModelTag(model); // new behavior — exact tag match
  const filtered = filterByModelSubstring(model); // old behavior — substring
  const taggedSlugs = new Set(tagged.map((p) => p.slug));
  const falsePos = filtered.filter((p) => !taggedSlugs.has(p.slug));
  falsePositivesByModel[model] = falsePos;
  console.log(
    `${model.padEnd(16)} │ ${String(tagged.length).padStart(9)} │ ${String(filtered.length).padStart(15)} │ ${falsePos.length} avoided`
  );
}

console.log("\n──────────────────────────────────────────────────────────────────");
console.log("False positives detail (filter result that doesn't have the model tag):");
console.log("──────────────────────────────────────────────────────────────────");
for (const model of MODELS) {
  const fps = falsePositivesByModel[model];
  if (fps.length === 0) continue;
  console.log(`\n[${model}] — ${fps.length} false positives:`);
  for (const p of fps.slice(0, 10)) {
    console.log(`  ${p.sku}  →  tags=${JSON.stringify(p.tags ?? [])}`);
    console.log(`    titleEn: ${p.titleEn}`);
    console.log(`    categoryEn: ${p.categoryEn}`);
  }
  if (fps.length > 10) console.log(`  ... and ${fps.length - 10} more`);
}

// Also check that every Ilmberger product has at least one canonical bike-model tag
const CANONICAL_TAG =
  /^(S 1000 (RR|R|XR)|M 1000 (RR|R|XR)|Panigale V4( R| S)?|Streetfighter V4( S)?|Diavel V4( RS| Bentley)?|Diavel 1260|Diavel|XDiavel)$/;
const noModelTag = rows.filter((p) => !(p.tags ?? []).some((t) => CANONICAL_TAG.test(t)));
console.log(`\n──────────────────────────────────────────────────────────────────`);
console.log(`Products without ANY canonical bike-model tag: ${noModelTag.length}/${rows.length}`);
if (noModelTag.length > 0) {
  console.log("First 10:");
  for (const p of noModelTag.slice(0, 10)) {
    console.log(`  ${p.sku}  tags=${JSON.stringify(p.tags ?? [])}  title="${p.titleEn}"`);
  }
}

await prisma.$disconnect();
