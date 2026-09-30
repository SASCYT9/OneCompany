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

export function getProductsForDo88Collection(
  products: ShopProduct[],
  handle: string,
  title?: string
) {
  const do88Products = products.filter((p) => {
    if (p.brand.toLowerCase() !== "do88") return false;
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
  return true;
}
