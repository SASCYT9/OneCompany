import type { ShopProduct } from '@/lib/shopCatalog';
import { extractCsfCatalogFitment, isCleanCsfModelLabel } from '@/lib/csfCatalog';

/**
 * Mirrors the catalog-grid mapping in
 * `src/app/[locale]/shop/components/CSFCatalogGrid.tsx`. Kept here too so the
 * brand-home quick finder lists the same human-friendly category labels.
 */
const CSF_CATEGORY_MAP: Record<string, { ua: string; en: string; group: string }> = {
  'Радіатори та аксесуари': { ua: 'Радіатори', en: 'Radiators', group: 'radiators' },
  'Інтеркулери': { ua: 'Інтеркулери', en: 'Intercoolers', group: 'intercoolers' },
  'Масляні радіатори і компоненти': { ua: 'Масляні радіатори', en: 'Oil Coolers', group: 'oil-coolers' },
  'Впускні колектори': { ua: 'Інтеркулери', en: 'Intercoolers', group: 'intercoolers' },
  'Комплекти интеркулеров': { ua: 'Комплекти інтеркулерів', en: 'Intercooler Kits', group: 'intercooler-kits' },
  'Охолодження трансмісії': { ua: 'Охолодження трансмісії', en: 'Transmission Cooling', group: 'trans-cooling' },
  "З'єднувальні адаптери": { ua: 'Аксесуари', en: 'Accessories', group: 'accessories' },
  'Прокладки, сальники, ролики': { ua: 'Аксесуари', en: 'Accessories', group: 'accessories' },
  'Труби інтеркулера': { ua: 'Комплекти інтеркулерів', en: 'Intercooler Kits', group: 'intercooler-kits' },
};

const CSF_HEAT_EXCHANGER_LABEL = { ua: 'Теплообмінники', en: 'Heat Exchangers', group: 'heat-exchangers' };
// SKUs whose source title says "intercooler" but the part is actually a heat exchanger.
const CSF_HEAT_EXCHANGER_SKU_OVERRIDES = new Set(['8215']);
// Products whose title contains "теплообмінник"/"heat exchanger" should land in the
// Heat Exchangers bucket — but only when the source category is something we'd otherwise
// route to Intercoolers or Radiators (so combo modules in Trans Cooling stay put).
const CSF_HEAT_EXCHANGER_TITLE_RE = /теплообмінник|heat\s*exchang/i;
const CSF_HEAT_EXCHANGER_REROUTE_FROM = new Set([
  'Інтеркулери',
  'Радіатори та аксесуари',
  'Впускні колектори',
]);

function isCsfHeatExchanger(product: ShopProduct, rawCategory: string) {
  const sku = String(product.sku ?? '').trim();
  if (sku && CSF_HEAT_EXCHANGER_SKU_OVERRIDES.has(sku)) return true;
  if (!CSF_HEAT_EXCHANGER_REROUTE_FROM.has(rawCategory)) return false;
  const title = `${product.title?.ua ?? ''} ${product.title?.en ?? ''}`;
  return CSF_HEAT_EXCHANGER_TITLE_RE.test(title);
}

const CSF_HERO_MAKE_PRIORITY = [
  'BMW', 'Porsche', 'Toyota', 'Nissan', 'Subaru', 'Honda', 'Ford',
  'Audi', 'Mercedes-Benz', 'Chevrolet', 'Mitsubishi', 'Mazda',
];

export type CsfHeroCategory = {
  /** Group key used by the catalog filter (`?category=...`). */
  key: string;
  labelEn: string;
  labelUa: string;
  count: number;
};

export type CsfHeroVehicleModel = {
  /** Display label (matches the catalog facet text). */
  label: string;
  count: number;
  categories: CsfHeroCategory[];
  /** Clean chassis/body codes (e.g. E90, F30, 991) available for this model. */
  chassisCodes: string[];
};

// Lettered codes (E90, F30, G80) need 1-3 letters + 2-4 digits;
// pure-digit Porsche codes (991, 992, 997) need 3-4 digits — this avoids
// 2-digit year fragments leaking through.
const CSF_HERO_CHASSIS_RE = /^([A-Z]{1,3}\d{2,4}|\d{3,4})[A-Z]?$/;

function isCleanCsfChassis(code: string) {
  return CSF_HERO_CHASSIS_RE.test(code.trim());
}

export type CsfHeroVehicleMake = {
  key: string;
  label: string;
  count: number;
  models: CsfHeroVehicleModel[];
  /** Categories available across the brand — used when the user picks a make
   *  without drilling into a specific model. */
  categories: CsfHeroCategory[];
};

export type CsfHeroSummary = {
  totalProducts: number;
  makes: CsfHeroVehicleMake[];
};

type CategoryLabel = Omit<CsfHeroCategory, 'count'>;

function categoryFor(product: ShopProduct): CategoryLabel {
  const raw = product.category?.ua || product.category?.en || '';
  if (isCsfHeatExchanger(product, raw)) {
    return {
      key: CSF_HEAT_EXCHANGER_LABEL.group,
      labelEn: CSF_HEAT_EXCHANGER_LABEL.en,
      labelUa: CSF_HEAT_EXCHANGER_LABEL.ua,
    };
  }
  const mapped = CSF_CATEGORY_MAP[raw];
  if (mapped) {
    return { key: mapped.group, labelEn: mapped.en, labelUa: mapped.ua };
  }
  const fallback = raw || 'other';
  return {
    key: fallback.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '') || 'other',
    labelEn: fallback,
    labelUa: fallback,
  };
}

