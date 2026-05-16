import type { ShopProduct } from "@/lib/shopCatalog";
import { DO88_COLLECTION_CARDS } from "@/app/[locale]/shop/data/do88CollectionsList";

type Do88MatcherProduct = Pick<
  ShopProduct,
  "brand" | "title" | "collection" | "tags" | "collections" | "slug"
>;

const HANDLE_TO_ALIASES: Record<string, string[]> = {
  intercoolers: [
    // NB: keep `intercooler` and `icm` (do88 SKU prefix for intercoolers).
    // Do NOT add a bare `ic` alias — substring-match would catch `vehicle`,
    // `specific`, etc. and pull in turbos / intakes / water coolers.
    "intercooler",
    "charge air cooler",
    "icm-",
    "laddluftkylare",
    "intercoolerrör",
    "ic radiat",
    // Big Pack bundles (do88's BIG-xxx SKUs) ship a high-performance
    // intercooler as the core component plus matching boost pipes — a
    // customer browsing /intercoolers genuinely wants to see them. The
    // same SKU also surfaces in /performance-hoses via the `boost`/`pipe`
    // aliases there, which is correct (one product → multiple categories).
    "big pack",
    "bigpack",
    "intercooler kit",
  ],
  radiators: [
    "radiator",
    "water cooler",
    "cooling module",
    "csf",
    "kylare",
    "radiat",
    "expansionskärl",
    "värmepaketslangar",
    "värmepaket",
  ],
  "intake-systems": [
    "intake",
    "air filter",
    "induction",
    "air box",
    "insugssystem",
    "inloppsrör",
    "inloppsslang",
    "insugsslangar",
    "luftfilter",
    "luftrenarslangar",
    "spjällhus",
    "resonator",
  ],
  "performance-hoses": [
    "hose",
    "silicone",
    "coolant hose",
    "boost hose",
    "intake hose",
    "tryckslangar",
    "tryckrör",
    "slangar",
    "slang",
    "vakuumslangar",
    "vevhusvent",
    "servoslang",
    "tomgångsmotor",
    "dumpslang",
    "f slang",
    "f hose",
  ],
  "oil-coolers": [
    "oil cooler",
    "dsg cooler",
    "transmission cooler",
    "oljekylare",
    "maslyanyy",
    "transmissionskylare",
  ],
  "y-pipes-plenums": ["y-pipe", "plenum", "charge pipe", "j-pipe", "y pipe", "y rör", "y труба"],
  "cooling-accessories": [
    "fan",
    "shroud",
    "cap",
    "accessory",
    "tillbehör",
    "slangklämme",
    "klämme",
    "kit",
    "bigpack",
    "big pack",
    "dämpare",
    "cobra head",
    "reducer",
    "kon",
    "aluminiumkon",
    "spacer",
    "adapter",
    "connector",
    "vta",
    "gfb",
    "dv",
    "garrett",
    "powermax",
    "bmc",
  ],
};

function normalizeDo88Value(value: string | undefined | null): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[./-]/g, " ")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => normalizeDo88Value(value)).filter(Boolean)));
}

function getHandleAliases(handle: string, title?: string) {
  const card = DO88_COLLECTION_CARDS.find((item) => item.categoryHandle === handle);

  return unique([...(HANDLE_TO_ALIASES[handle] ?? []), title, card?.title]);
}

function getSearchCandidates(product: Do88MatcherProduct) {
  return unique([
    product.title.en,
    product.title.ua,
    product.collection.en,
    product.collection.ua,
    ...(product.collections ?? []).flatMap((item) => [item.title.en, item.title.ua]),
    ...(product.tags ?? []),
    product.slug,
  ]);
}

// Word-boundary regex for short aliases. Substring-match on a 2- or 3-letter
// alias (`ic`, `dv`, `cap`, `fan`, `kit`, `vta`, `gfb`) catches incidental
// occurrences inside unrelated words (`vehicle`, `specific`, `advance`,
// `fanatic`, `escape`, etc.) and contaminates entire collections — most
// notoriously dumping turbos and intake systems into "intercoolers" because
// every Do88 product carries a `Vehicle Specific` tag containing "ic".
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function aliasMatchesCandidate(alias: string, candidate: string) {
  if (candidate === alias) return "exact";
  if (alias.length <= 3) {
    // Treat candidates as space-tokenized — normalizeDo88Value collapses
    // punctuation to spaces, so \b on word characters is enough.
    const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
    return re.test(candidate) ? "boundary" : null;
  }
  return candidate.includes(alias) ? "substring" : null;
}

