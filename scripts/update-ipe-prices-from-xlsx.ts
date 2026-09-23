#!/usr/bin/env tsx
/**
 * Re-prices iPE shop variants against the April 2026 V2.0 USD price list.
 *
 * Why this script (vs. running import-ipe-catalog.ts again):
 *   - The full importer re-crawls Shopify, re-translates, rewrites images, and
 *     overwrites the polished UA copy / fitment metadata that already lives in
 *     the DB. We only want price refreshes for products already in the catalog.
 *
 * What it does:
 *   1. Loads the latest official-snapshot.json + match-manifest.json (the
 *      mapping of price-list rows → product handles from the previous import).
 *   2. Loads the 2025 PDF-derived parsed list (the row template the manifest
 *      points into) and the new 2026 xlsx-derived parsed list.
 *   3. For every iPE product in the DB, scopes its rows from the manifest,
 *      replaces each row's msrp_usd / retail_usd with the value found at the
 *      same SKU in the 2026 list (when present), runs the existing
 *      `resolveIpeVariantPricing`, and updates `ShopProductVariant.priceUsd`.
 *   4. Prints a diff table — only variants whose USD price actually moved.
 *
 * Pass --commit to write to the DB; default is dry-run.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { config } from "dotenv";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaClient } from "@prisma/client";

import {
  buildIpeVariantCandidates,
  buildIpeCanonicalTokenSetFromOfficialProduct,
  buildIpeCanonicalTokenSetFromPriceRow,
  computeIpeRetailPrice,
  inferQuadTipsFromText,
  selectIpeTipOptions,
  resolveIpeVariantPricing,
  type IpeAddonsCatalog,
  type IpeOfficialProductSnapshot,
  type IpeOfficialSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
} from "../src/lib/ipeCatalogImport";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

const ART_ROOT = path.join(process.cwd(), "artifacts");
const DEFAULT_PRICE_LIST_PATH = path.join(ART_ROOT, "ipe-price-list", "2026-04-pricelist.parsed.json");
const PRICE_LIST_ARG = process.argv
  .find((arg) => arg.startsWith("--price-list="))
  ?.slice("--price-list=".length);
const NEW_PRICE_LIST_PATH = PRICE_LIST_ARG
  ? path.resolve(process.cwd(), PRICE_LIST_ARG)
  : DEFAULT_PRICE_LIST_PATH;
const EXCLUDED_HANDLES = new Set(
  process.argv
    .filter((arg) => arg.startsWith("--exclude-handle="))
    .map((arg) => arg.slice("--exclude-handle=".length).trim())
    .filter(Boolean)
);
const AUDIT_ALL = process.argv.includes("--audit-all");
const AUDIT_OUT_ARG = process.argv
  .find((arg) => arg.startsWith("--audit-out="))
  ?.slice("--audit-out=".length);
const ADDONS_ARG = process.argv
  .find((arg) => arg.startsWith("--addons="))
  ?.slice("--addons=".length);
const ADDONS_PATH = ADDONS_ARG
  ? path.resolve(process.cwd(), ADDONS_ARG)
  : path.join(ART_ROOT, "ipe-price-list", "2026-04-addons.parsed.json");

// Auto-detect the latest snapshot directory so the script always picks up new
// products added after the original April 22 import (e.g., W465 G63 added in
// the May 2 re-import). The latest manifest's rowIndex refers to positions
// inside the NEW (2026 xlsx) parsed list — no longer relying on the 2025 PDF
// parse as a template.
function resolveSnapshotDir(): string {
  const root = path.join(ART_ROOT, "ipe-import");
  const dirs = require("node:fs")
    .readdirSync(root, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean; name: string }) => d.isDirectory())
    .map((d: { name: string }) => d.name)
    .filter((name: string) =>
      require("node:fs").existsSync(path.join(root, name, "match-manifest.json"))
    )
    .sort()
    .reverse();
  if (!dirs.length) throw new Error("No iPE snapshot dir with match-manifest.json found");
  return path.join(root, dirs[0]);
}
const SNAPSHOT_DIR = resolveSnapshotDir();
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, "official-snapshot.json");
const MANIFEST_PATH = path.join(SNAPSHOT_DIR, "match-manifest.json");

type ManifestRow = {
  rowIndex: number;
  sku: string;
  priceKind: string;
  brand: string;
  officialHandle: string | null;
  status?: string;
};

type ManifestFile = {
  rows: ManifestRow[];
};

function variantSignature(values: ReadonlyArray<string | null | undefined>) {
  return values
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function modelCompatibleTokenSets(
  productTokens: ReturnType<typeof buildIpeCanonicalTokenSetFromOfficialProduct>,
  rowTokens: ReturnType<typeof buildIpeCanonicalTokenSetFromPriceRow>
) {
  if (
    productTokens.vehicleMake &&
    rowTokens.vehicleMake &&
    productTokens.vehicleMake !== rowTokens.vehicleMake
  ) {
    return false;
  }

  const productChassis = new Set(productTokens.chassisTokens);
  const rowChassis = new Set(rowTokens.chassisTokens);
  const sharedChassis = [...productChassis].some((token) => rowChassis.has(token));
  if (productChassis.size && rowChassis.size && !sharedChassis) return false;
  const numericProductChassis = [...productChassis].filter((token) => /\d/.test(token));
  const numericRowChassis = [...rowChassis].filter((token) => /\d/.test(token));
  if (
    numericProductChassis.length &&
    numericRowChassis.length &&
    numericProductChassis.some((token) => !rowChassis.has(token)) &&
    numericRowChassis.some((token) => !productChassis.has(token))
  ) {
    return false;
  }

  const engineLike = (token: string) =>
    /^\d+\.\d+t?$/i.test(token) || /^[a-z]\d{2,3}$/i.test(token) || /^v\d+$/i.test(token);
  const productEngines = productTokens.modelTokens.filter(engineLike);
  const rowEngines = rowTokens.modelTokens.filter(engineLike);
  if (productEngines.length && rowEngines.length && !productEngines.some((token) => rowEngines.includes(token))) {
    return false;
  }
  const spacedEngine = (text: string) =>
    new Set(
      [...text.matchAll(/\b(\d)\s+(\d)(?:\s+t)?\b/gi)].map((match) =>
        `${match[1]}.${match[2]}${match[0].toLowerCase().endsWith("t") ? "t" : ""}`
      )
    );
  const productSpacedEngines = spacedEngine(productTokens.signatureText);
  const rowSpacedEngines = spacedEngine(rowTokens.signatureText);
  if (
    productSpacedEngines.size &&
    rowSpacedEngines.size &&
    ![...productSpacedEngines].some((token) => rowSpacedEngines.has(token))
  ) {
    return false;
  }

  // The imported manifest is intentionally allowed to carry review/unresolved
  // rows, but a low-confidence match must not pull a sibling model's price
  // into this product. Require at least one non-chassis model token in common
  // whenever both sides expose such tokens (e.g. Carrera vs GT3 on chassis 992).
  const productModel = productTokens.modelTokens.filter((token) => !productChassis.has(token));
  const rowModel = rowTokens.modelTokens.filter((token) => !rowChassis.has(token));
  if (productModel.length && rowModel.length && !productModel.some((token) => rowModel.includes(token))) {
    return false;
  }
  return true;
}

function modelCompatiblePriceRow(
  product: IpeOfficialProductSnapshot,
  row: IpeParsedPriceListRow
) {
  return modelCompatibleTokenSets(
    buildIpeCanonicalTokenSetFromOfficialProduct(product),
    buildIpeCanonicalTokenSetFromPriceRow(row)
  );
}

function extractEngineMarkers(text: string) {
  const markers = new Set<string>();
  for (const match of text.matchAll(/\b(\d+\.\d+)\s*(t|l)?\b/gi)) {
    markers.add(`${match[1]}${(match[2] ?? "").toLowerCase()}`);
  }
  for (const match of text.matchAll(/\b([sbnv]\d{2,3})\b/gi)) {
    markers.add(match[1].toLowerCase());
  }
  return markers;
}

function engineCompatible(productMarkers: ReadonlySet<string>, rowMarkers: ReadonlySet<string>) {
  return !productMarkers.size || !rowMarkers.size || [...productMarkers].some((marker) => rowMarkers.has(marker));
}

const SIBLING_MODEL_FAMILIES = [
  ["evo", "sto", "tecnica", "performante", "svj", "revuelto", "urus"],
  ["carrera", "turbo", "gt2", "gt3", "gt4", "gt4rs", "spyder", "cayman", "boxster"],
  ["a3", "a4", "a5", "a6", "a7", "rs3", "rs4", "rs5", "rs6", "rs7", "r8"],
  ["m2", "m3", "m4", "m5", "m8", "m240i", "m340i", "m440i", "m550i"],
  ["glc", "gle", "gls", "g63", "g500", "gt43", "gt50", "gt53"],
  ["296", "458", "488", "f8", "812", "purosangue", "sf90", "roma"],
];
const MODEL_IDENTITY_STOPWORDS = new Set([
  "audi", "aston", "martin", "benz", "mercedes", "bmw", "porsche", "ferrari",
  "lamborghini", "mclaren", "volkswagen", "toyota", "nissan", "maserati", "land",
  "rover", "chevrolet", "ford", "subaru", "lexus", "jaguar", "mini", "exhaust",
  "system", "engine", "model", "current", "version", "with", "the", "and", "for",
  "bodykit", "sedan", "coupe", "sportback", "touring", "competition", "titanium",
  "stainless", "steel",
]);

function modelIdentityTokens(text: string) {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+(?:\.[a-z0-9]+)?/g) ?? []).filter(
      (token) => token.length >= 3 && !MODEL_IDENTITY_STOPWORDS.has(token)
    )
  );
}

function rejectKnownSiblingModel(productText: string, rowModel: string | null) {
  const productTokens = modelIdentityTokens(productText);
  const rowTokens = modelIdentityTokens(rowModel ?? "");
  for (const family of SIBLING_MODEL_FAMILIES) {
    const productMembers = family.filter((token) => productTokens.has(token));
    const rowMembers = family.filter((token) => rowTokens.has(token));
    if (
      productMembers.length &&
      rowMembers.length &&
      !productMembers.some((token) => rowMembers.includes(token))
    ) {
      return true;
    }
  }
  return false;
}

function normalizeTipChoice(value: string) {
  const text = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/standard|chrome silver|polished silver/.test(text)) return "chrome / polished silver";
  if (/titanium blue/.test(text)) return "titanium blue";
  if (/chrome black|gloss black/.test(text)) return "chrome black";
  if (/carbon fiber/.test(text)) return "carbon fiber";
  if (/black mamba/.test(text)) return "89mm black mamba";
  if (/red mamba/.test(text)) return "89mm red mamba";
  if (/titanium/.test(text) && /(gold|silver|blue)/.test(text)) return "titanium (gold / silver / blue)";
  if (/satin gold/.test(text)) return "satin gold";
  if (/satin silver/.test(text)) return "satin silver";
  return null;
}

function resolveExactSkuVariantPricing(
  variant: {
    sku: string | null;
    option1Value: string | null;
    option2Value: string | null;
    option3Value: string | null;
  },
  rows: readonly IpeParsedPriceListRow[]
): ReturnType<typeof resolveIpeVariantPricing> | null {
  if (!variant.sku || variant.sku.startsWith("IPE-")) return null;
  const skuRows = rows.filter(
    (row) =>
      row.sku === variant.sku &&
      row.price_kind === "absolute" &&
      row.msrp_usd != null &&
      row.msrp_usd > 0
  );
  if (!skuRows.length) return null;

  const optionValues = [variant.option1Value, variant.option2Value, variant.option3Value].filter(
    (value): value is string => Boolean(value)
  );
  const optionText = optionValues.join(" ").toLowerCase();
  const systemOptionCount = optionValues.filter((value) =>
    /full\s*system|cat\s*back|catback|header|downpipe|front\s*pipe|mid\s*pipe|rear\s*valvetronic|valvetronic/i.test(
      value
    )
  ).length;
  if (systemOptionCount > 1) return null;
  if (
    /titanium\s*\(|titanium\s+(?:gold|silver|blue)|titanium\s*blue|chrome\s*black|chrome\s*\/\s*polished\s*silver|polished\s*silver|carbon\s*fiber|satin|black\s*mamba|red\s*mamba|\btips?\b|remote|obd\s*ii|obdii/.test(
      optionText
    )
  ) {
    return null;
  }

  const matchingRows = skuRows.filter((row) => {
    const rowText = [row.section, row.description].filter(Boolean).join(" ").toLowerCase();
    if (/full\s*system/.test(optionText) && !/full\s*system/.test(rowText)) return false;
    if (/equal[-\s]*length/.test(optionText) && !/equal[-\s]*length/.test(rowText)) return false;
    if (/(?:cat\s*back|catback)/.test(optionText) && !/(?:cat\s*back|catback)/.test(rowText)) {
      return false;
    }
    if (/\bheader/.test(optionText) && !/\bheader/.test(rowText)) return false;
    if (/\bdownpipes?\b/.test(optionText) && !/(?:downpipe|cat\s*pipe|header)/.test(rowText)) {
      return false;
    }
    if (/\bcatless\b/.test(optionText) && /\bcatted\b/.test(rowText) && !/\bcatless\b/.test(rowText)) {
      return false;
    }
    if (/\bcatted\b/.test(optionText) && /\bcatless\b/.test(rowText) && !/\bcatted\b/.test(rowText)) {
      return false;
    }
    return true;
  });
  if (!matchingRows.length) return null;

  const distinctMsrp = new Set(matchingRows.map((row) => Number(row.msrp_usd)));
  if (distinctMsrp.size !== 1) return null;
  const row = matchingRows[0];
  return {
    priceUsd: row.retail_usd,
    baseRow: row,
    deltaRows: [],
    includedRows: [],
    reviewReasons: ["sku-exact-complete"],
    confidence: 1,
  };
}

function sanitizeModelString(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  // The 2025 PDF parser sometimes glued cross-section header tokens into the
  // model string, e.g. `"GT3 ... | 992 | (Stainless) | (Stainless + Ti)"`.
  // Those bracketed material/finish notes break MATERIAL_PATTERNS — the SS
  // catback row ends up classified as Ti because "Ti" is a literal inside
  // "(Stainless + Ti)". Strip any "|"-separated fragment that's mostly a
  // material/finish tag in parens.
  const fragments = value
    .split("|")
    .map((f) => f.trim())
    .filter(Boolean);
  const cleaned = fragments.filter((f) => {
    const stripped = f.replace(/^\(|\)$/g, "").trim();
    if (!stripped) return false;
    return !/^(stainless(?:\s+steel)?(?:\s*\+\s*ti(?:tanium)?)?|titanium|ti|ss|carbon(?:\s+fiber)?|cf)$/i.test(
      stripped
    );
  });
  return cleaned.join(" | ") || null;
}

function patchRowFromNew(
  oldRow: IpeParsedPriceListRow,
  newRow: IpeParsedPriceListRow | null
): IpeParsedPriceListRow | null {
  if (!newRow) return null;
  // Update the pricing fields from the new list, but also scrub the model
  // string of stray "(Stainless + Ti)" type fragments left over from the PDF
  // parser — they cause `buildIpeCanonicalTokenSetFromPriceRow` to misclassify
  // SS rows as Ti and end up picking the wrong base row.
  return {
    ...oldRow,
    model: sanitizeModelString(oldRow.model),
    msrp_usd: newRow.msrp_usd ?? oldRow.msrp_usd,
    import_fee_usd: newRow.import_fee_usd ?? oldRow.import_fee_usd,
    retail_usd: newRow.retail_usd ?? oldRow.retail_usd,
    price_kind: newRow.price_kind ?? oldRow.price_kind,
  };
}

async function main() {
  const commit = process.argv.includes("--commit");
  if (AUDIT_ALL && commit) {
    throw new Error("--audit-all is read-only; do not combine it with --commit");
  }
  const handleFilter = process.argv
    .find((arg) => arg.startsWith("--handle="))
    ?.slice("--handle=".length);

  console.log(`Snapshot dir: ${path.basename(SNAPSHOT_DIR)}`);
  console.log(`Price list: ${NEW_PRICE_LIST_PATH}`);
  if (EXCLUDED_HANDLES.size) {
    console.log(`Excluded handles: ${Array.from(EXCLUDED_HANDLES).join(", ")}`);
  }

  const [snapshotRaw, manifestRaw, newRaw] = await Promise.all([
    fs.readFile(SNAPSHOT_PATH, "utf8"),
    fs.readFile(MANIFEST_PATH, "utf8"),
    fs.readFile(NEW_PRICE_LIST_PATH, "utf8"),
  ]);
  const snapshot: IpeOfficialSnapshot = JSON.parse(snapshotRaw);
  const manifest: ManifestFile = JSON.parse(manifestRaw);
  const newList: IpeParsedPriceList = JSON.parse(newRaw);
  const addons: IpeAddonsCatalog = JSON.parse(await fs.readFile(ADDONS_PATH, "utf8"));
  const allParsedRows = newList.items.map((row) => ({
    ...row,
    model: sanitizeModelString(row.model),
  }));
  const preparedRows = allParsedRows.map((row) => ({
    row,
    tokens: buildIpeCanonicalTokenSetFromPriceRow(row),
    engineMarkers: extractEngineMarkers(`${row.model ?? ""} ${row.engine ?? ""}`),
  }));

  // Manifest.rowIndex now references the NEW (2026 xlsx) parsed list directly.
  // Build a same-SKU brand fallback in case the manifest's rowIndex is stale.
  const newBySkuByBrand = new Map<string, Map<string, IpeParsedPriceListRow>>();
  for (const row of newList.items) {
    if (!row.sku) continue;
    let brandMap = newBySkuByBrand.get(row.sku);
    if (!brandMap) {
      brandMap = new Map();
      newBySkuByBrand.set(row.sku, brandMap);
    }
    if (!brandMap.has(row.brand)) brandMap.set(row.brand, row);
  }

  function lookupBySku(sku: string, brand: string): IpeParsedPriceListRow | null {
    const brandMap = newBySkuByBrand.get(sku);
    if (!brandMap) return null;
    return brandMap.get(brand) ?? brandMap.values().next().value ?? null;
  }

  // Global SKU→absolute-row lookup across the entire new price list, used for
  // the SKU-direct fallback. Single-axis variants whose SKU exists anywhere
  // in the parsed list (even if the manifest didn't scope it to this product)
  // can still be re-priced from MSRP. Multi-brand SKU collisions resolve by
  // brand match.
  const absoluteRowBySkuByBrand = new Map<string, Map<string, IpeParsedPriceListRow>>();
  for (const row of newList.items) {
    if (!row.sku || row.price_kind !== "absolute" || row.msrp_usd == null || row.msrp_usd <= 0)
      continue;
    let brandMap = absoluteRowBySkuByBrand.get(row.sku);
    if (!brandMap) {
      brandMap = new Map();
      absoluteRowBySkuByBrand.set(row.sku, brandMap);
    }
    if (!brandMap.has(row.brand)) brandMap.set(row.brand, row);
  }

  function lookupAbsoluteRowBySku(
    sku: string,
    brand?: string | null
  ): IpeParsedPriceListRow | null {
    const brandMap = absoluteRowBySkuByBrand.get(sku);
    if (!brandMap) return null;
    if (brand && brandMap.has(brand)) return brandMap.get(brand)!;
    return brandMap.values().next().value ?? null;
  }

  // Group manifest rows by handle.
  const rowsByHandle = new Map<string, ManifestRow[]>();
  for (const row of manifest.rows) {
    if (!row.officialHandle) continue;
    const list = rowsByHandle.get(row.officialHandle) ?? [];
    list.push(row);
    rowsByHandle.set(row.officialHandle, list);
  }

  let scanned = 0;
  let unchanged = 0;
  let changed = 0;
  let resolveFailed = 0;
  let excluded = 0;
  let reviewSkipped = 0;
  const productUpdates: Array<{
    productId: string;
    slug: string;
    oldUsd: number | null;
    newUsd: number;
  }> = [];
  const resolveFailureDetails: Array<{
    handle: string;
    title: string;
    variantId: string;
    sku: string | null;
    optionValues: string[];
    oldUsd: number | null;
  }> = [];
  const allEvaluations: Array<Record<string, unknown>> = [];
  const evaluatedVariantIds = new Set<string>();
  const diffs: Array<{
    handle: string;
    title: string;
    optionValues: string[];
    oldUsd: number | null;
    newUsd: number | null;
  }> = [];
  const updates: Array<{ variantId: string; priceUsd: number }> = [];

  for (const product of snapshot.products) {
    if (handleFilter && product.handle !== handleFilter) continue;
    if (EXCLUDED_HANDLES.has(product.handle) || EXCLUDED_HANDLES.has(`ipe-${product.handle}`)) {
      excluded += 1;
      continue;
    }
    const manifestRows = rowsByHandle.get(product.handle);
    if (!manifestRows || manifestRows.length === 0) continue;
    scanned += 1;

    // The historical manifest contains review/unresolved rows and can point a
    // product at a sibling model sharing the same chassis family. Re-scope
    // against the complete attached price list using model/chassis guards;
    // use the manifest only as a fallback when the product has no global rows.
    const productTokens = buildIpeCanonicalTokenSetFromOfficialProduct(product);
    const productEngineMarkers = extractEngineMarkers(
      `${product.title} ${product.tags.join(" ")}`
    );
    let priceRows: IpeParsedPriceListRow[] = preparedRows
      .filter(
        ({ row, tokens, engineMarkers }) =>
          modelCompatibleTokenSets(productTokens, tokens) &&
          engineCompatible(productEngineMarkers, engineMarkers) &&
          !rejectKnownSiblingModel(`${product.handle} ${product.title}`, row.model)
      )
      .map(({ row }) => row);
    if (!priceRows.length) {
      priceRows = [];
      for (const m of manifestRows) {
        let row: IpeParsedPriceListRow | null = newList.items[m.rowIndex] ?? null;
        if (!row || row.sku !== m.sku) {
          row = lookupBySku(m.sku, m.brand);
        }
        if (row) {
          priceRows.push({
            ...row,
            model: sanitizeModelString(row.model),
          });
        }
      }
    }
    if (!priceRows.length) continue;

    // Pull the DB product. iPE Shopify handles like "bmw-m3-m4-g80-g82-exhaust"
    // map onto our slugs as "ipe-bmw-m3-m4-g80-g82-exhaust" (the importer
    // namespaces them) — try both forms.
    const dbProduct = await prisma.shopProduct.findFirst({
      where: { slug: { in: [product.handle, `ipe-${product.handle}`] } },
      include: { variants: true, options: true },
    });
    if (!dbProduct) continue;

    const candidates = buildIpeVariantCandidates(product as IpeOfficialProductSnapshot, priceRows);
    const candidateBySig = new Map<string, ReturnType<typeof resolveIpeVariantPricing>>();
    const candidateBySku = new Map<
      string,
      Array<ReturnType<typeof resolveIpeVariantPricing>>
    >();
    for (const candidate of candidates) {
      const pricing = resolveIpeVariantPricing(
        product as IpeOfficialProductSnapshot,
        candidate,
        priceRows
      );
      candidateBySig.set(variantSignature(candidate.optionValues), pricing);
      const candidateSku = candidate.baseRow?.sku ?? null;
      if (candidateSku) {
        const matches = candidateBySku.get(candidateSku) ?? [];
        matches.push(pricing);
        candidateBySku.set(candidateSku, matches);
      }
    }

    // Pick a representative brand for SKU-direct lookup (some SKUs appear under
    // multiple brands — prefer the one this product belongs to).
    const productBrand = priceRows.find((r) => r.brand)?.brand ?? null;

    for (const dbVariant of dbProduct.variants) {
      evaluatedVariantIds.add(dbVariant.id);
      const sig = variantSignature([
        dbVariant.option1Value,
        dbVariant.option2Value,
        dbVariant.option3Value,
      ]);
      // Prefer SKU-based matching when the DB variant carries a non-synthetic
      // SKU — the option-value text in the DB was generated from the previous
      // price list, so the same row often has a slightly different
      // section/description string in the new list (e.g. an extra "OPF
      // Version" appendix). SKU is the stable join key.
      let pricing: ReturnType<typeof resolveIpeVariantPricing> | undefined;
      const exactSkuPricing = resolveExactSkuVariantPricing(dbVariant, priceRows);
      if (exactSkuPricing) pricing = exactSkuPricing;
      const optionValues = [
        dbVariant.option1Value,
        dbVariant.option2Value,
        dbVariant.option3Value,
      ].filter((value): value is string => Boolean(value));
      const optionText = optionValues.join(" ").toLowerCase();
      const hasAdditiveOption =
        /titanium\s*\(|titanium\s+(?:gold|silver|blue)|titanium\s*blue|chrome\s*black|chrome\s*\/\s*polished\s*silver|polished\s*silver|carbon\s*fiber|satin|black\s*mamba|red\s*mamba|\btips?\b/.test(
          optionText
        );
      const duplicateCatbackOptions =
        optionValues.filter((value) => /cat\s*back|catback/i.test(value)).length > 1;
      if (!AUDIT_ALL && !exactSkuPricing && (hasAdditiveOption || duplicateCatbackOptions)) {
        reviewSkipped += 1;
        continue;
      }
      if (dbVariant.sku && !dbVariant.sku.startsWith("IPE-")) {
        const skuMatches = candidateBySku.get(dbVariant.sku) ?? [];
        // A SKU can legitimately be shared by several configurations in the
        // price list (for example a base exhaust plus different tip/section
        // axes). Only use the SKU shortcut when it identifies one candidate;
        // otherwise let the normalized option signature decide, or leave the
        // variant for review instead of assigning a sibling's price.
        if (!pricing && skuMatches.length === 1) pricing = skuMatches[0];
      }
      if (!pricing && sig) {
        pricing = candidateBySig.get(sig);
      }
      if (AUDIT_ALL && (!pricing || pricing.priceUsd == null)) {
        const auditVariantId = `audit:${dbVariant.id}`;
        const auditVariant = {
          id: auditVariantId,
          title: dbVariant.title,
          sku: dbVariant.sku,
          available: true,
          featuredImage: dbVariant.image ?? null,
          optionValues,
          optionMap: Object.fromEntries(
            dbProduct.options
              .slice(0, optionValues.length)
              .map((option, index) => [option.name, optionValues[index]])
          ),
        };
        const auditProduct: IpeOfficialProductSnapshot = {
          ...product,
          variants: [...product.variants, auditVariant],
        };
        pricing = resolveIpeVariantPricing(
          auditProduct,
          {
            source: "official",
            title: dbVariant.title,
            optionNames: dbProduct.options.map((option) => option.name).slice(0, 3),
            optionValues,
            officialVariantId: auditVariantId,
          },
          priceRows
        );
      }
      // SKU-direct fallback: when candidate matching fails but the variant has
      // a real SKU that exists as an absolute row anywhere in the parsed list,
      // AND the variant is single-axis (no combo). For combo variants
      // (option2+option3 populated with distinct values) we skip — the SKU
      // represents only one component, not the full price.
      if (
        (!pricing || pricing.priceUsd == null) &&
        dbVariant.sku &&
        !dbVariant.sku.startsWith("IPE-")
      ) {
        const o1 = dbVariant.option1Value?.trim().toLowerCase() ?? "";
        const o2 = dbVariant.option2Value?.trim().toLowerCase() ?? "";
        const o3 = dbVariant.option3Value?.trim().toLowerCase() ?? "";
        const populated = [o1, o2, o3].filter(Boolean);
        const distinct = new Set(populated);
        const isCombo =
          distinct.size >= 3 ||
          (distinct.size === 2 &&
            /tips|carbon|titanium|chrome|valvetronic|obdii|remote/.test(o1 + " " + o2 + " " + o3));
        if (!isCombo) {
          const directRow = lookupAbsoluteRowBySku(dbVariant.sku, productBrand);
          if (directRow && directRow.msrp_usd != null && directRow.msrp_usd > 0) {
            const retail = computeIpeRetailPrice(directRow.msrp_usd);
            if (retail != null && retail > 0) {
              pricing = {
                priceUsd: retail,
                baseRow: directRow,
                deltaRows: [],
                includedRows: [],
                reviewReasons: ["sku-direct-fallback"],
                confidence: 1,
              };
            }
          }
        }
      }
      if (!pricing || pricing.priceUsd == null || pricing.priceUsd <= 0) {
        resolveFailed += 1;
        resolveFailureDetails.push({
          handle: product.handle,
          title: product.title,
          variantId: dbVariant.id,
          sku: dbVariant.sku,
          optionValues: [
            dbVariant.option1Value,
            dbVariant.option2Value,
            dbVariant.option3Value,
          ].filter((v): v is string => Boolean(v)),
          oldUsd: dbVariant.priceUsd != null ? Number(dbVariant.priceUsd) : null,
        });
        if (AUDIT_ALL) {
          allEvaluations.push({
            handle: product.handle,
            productSlug: dbProduct.slug,
            variantId: dbVariant.id,
            sku: dbVariant.sku,
            optionValues,
            currentUsd: dbVariant.priceUsd != null ? Number(dbVariant.priceUsd) : null,
            expectedUsd: null,
            sourceStatus: "unresolved",
            confidence: null,
            reviewReasons: ["base-price-row-unresolved"],
            baseRow: null,
            deltaRows: [],
          });
        }
        continue;
      }
      const pricingBaseText = [
        pricing.baseRow?.section,
        pricing.baseRow?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const fullSystemMissingDelta =
        /full\s*system/.test(optionText) &&
        pricing.deltaRows.length === 0 &&
        !/full\s*system|header\s*back|downpipe[\s\S]*\+|\+[\s\S]*downpipe/.test(pricingBaseText);
      if (!AUDIT_ALL && fullSystemMissingDelta) {
        reviewSkipped += 1;
        continue;
      }
      if (!AUDIT_ALL && pricing.reviewReasons.includes("base-price-row-ambiguous")) {
        reviewSkipped += 1;
        continue;
      }
      const oldUsd = dbVariant.priceUsd != null ? Number(dbVariant.priceUsd) : null;
      let newUsd = Number(pricing.priceUsd);
      const hasExplicitTipChoice =
        /titanium|chrome|polished silver|carbon|mamba|satin|\btips?\b/.test(optionText) ||
        /стандартні/.test(optionText);
      const quadTips = inferQuadTipsFromText(
        product.title,
        product.bodyHtml,
        dbProduct.titleEn,
        dbProduct.titleUa,
        ...optionValues
      );
      const tipOptions = selectIpeTipOptions(priceRows, addons, { quadTips });
      const requestedTipKey = optionValues.map(normalizeTipChoice).find(Boolean) ?? null;
      const matchedTip = requestedTipKey
        ? tipOptions.find((option) => normalizeTipChoice(option.label) === requestedTipKey)
        : null;
      const selectedTipAlreadyPriced = pricing.deltaRows.some(
        (row) => buildIpeCanonicalTokenSetFromPriceRow(row).systemFamily === "tips"
      );
      let tipAuditStatus = "not-applicable";
      const additionalReviewReasons = pricing.reviewReasons.filter(
        (reason) => reason !== "sku-exact-complete"
      );
      if (fullSystemMissingDelta) additionalReviewReasons.push("full-system-missing-component");
      if (hasExplicitTipChoice && requestedTipKey) {
        if (!matchedTip) {
          tipAuditStatus = "tip-option-unmatched";
          additionalReviewReasons.push("tip-option-unmatched");
        } else if (matchedTip.msrpDelta > 0 && !selectedTipAlreadyPriced) {
          const totalMsrp =
            Number(pricing.baseRow?.msrp_usd ?? 0) +
            pricing.deltaRows.reduce((sum, row) => sum + Number(row.msrp_usd ?? 0), 0) +
            matchedTip.msrpDelta;
          const repriced = computeIpeRetailPrice(totalMsrp);
          if (repriced != null) {
            newUsd = Number(repriced.toFixed(2));
            tipAuditStatus = "tip-delta-applied";
          } else {
            tipAuditStatus = "tip-delta-unpriced";
            additionalReviewReasons.push("tip-delta-unpriced");
          }
        } else {
          tipAuditStatus = selectedTipAlreadyPriced ? "tip-delta-in-resolver" : "standard-tip";
        }
      }
      if (AUDIT_ALL) {
        const sourceStatus = additionalReviewReasons.length
          ? "needs-review"
          : oldUsd != null && Math.abs(oldUsd - newUsd) >= 0.01
            ? "price-mismatch"
            : "price-matches-source";
        allEvaluations.push({
          handle: product.handle,
          productSlug: dbProduct.slug,
          variantId: dbVariant.id,
          sku: dbVariant.sku,
          optionValues,
          currentUsd: oldUsd,
          expectedUsd: newUsd,
          sourceStatus,
          confidence: pricing.confidence,
          dbSkuMatchesBaseRow: Boolean(dbVariant.sku && dbVariant.sku === pricing.baseRow?.sku),
          tipAuditStatus,
          matchedTip: matchedTip
            ? { label: matchedTip.label, source: matchedTip.source, msrpDelta: matchedTip.msrpDelta }
            : null,
          reviewReasons: additionalReviewReasons,
          baseRow: pricing.baseRow
            ? {
                sku: pricing.baseRow.sku,
                model: pricing.baseRow.model,
                section: pricing.baseRow.section,
                description: pricing.baseRow.description,
                msrpUsd: pricing.baseRow.msrp_usd,
                priceKind: pricing.baseRow.price_kind,
              }
            : null,
          deltaRows: pricing.deltaRows.map((row) => ({
            sku: row.sku,
            section: row.section,
            description: row.description,
            msrpUsd: row.msrp_usd,
            priceKind: row.price_kind,
          })),
        });
      }
      if (oldUsd != null && Math.abs(oldUsd - newUsd) < 0.01) {
        unchanged += 1;
        continue;
      }
      changed += 1;
      diffs.push({
        handle: product.handle,
        title: product.title,
        optionValues: [
          dbVariant.option1Value,
          dbVariant.option2Value,
          dbVariant.option3Value,
        ].filter((v): v is string => Boolean(v)),
        oldUsd,
        newUsd,
      });
      updates.push({ variantId: dbVariant.id, priceUsd: newUsd });
    }

    const defaultVariant =
      dbProduct.variants.find((variant) => variant.isDefault) ??
      [...dbProduct.variants].sort(
        (left, right) => left.position - right.position || left.id.localeCompare(right.id)
      )[0];
    const defaultUpdate = defaultVariant
      ? updates.find((update) => update.variantId === defaultVariant.id)
      : undefined;
    const oldProductUsd = dbProduct.priceUsd != null ? Number(dbProduct.priceUsd) : null;
    if (
      defaultUpdate &&
      (oldProductUsd == null || Math.abs(oldProductUsd - defaultUpdate.priceUsd) >= 0.01)
    ) {
      productUpdates.push({
        productId: dbProduct.id,
        slug: dbProduct.slug,
        oldUsd: oldProductUsd,
        newUsd: defaultUpdate.priceUsd,
      });
    }
  }

  console.log(`Scanned ${scanned} iPE products from snapshot.`);
  console.log(
    `Variant updates: ${changed} | unchanged: ${unchanged} | resolve-failed: ${resolveFailed}`
  );
  if (excluded) console.log(`Excluded products: ${excluded}`);
  console.log(`Product base-price updates: ${productUpdates.length}`);
  console.log(`Resolve-failure details: ${resolveFailureDetails.length}`);
  console.log(`Review-skipped variants: ${reviewSkipped}`);
  if (AUDIT_ALL) {
    const dbProducts = await prisma.shopProduct.findMany({
      where: { brand: { contains: "iPE", mode: "insensitive" } },
      include: { variants: { orderBy: { position: "asc" } } },
      orderBy: { slug: "asc" },
    });
    for (const dbProduct of dbProducts) {
      const handle = dbProduct.slug.replace(/^ipe-/, "");
      for (const variant of dbProduct.variants) {
        if (evaluatedVariantIds.has(variant.id)) continue;
        const isExcluded = EXCLUDED_HANDLES.has(handle) || EXCLUDED_HANDLES.has(dbProduct.slug);
        allEvaluations.push({
          handle,
          productSlug: dbProduct.slug,
          variantId: variant.id,
          sku: variant.sku,
          optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
            (value): value is string => Boolean(value)
          ),
          currentUsd: variant.priceUsd != null ? Number(variant.priceUsd) : null,
          expectedUsd: null,
          sourceStatus: isExcluded ? "manual-price-excluded" : "not-resolved-from-snapshot",
          confidence: null,
          reviewReasons: [
            isExcluded ? "user-set-price-excluded-from-edits" : "no-source-snapshot-or-price-rows",
          ],
          baseRow: null,
          deltaRows: [],
        });
      }
    }
    const statusCounts = allEvaluations.reduce<Record<string, number>>((counts, evaluation) => {
      const status = String(evaluation.sourceStatus ?? "unknown");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const auditPath = AUDIT_OUT_ARG
      ? path.resolve(process.cwd(), AUDIT_OUT_ARG)
      : path.join(ART_ROOT, "ipe-audit-2026-09-22", "variant-price-review.json");
    await fs.mkdir(path.dirname(auditPath), { recursive: true });
    await fs.writeFile(
      auditPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourcePriceList: NEW_PRICE_LIST_PATH,
          sourceAddons: ADDONS_PATH,
          productsInSnapshot: snapshot.products.length,
          databaseVariantCount: allEvaluations.length,
          statusCounts,
          evaluations: allEvaluations,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`Complete variant audit: ${auditPath}`);
    console.log(`Audit status counts: ${JSON.stringify(statusCounts)}`);
    await prisma.$disconnect();
    return;
  }
  if (diffs.length) {
    console.log("\nAll changes:");
    for (const d of diffs) {
      const opt = d.optionValues.join(" / ");
      console.log(`  [${d.handle}] ${opt}\n    $${d.oldUsd ?? "?"} -> $${d.newUsd}`);
    }
    // Persist full diff list for audit/review
    const auditDir = path.join(process.cwd(), "artifacts", "ipe-audit-2026-05-13");
    await fs.mkdir(auditDir, { recursive: true });
    const auditPath = path.join(auditDir, `diffs-${commit ? "committed" : "dryrun"}.json`);
    await fs.writeFile(
      auditPath,
      JSON.stringify(
        {
          committedAt: new Date().toISOString(),
          commit,
          scanned,
          changed,
          unchanged,
          resolveFailed,
          reviewSkipped,
          productUpdates,
          resolveFailureDetails,
          diffs,
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`\nFull diff JSON: ${auditPath}`);
  }

  if (commit && updates.length) {
    console.log(`\nCommitting ${updates.length} variant price updates...`);
    let n = 0;
    for (const u of updates) {
      await prisma.shopProductVariant.update({
        where: { id: u.variantId },
        data: { priceUsd: new Decimal(u.priceUsd.toFixed(2)) },
      });
      n += 1;
      if (n % 25 === 0) console.log(`  ...${n} updated`);
    }
    console.log(`Done: ${n} variants updated.`);
    for (const u of productUpdates) {
      await prisma.shopProduct.update({
        where: { id: u.productId },
        data: { priceUsd: new Decimal(u.newUsd.toFixed(2)) },
      });
    }
    if (productUpdates.length) {
      console.log(`Done: ${productUpdates.length} product base prices updated.`);
    }
  } else if (!commit) {
    console.log("\n(dry run — pass --commit to write)");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
