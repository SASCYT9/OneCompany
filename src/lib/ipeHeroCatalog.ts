import type { ShopProduct } from '@/lib/shopCatalog';
import {
  resolveIpeProductLine,
  resolveIpeVehicleBrand,
  resolveIpeVehicleModel,
} from '@/lib/ipeCatalog';

// Single source of truth for the brand-dropdown order in BOTH the hero
// finder (/ua/shop/ipe) and the catalog-side filter
// (/ua/shop/ipe/collections). Keeping the two filters in sync prevents the
// jarring "Porsche, BMW, Mercedes-AMG" → "Porsche, BMW, Mercedes-Benz"
// reorder users used to see when navigating between them.
export const IPE_HERO_BRAND_PRIORITY = [
  'Porsche',
  'Ferrari',
  'Lamborghini',
  'McLaren',
  'BMW',
  'Mercedes-AMG',
  'Mercedes-Benz',
  'Audi',
  'Aston Martin',
  'Maserati',
  'Volkswagen',
  'Toyota',
  'Nissan',
  'Ford',
  'Subaru',
];

export type IpeHeroVehicleBody = {
  /** Display label, e.g. "G80/G82" — typically the chassis code or body
   *  generation pulled from the parenthesized portion of the catalog label. */
  label: string;
  /** Full label that the catalog filter understands as `?model=...`,
   *  e.g. "M3 / M4 (G80/G82)". */
  fullLabel: string;
  /** Production lines available for this specific body. */
  lines: string[];
};

export type IpeHeroVehicleModel = {
  /** Base model name without chassis/body, e.g. "M3 / M4". */
  label: string;
  /** Full label kept for backward compatibility (= fullLabel of first body). */
  fullLabel: string;
  /** Body / chassis variants under this model. Empty when the catalog label
   *  has no parenthesized chassis info. */
  bodies: IpeHeroVehicleBody[];
  /** Production lines (Valvetronic, Headers, ...) detected across all bodies
   *  of this model. */
  lines: string[];
};

export type IpeHeroVehicleBrand = {
  /** Brand key consumed by `?brand=X`. */
  key: string;
  label: string;
  models: IpeHeroVehicleModel[];
  /** Lines available across all of this brand's products — used when the user
   *  picks a brand without drilling into a model. */
  lines: string[];
};

export function splitIpeModelLabel(label: string): { base: string; body: string | null } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    const base = match[1].trim();
    const body = match[2].trim();
    if (base && body) return { base, body };
  }
  return { base: label.trim(), body: null };
}

// Internal alias kept for the existing call site in this file.
const splitModelLabel = splitIpeModelLabel;

export function buildIpeHeroVehicleTree(
  products: ReadonlyArray<ShopProduct>
): IpeHeroVehicleBrand[] {
  // brand → modelLabel → Set<line>
  const tree = new Map<string, Map<string, Set<string>>>();
  // brand → Set<line> (covers products without a resolvable model)
  const brandLines = new Map<string, Set<string>>();

  for (const product of products) {
    const brand = resolveIpeVehicleBrand(product);
    if (!brand) continue;

    const line = resolveIpeProductLine(product);
    let lineSet = brandLines.get(brand);
    if (!lineSet) {
      lineSet = new Set();
      brandLines.set(brand, lineSet);
    }
    if (line) lineSet.add(line);

    const model = resolveIpeVehicleModel(product);
    if (!model) continue;

    let modelMap = tree.get(brand);
    if (!modelMap) {
      modelMap = new Map();
      tree.set(brand, modelMap);
    }
    let modelLines = modelMap.get(model);
    if (!modelLines) {
      modelLines = new Set();
      modelMap.set(model, modelLines);
    }
    if (line) modelLines.add(line);
  }

  // Some brands appear in `brandLines` but have no resolvable model — keep them
  // in the dropdown so the brand-only quick path still works.
  const allBrands = new Set<string>([...brandLines.keys(), ...tree.keys()]);

  const result: IpeHeroVehicleBrand[] = [];
  for (const brand of allBrands) {
    const modelMap = tree.get(brand) ?? new Map<string, Set<string>>();

    // Group full labels by their base name so we can collapse e.g. both
    // "M3 / M4 (G80/G82)" and "M3 / M4 (F80/F82)" under one "M3 / M4" model
    // with two bodies.
    const baseMap = new Map<string, IpeHeroVehicleBody[]>();
    for (const [fullLabel, lineSet] of modelMap.entries()) {
      const { base, body } = splitModelLabel(fullLabel);
      const bodies = baseMap.get(base) ?? [];
      bodies.push({
        label: body ?? base,
        fullLabel,
        lines: [...lineSet].sort((a, b) => a.localeCompare(b)),
      });
      baseMap.set(base, bodies);
    }

    const models: IpeHeroVehicleModel[] = [];
    for (const [base, bodies] of baseMap.entries()) {
      bodies.sort((a, b) => a.label.localeCompare(b.label));
      const aggregatedLines = new Set<string>();
      for (const body of bodies) {
        for (const line of body.lines) aggregatedLines.add(line);
      }
      models.push({
        label: base,
        fullLabel: bodies[0]?.fullLabel ?? base,
        bodies,
        lines: [...aggregatedLines].sort((a, b) => a.localeCompare(b)),
      });
    }
    models.sort((a, b) => a.label.localeCompare(b.label));

    const lines = [...(brandLines.get(brand) ?? new Set<string>())].sort((a, b) =>
      a.localeCompare(b)
    );

    result.push({
      key: brand,
      label: brand,
      models,
      lines,
    });
  }

  result.sort((a, b) => {
    const ai = IPE_HERO_BRAND_PRIORITY.indexOf(a.label);
    const bi = IPE_HERO_BRAND_PRIORITY.indexOf(b.label);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
  });

  return result;
}
