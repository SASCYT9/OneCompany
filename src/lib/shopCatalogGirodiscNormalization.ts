import { createHash } from "node:crypto";
import { flattenShopCatalogRawPayload } from "./shopCatalogSourceCoverage";

export type GirodiscSnapshotProduct = { id: string; slug: string; sku: string; scope: string; title: { ua: string; en: string }; tags: string[];
  variants: Array<{ id: string; sku: string | null; isDefault: boolean }>; [key: string]: unknown };
export type GirodiscApplication = { make: string; model: string; generation: string | null; yearFrom: number | null; yearTo: number | null };
export type GirodiscNormalization = { productId: string; variantId: string; variantSku: string; recordKey: string; mode: "VEHICLE_SPECIFIC" | "NEEDS_REVIEW";
  applications: GirodiscApplication[]; engineRelevant: false; verification: "VERIFIED" | "NEEDS_REVIEW"; issues: string[] };

const makes: Array<[string, string[]]> = [
  ["Mercedes-Benz", ["mercedes-benz", "mercedes", "amg"]], ["Alfa Romeo", ["alfa_romeo", "alfa-romeo", "alfa romeo"]],
  ["Chevrolet", ["chevrolet", "corvette"]], ["Porsche", ["porsche"]], ["Ferrari", ["ferrari"]], ["BMW", ["bmw"]], ["Audi", ["audi"]],
  ["Lamborghini", ["lamborghini"]], ["McLaren", ["mclaren"]], ["Ford", ["ford"]], ["Nissan", ["nissan"]], ["Dodge", ["dodge"]],
  ["Subaru", ["subaru"]], ["Honda", ["honda"]], ["Mitsubishi", ["mitsubishi"]], ["Toyota", ["toyota"]], ["Maserati", ["maserati"]],
  ["Lotus", ["lotus"]], ["Tesla", ["tesla"]], ["Renault", ["renault"]], ["Hyundai", ["hyundai"]], ["Volkswagen", ["volkswagen", "vw"]],
];
function escape(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function makeEvidence(product: GirodiscSnapshotProduct) {
  const tag = product.tags.find((entry) => entry.startsWith("car_make:"))?.slice(9) ?? product.tags.find((entry) => entry.startsWith("fits-make:"))?.slice(10);
  if (tag) { const normalized = tag.replaceAll("_", "-"); for (const [label, aliases] of makes) if (aliases.includes(normalized)) return { label, alias: tag, fromTag: true }; }
  const title = product.title.en || product.title.ua; let best: { label: string; alias: string; index: number } | null = null;
  for (const [label, aliases] of makes) for (const alias of aliases) { const match = new RegExp(`\\b${escape(alias).replace(/[-_]/g, "[-_ ]")}\\b`, "i").exec(title); if (match && (!best || match.index < best.index)) best = { label, alias: match[0], index: match.index }; }
  return best ? { label: best.label, alias: best.alias, fromTag: false } : null;
}
function clean(value: string) { return value.replace(/\b(?:front|rear|left|right|передн\S*|задн\S*)\b/giu, " ").replace(/\b(?:19|20)\d{2}(?:\s*[-–+]\s*(?:19|20)?\d{2,4})?\b/g, " ")
  .replace(/\b\d{2,4}\s*[xх/]\s*\d{2,4}\s*(?:mm|мм)\b/giu, " ").replace(/\b\d{2,4}\s*(?:mm|мм)\b/giu, " ").replace(/\b\d+\s*(?:PISTON|PS Version)\b/gi, " ")
  .replace(/[()[\]]/g, " ").replace(/\s+/g, " ").replace(/^[\s/,-]+|[\s/,-]+$/g, "").trim(); }
function parseApplications(product: GirodiscSnapshotProduct, evidence: NonNullable<ReturnType<typeof makeEvidence>>) {
  const title = product.title.en || product.title.ua, makeMatch = new RegExp(`\\b${escape(evidence.alias).replace(/[-_]/g, "[-_ ]")}\\b`, "i").exec(title);
  if (!makeMatch) return [];
  let after = title.slice(makeMatch.index + makeMatch[0].length); const year = after.match(/\b((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?\s*(\+)?/);
  const yearFrom = year ? Number(year[1]) : null, yearTo = year?.[2] ? Number(year[2]) : year?.[3] ? null : yearFrom;
  const applications: GirodiscApplication[] = [], parens = [...after.matchAll(/([^()/,;]{1,50})\s*\(([^)]+)\)/g)];
  for (const match of parens) { const model = clean(match[1] ?? ""), codes = (match[2]?.match(/\b(?:[A-Z]{1,4}\d{1,4}|\d{3,4})\b/gi) ?? []).map((value) => value.toUpperCase());
    if (!model) continue; if (codes.length) for (const generation of codes) applications.push({ make: evidence.label, model, generation, yearFrom, yearTo }); else applications.push({ make: evidence.label, model, generation: null, yearFrom, yearTo }); }
  if (!applications.length) { after = clean(after); if (after) applications.push({ make: evidence.label, model: after, generation: null, yearFrom, yearTo }); }
  return [...new Map(applications.map((app) => [`${app.make}|${app.model}|${app.generation ?? "*"}`, app])).values()];
}

export function normalizeGirodiscSnapshotProduct(product: GirodiscSnapshotProduct): GirodiscNormalization { const issues: string[] = [], evidence = makeEvidence(product), applications = evidence ? parseApplications(product, evidence) : [];
  if (!evidence) issues.push("parent_or_vehicle_application_unresolved"); if (evidence && !applications.length) issues.push("vehicle_model_unresolved");
  if (applications.some((app) => app.model.length > 50 || /(?:GIRODISC|комплект|ремкомплект|rotor|caliper|ring)/i.test(app.model))) issues.push("vehicle_model_parse_suspect");
  const variants = product.variants.filter((variant) => variant.isDefault && variant.sku?.trim()); if (variants.length !== 1) issues.push("default_variant_missing_or_ambiguous"); const variant = variants[0];
  const uniqueIssues = [...new Set(issues)].sort(), verification = uniqueIssues.length ? "NEEDS_REVIEW" : "VERIFIED";
  return { productId: product.id, variantId: variant?.id ?? "", variantSku: variant?.sku?.trim() ?? "", recordKey: `${product.id}:${product.sku}`,
    mode: verification === "VERIFIED" ? "VEHICLE_SPECIFIC" : "NEEDS_REVIEW", applications, engineRelevant: false, verification, issues: uniqueIssues };
}
export function buildGirodiscSourceRecordDraft(input: { product: GirodiscSnapshotProduct; sourceRevision: string }) { const normalization = normalizeGirodiscSnapshotProduct(input.product);
  const provenance = flattenShopCatalogRawPayload(input.product).map((leaf) => { const variantField = leaf.fieldPath.startsWith("variants."), variant = variantField ? input.product.variants.length === 1 ? input.product.variants[0] : input.product.variants[leaf.ordinal] : null;
    if (variantField && !variant) throw new Error(`GiroDisc variant provenance cannot resolve ${leaf.fieldPath}`); const legacyScope = leaf.fieldPath === "scope" && leaf.value === "SHOP"; return { fieldPath: leaf.fieldPath, ordinal: leaf.ordinal, rawValue: leaf.value,
      canonicalEntityType: variantField ? ("VARIANT" as const) : ("PRODUCT" as const), canonicalEntityId: variant?.id ?? input.product.id, canonicalField: legacyScope ? "scope" : variantField ? leaf.fieldPath.slice(9) : leaf.fieldPath,
      normalizedValue: legacyScope ? "auto" : leaf.value, mappingStatus: "MAPPED" as const, mapperVersion: "girodisc-snapshot-v1" as const, confidence: 1 as const, reason: legacyScope ? "audited LEGACY SHOP scope maps to auto" : null,
      productId: input.product.id, variantId: variant?.id ?? null }; });
  return { sourceRecord: { recordKey: normalization.recordKey, sourceRevision: input.sourceRevision, rawPayload: input.product, payloadHash: createHash("sha256").update(JSON.stringify(input.product)).digest("hex"), productId: input.product.id }, provenance, normalization,
    issues: normalization.issues.map((issue) => ({ issueKey: `girodisc:${issue}`, code: issue.toUpperCase(), rawPath: issue.includes("parse") ? "title" : "$", details: { productId: input.product.id, supplierSku: input.product.sku } })) };
}
