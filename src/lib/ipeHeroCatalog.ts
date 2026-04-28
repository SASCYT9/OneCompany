import type { ShopProduct } from '@/lib/shopCatalog';
import {
  resolveIpeProductLine,
  resolveIpeVehicleBrand,
  resolveIpeVehicleModel,
} from '@/lib/ipeCatalog';

const IPE_HERO_BRAND_PRIORITY = [
  'Porsche',
  'Ferrari',
  'Lamborghini',
  'McLaren',
  'BMW',
  'Mercedes-AMG',
  'Mercedes-Benz',
  'Audi',
  'Aston Martin',
  'Nissan',
  'Toyota',
  'Volkswagen',
  'Maserati',
  'Ford',
  'Subaru',
];

export type IpeHeroVehicleModel = {
  /** Display label (matches the catalog filter facet text). */
  label: string;
  /** Production lines (Valvetronic, Headers, ...) detected for this model. */
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
    const models: IpeHeroVehicleModel[] = [];
    for (const [label, lineSet] of modelMap.entries()) {
      models.push({
        label,
        lines: [...lineSet].sort((a, b) => a.localeCompare(b)),
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