function getDo88MatchScore(product: Do88MatcherProduct, handle: string, title?: string) {
  const aliases = getHandleAliases(handle, title);
  const searchCandidates = getSearchCandidates(product);
  let score = 0;

  aliases.forEach((alias) => {
    searchCandidates.forEach((candidate) => {
      const kind = aliasMatchesCandidate(alias, candidate);
      if (kind === "exact") {
        score = Math.max(score, 100);
      } else if (kind === "substring" || kind === "boundary") {
        score = Math.max(score, 85);
      }
    });
  });

  return score;
}

/**
 * Vehicle-specific products we explicitly exclude from the One Company DO88
 * shop. The supplier catalog includes Volvo, Saab, and decades-old Audi/BMW/VW
 * platforms that don't fit our target audience (modern performance cars).
 *
 * Generic raw components (silicone elbows, Garrett cores, BMC filters, hose
 * clamps) DO pass this filter — they live in the cooling-accessories /
 * performance-hoses categories and are useful to tuners building custom
 * systems.
 */
const EXCLUDED_VEHICLE_PATTERNS: RegExp[] = [
  // Volvo (all chassis)
  /\bvolvo\b/i,
  /\b(?:240|740|850|940|s60|v60|v70|s70|xc60|xc70|xc90)\b/i,

  // Saab (specific chassis only — "9-X" alone would falsely match Porsche 911/991/992)
  /\bsaab\b/i,
  /\b9-3\b/i,
  /\b9-5\b/i,
  /\b9000\b/i,
  /\bsaab\s*900\b/i,
  /\bog\s*900\b/i,

  // Old Audi (only RS6/RS7 C8, RS3, TTRS, A3/S3 8V/8Y 2015+ are kept).
  // Use narrow patterns to avoid false-positives like "B58" engine code.
  /\baudi\s+(?:s2|rs2|80|90|100|200|a4|s4|a6|s6|a8|s8)\b/i,
  /\brs[67]\s*\(?(?:c[567])\b/i, // RS6/RS7 pre-C8
  /\b\d{4}-\d{4}\b\s*(?:s2|rs2)\b/i,
  /\b(?:aby|adu|3b)\b\s*(?:1\d{3})/i, // old engines paired with 19XX
  /\baudi\s+s[3-6]\s+tt\b/i, // old A3/S3 TT 8L/8N
  /\b(?:8l|8n|8p)\b/i, // old A3/TT chassis (8V/8S/8Y stay)
  /\baudi\b[^.]*\b(?:b5|b6|b7|b8|b9)\b/i, // A4/A6 platform codes only when "Audi" is present

  // Old BMW chassis (only G87/G80/G82/F87/F80/F82/G20/G22/G29 stay)
  /\b(?:e2[0-9]|e3[0-9]|e4[0-9]|e5[0-9]|e6[0-9]|e7[0-9]|e8[0-9]|e9[0-9])\b/i,
  /\b(?:f10|f11|f20|f21|f22|f23|f30|f31|f32|f33|f34|f36)\b/i,

  // Old VW (only Mk7/Mk7.5/Mk8 Golf stay)
  /\b(?:mk[1-6]|mark\s*[1-6])\b/i,
  /\b1\.8t\b\s+(?:8l|8n|mk[1-6])/i,

  // Old Porsche
  /\b911\s*\(?930\)?\b/i,

  // Brands not in the One Company target list. Pure-brand exclusions only
  // (no in-scope co-occurrence) — see VAG_SISTER_BRAND_PATTERNS below for the
  // multi-fit relaxation that lets MQB/EA888 platform parts surface.
  /\bsuzuki\b/i,
  /\bopel\b/i,
  /\bbuick\b/i,
  /\bford\b/i,
  /\bmazda\b/i,
  /\brenault\b/i,
  /\balpine\s*(?:a110|a90)/i,
  /\bvectra\b/i,
  /\binsignia\b/i,
  /\bformentor\b/i,
  /\bswift\b/i,

  // Old / unsupported Audi platforms not covered by the chassis exclusions
  /\baudi\s+quattro\s+\d+v\b/i,
  /\b20v\s+(?:turbo|quattro)\b/i,
  /\baudi\s+rs4\b/i, // RS4 not in target list (only RS3, RS6/RS7 C8)
];

/**
 * VAG sister brands (CUPRA / SEAT / Skoda) appear in two contexts in the do88
 * catalog: (a) as the primary brand of a sister-only product (e.g. Formentor
 * VZ5 intercooler — these we don't sell), and (b) as a multi-fit label on
 * platform parts whose primary fitment is the Audi/VW we DO sell, e.g.
 * "AUDI SEAT SKODA VW 1.8 / 2.0 TSI (MQB) Intercooler". We only exclude
 * the (a) case — when no in-scope brand co-occurs in the haystack.
 */
const VAG_SISTER_BRAND_PATTERNS: RegExp[] = [/\bcupra\b/i, /\bseat(?:\b|\s)/i, /\bskoda\b/i];
// Includes platform tokens (MQB, EA888) so do88's "VAG ... MQB Evo" / "MQB Evo
// 2.0 TSI EA888 Gen4" multi-fit titles for the Mk7/Mk8 Golf survive even when
// they sit in the supplier's CUPRA folder.
const VAG_IN_SCOPE_TOKENS = /\b(?:audi|vw|volkswagen|vag|porsche|bmw|toyota|mqb|ea888)\b/i;

function isExcludedVehicleProduct(product: Pick<ShopProduct, "title" | "collection" | "tags">) {
  const haystack = [
    product.title.en,
    product.title.ua,
    product.collection.en,
    product.collection.ua,
    ...(product.tags ?? []),
  ].join(" ");
  if (EXCLUDED_VEHICLE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return true;
  }
  // VAG sister-brand mention without any in-scope brand → pure SEAT/Skoda/CUPRA
  // product, exclude. With an in-scope brand co-occurring → multi-fit, keep.
  if (VAG_SISTER_BRAND_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return !VAG_IN_SCOPE_TOKENS.test(haystack);
  }
  return false;
}

/**
 * Cheap raw components (silicone elbows, individual hose clamps, fuel
 * lines, small fittings) make the catalog feel like a parts bin instead
 * of a performance store. Per One Company curation policy, only products
 * priced at €200+ surface in DO88 listings — performance kits, complete
 * systems, intercoolers, Big Packs, etc.
 */
const DO88_MIN_PRICE_EUR = 200;

function getProductMaxEurPrice(product: Pick<ShopProduct, "price" | "variants">): number {
  // Prefer variant pricing (where the actual `effectivePrice` lives), fall
  // back to the top-level `price` field for older catalog snapshots.
  const variants = product.variants ?? [];
  let max = 0;
  for (const variant of variants) {
    const eur =
      (variant as { pricing?: { effectivePrice?: { eur?: number } } }).pricing?.effectivePrice
        ?.eur ?? 0;
    if (eur > max) max = eur;
  }
  if (max > 0) return max;
  return product.price?.eur ?? 0;
}

function isBelowDo88Threshold(product: Pick<ShopProduct, "price" | "variants">) {
  const eur = getProductMaxEurPrice(product);
  // 0 means "no price published" — we keep those visible because the page
  // shows "Запит по товару" rather than mis-filtering them out.
  if (eur === 0) return false;
  return eur < DO88_MIN_PRICE_EUR;
}

export function getProductsForDo88Collection(
  products: ShopProduct[],
  handle: string,
  title?: string
) {
  const do88Products = products.filter((p) => {
    if (p.brand.toLowerCase() !== "do88") return false;
    if (isExcludedVehicleProduct(p)) return false;
    if (isBelowDo88Threshold(p)) return false;
    return true;
  });

  if (handle === "all") {
    return do88Products.sort((a, b) => a.title.en.localeCompare(b.title.en));
  }

  return do88Products
    .map((product) => ({
      product,
      score: getDo88MatchScore(product, handle, title),
    }))
    .filter((entry) => entry.score >= 60)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.product.title.en.localeCompare(right.product.title.en);
    })
    .map((entry) => entry.product);
}

export function getDo88CollectionHandleForProduct(product: Do88MatcherProduct) {
  if (product.brand.toLowerCase() !== "do88") return null;

  let bestHandle: string | null = null;
  let bestScore = 0;

  DO88_COLLECTION_CARDS.forEach((card) => {
    const score = getDo88MatchScore(product, card.categoryHandle, card.title);
    if (score > bestScore) {
      bestScore = score;
      bestHandle = card.categoryHandle;
    }
  });

  return bestScore >= 60 ? bestHandle : null;
}

export function isDo88CatalogProduct(product: ShopProduct) {
  if (product.brand.toLowerCase() !== "do88") return false;
  if (isExcludedVehicleProduct(product)) return false;
  if (isBelowDo88Threshold(product)) return false;
  return true;
}