export function isCsfProduct(product: Pick<ShopProduct, 'brand' | 'vendor'>) {
  const brand = String(product.brand ?? '').trim().toLowerCase();
  const vendor = String(product.vendor ?? '').trim().toLowerCase();
  return brand.includes('csf') || vendor.includes('csf');
}

export function buildCsfHeroSummary(
  products: ReadonlyArray<ShopProduct>
): CsfHeroSummary {
  // Counters: make → total, make → category → {label, count},
  // make → model → total, make → model → category → {label, count},
  // make → model → set of clean chassis codes.
  const makeTotal = new Map<string, number>();
  const makeCategory = new Map<string, Map<string, { label: CategoryLabel; count: number }>>();
  const modelTotal = new Map<string, Map<string, number>>();
  const modelCategory = new Map<
    string,
    Map<string, Map<string, { label: CategoryLabel; count: number }>>
  >();
  const modelChassis = new Map<string, Map<string, Set<string>>>();

  for (const product of products) {
    const fitment = extractCsfCatalogFitment(product);
    const make = fitment.make;
    if (!make) continue;

    const category = categoryFor(product);

    makeTotal.set(make, (makeTotal.get(make) ?? 0) + 1);

    let mc = makeCategory.get(make);
    if (!mc) {
      mc = new Map();
      makeCategory.set(make, mc);
    }
    const mcEntry = mc.get(category.key);
    if (mcEntry) {
      mcEntry.count += 1;
    } else {
      mc.set(category.key, { label: category, count: 1 });
    }

    // Defense-in-depth: drop labels that fail the shared cleanliness predicate
    // (foreign brand names, year ranges, multi-token fragments). The catalog
    // grid applies the same gate; without it, hero-finder dropdowns leaked
    // junk like "TOYOTA GR Supra" under BMW.
    const models = fitment.models.filter((label): label is string =>
      Boolean(label) && isCleanCsfModelLabel(label)
    );
    if (models.length === 0) continue;

    let mt = modelTotal.get(make);
    if (!mt) {
      mt = new Map();
      modelTotal.set(make, mt);
    }
    let mcat = modelCategory.get(make);
    if (!mcat) {
      mcat = new Map();
      modelCategory.set(make, mcat);
    }
    let mch = modelChassis.get(make);
    if (!mch) {
      mch = new Map();
      modelChassis.set(make, mch);
    }

    const cleanChassis = fitment.chassisCodes
      .map((code) => code.trim().toUpperCase())
      .filter(isCleanCsfChassis);

    for (const model of models) {
      mt.set(model, (mt.get(model) ?? 0) + 1);
      let perModel = mcat.get(model);
      if (!perModel) {
        perModel = new Map();
        mcat.set(model, perModel);
      }
      const entry = perModel.get(category.key);
      if (entry) {
        entry.count += 1;
      } else {
        perModel.set(category.key, { label: category, count: 1 });
      }

      if (cleanChassis.length > 0) {
        let chassisSet = mch.get(model);
        if (!chassisSet) {
          chassisSet = new Set();
          mch.set(model, chassisSet);
        }
        const modelUpper = model.toUpperCase();
        for (const code of cleanChassis) {
          if (code === modelUpper) continue; // skip "911" leaking into chassis for model 911
          chassisSet.add(code);
        }
      }
    }
  }

  const allMakes = new Set<string>([...makeTotal.keys(), ...makeCategory.keys()]);
  const makes: CsfHeroVehicleMake[] = [];

  for (const makeKey of allMakes) {
    const makeCount = makeTotal.get(makeKey) ?? 0;
    const categories = [...(makeCategory.get(makeKey) ?? new Map()).values()]
      .map((entry) => ({ ...entry.label, count: entry.count }))
      .sort((a, b) => b.count - a.count || a.labelEn.localeCompare(b.labelEn));

    const modelMap = modelTotal.get(makeKey) ?? new Map<string, number>();
    const modelCatMap = modelCategory.get(makeKey) ?? new Map();
    const modelChassisMap = modelChassis.get(makeKey) ?? new Map<string, Set<string>>();
    const models: CsfHeroVehicleModel[] = [];
    for (const [label, count] of modelMap.entries()) {
      const cats = [...(modelCatMap.get(label) ?? new Map()).values()]
        .map((entry) => ({ ...entry.label, count: entry.count }))
        .sort((a, b) => b.count - a.count || a.labelEn.localeCompare(b.labelEn));
      const chassisCodes = [...(modelChassisMap.get(label) ?? new Set<string>())].sort((a, b) =>
        a.localeCompare(b)
      );
      models.push({ label, count, categories: cats, chassisCodes });
    }
    models.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    makes.push({ key: makeKey, label: makeKey, count: makeCount, categories, models });
  }

  makes.sort((a, b) => {
    const ai = CSF_HERO_MAKE_PRIORITY.indexOf(a.label);
    const bi = CSF_HERO_MAKE_PRIORITY.indexOf(b.label);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.label.localeCompare(b.label);
  });

  return { totalProducts: products.length, makes };
}

/** @deprecated Use `buildCsfHeroSummary` so the hero filter can show live counts. */
export function buildCsfHeroVehicleTree(
  products: ReadonlyArray<ShopProduct>
): CsfHeroVehicleMake[] {
  return buildCsfHeroSummary(products).makes;
}
