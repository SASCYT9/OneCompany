/**
 * Smart Related Products — matches products by vehicle fitment extracted from titles.
 *
 * Scoring priority:
 * 1. Same brand + same vehicle model/chassis code (e.g. "BMW M5 F90") → highest
 * 2. Same brand + same vehicle make (e.g. "BMW")                     → medium
 * 3. Same brand + same category                                      → low
 * 4. Same brand only                                                  → minimal
 * 5. Same scope fallback                                              → last resort
 */

import type { ShopProduct } from './shopCatalog';

/* ── Vehicle token extraction ────────────────────────────────── */

/** Known vehicle chassis / platform codes to boost matching weight */
const CHASSIS_CODES = new Set([
  // BMW
  'E30','E36','E46','E82','E87','E90','E91','E92','E93','F06','F10','F12','F13',
  'F15','F16','F20','F22','F30','F31','F32','F33','F34','F36','F40','F80','F82',
  'F83','F85','F86','F87','F90','F91','F92','F93','F95','F96','F97','F98',
  'G01','G02','G05','G06','G07','G08','G11','G12','G14','G15','G16','G20','G21',
  'G22','G23','G26','G29','G30','G31','G32','G42','G43','G70','G80','G81','G82',
  'G83','G87','G8X',
  // Audi
  'B9','B9.5','C8','D5','PQ35',
  // Porsche
  '991','991.1','991.2','992','992.1','992.2','718','981','982','9YA','9Y0','9PA',
  // Mercedes
  'W463','W464','W465','W176','W177','W205','W206','W213','W222','W223',
  'C190','C63','C43','C167','X167','R231','R232',
  // Range Rover / Land Rover
  'L405','L460','L461','L462','L494','L538','L551','L663',
  // Lamborghini
  'LP610','LP640','LP700','LP740','LP750',
  // Others
  'R56','R57','R58','R59','GR','JCW','SVR','SVJ','SE',
]);

/**
 * Extract vehicle-identifying tokens from a product title.
 * Tries to parse the part after "for" which typically has "MAKE MODEL (CHASSIS) YEAR".
 */
export function extractVehicleTokens(title: string): {
  make: string | null;
  chassisCodes: string[];
  modelTokens: string[];
  allTokens: string[];
} {
  const normalized = title.toUpperCase();

  // Try to extract the vehicle part after "for". If absent (iPE-style titles
  // like "BMW M3 / M4 (G80 / G82) Exhaust System"), fall back to the whole
  // title so make and chassis codes can still be picked up.
  const forMatch = normalized.match(/\bFOR\s+(.+?)(?:\s*(?:EC\s|OPF|GPF|FACELIFT|\d{4}\s*[-–])|\s*$)/);
  const vehiclePart = forMatch ? forMatch[1] : normalized;

  // Tokenize
  const rawTokens = vehiclePart
    .replace(/[()\/,]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  // The first token is typically the make
  const make = rawTokens.length > 0 ? rawTokens[0] : null;

  // Find chassis codes
  const chassisCodes = rawTokens.filter(t => CHASSIS_CODES.has(t));

  // Model tokens: significant words (not year numbers, not single letters)
  const modelTokens = rawTokens.filter(t =>
    t.length > 1 &&
    !/^\d{4}$/.test(t) &&      // not a 4-digit year
    !/^[-–]$/.test(t)          // not dashes
  );

  return {
    make,
    chassisCodes,
    modelTokens,
    allTokens: rawTokens,
  };
}

/* ── Scoring ────────────────────────────────────────────────── */

function scoreRelated(
  current: ShopProduct,
  candidate: ShopProduct,
  currentTokens: ReturnType<typeof extractVehicleTokens>
): number {
  let score = 0;
  const title = (candidate.title?.en || '').toUpperCase();

  // ── Brand match: +10 ──
  const sameBrand =
    current.brand.toUpperCase() === candidate.brand.toUpperCase();
  if (sameBrand) score += 10;

  // ── Category match: +3 ──
  const currentCat = (current.category?.en || '').toUpperCase();
  const candidateCat = (candidate.category?.en || '').toUpperCase();
  if (currentCat && candidateCat && currentCat === candidateCat) score += 3;

  // ── Vehicle matching ──
  if (currentTokens.make && title.includes(currentTokens.make)) {
    // Same vehicle make: +20
    score += 20;
  }

  // Chassis code matches: +30 each (strongest signal)
  for (const code of currentTokens.chassisCodes) {
    if (title.includes(code)) {
      score += 30;
    }
  }

  // Model token overlap: +5 each
  const candidateTokens = extractVehicleTokens(candidate.title?.en || '');
  const overlapCount = currentTokens.modelTokens.filter(t =>
    candidateTokens.modelTokens.includes(t)
  ).length;
  score += overlapCount * 5;

  return score;
}

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Find related products using smart vehicle-fitment matching.
 * Returns up to `limit` products, sorted by relevance score.
 */
export function findRelatedProducts(
  currentProduct: ShopProduct,
  allProducts: ShopProduct[],
  limit = 3
): ShopProduct[] {
  const currentTokens = extractVehicleTokens(currentProduct.title?.en || '');
  const candidates = allProducts.filter(p => p.slug !== currentProduct.slug);

  const scored = candidates.map(candidate => ({
    product: candidate,
    score: scoreRelated(currentProduct, candidate, currentTokens),
  }));

  // Sort by score descending, then by same brand first
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: prefer same brand
    const aBrand = a.product.brand.toUpperCase() === currentProduct.brand.toUpperCase() ? 1 : 0;
    const bBrand = b.product.brand.toUpperCase() === currentProduct.brand.toUpperCase() ? 1 : 0;
    return bBrand - aBrand;
  });

  return scored.slice(0, limit).map(s => s.product);
}
