import type { ShopProduct } from '@/lib/shopCatalog';
import { URBAN_COLLECTION_CARDS } from '@/app/[locale]/shop/data/urbanCollectionsList';
import { buildShopStorefrontProductPathForProduct } from '@/lib/shopStorefrontRouting';

type UrbanMatcherProduct = Pick<ShopProduct, 'brand' | 'title' | 'collection' | 'tags' | 'collections'>;

const HANDLE_TO_ALIASES: Record<string, string[]> = {
  'land-rover-defender-110': ['Land Rover Defender 110', 'Defender 110'],
  'land-rover-defender-90': ['Land Rover Defender 90', 'Defender 90'],
  'land-rover-defender-130': ['Land Rover Defender 130', 'Defender 130'],
  'land-rover-defender-110-octa': ['Land Rover Defender 110 OCTA', 'Defender 110 OCTA', 'Defender Octa'],
  'land-rover-discovery-5': ['Land Rover Discovery 5', 'Discovery 5'],
  'range-rover-l460': ['Range Rover L460', 'Land Rover Range Rover L460'],
  'range-rover-sport-l461': ['Range Rover Sport L461', 'Land Rover Range Rover Sport L461', 'Sport L461'],
  'range-rover-sport-l494': ['Range Rover Sport L494', 'Land Rover Range Rover Sport L494', 'Sport L494 SVR'],
  'lamborghini-urus': ['Lamborghini Urus', 'Urus'],
  'lamborghini-urus-se': ['Lamborghini Urus SE', 'Urus SE'],
  'lamborghini-urus-s': ['Lamborghini Urus S', 'Urus S'],
  'lamborghini-urus-performante': ['Lamborghini Urus Performante', 'Urus Performante'],
  'lamborghini-aventador-s': ['Lamborghini Aventador S', 'Aventador S'],
  'rolls-royce-cullinan': ['Rolls-Royce Cullinan', 'Cullinan'],
  'rolls-royce-cullinan-series-ii': ['Rolls-Royce Cullinan Series II', 'Cullinan Series II', 'Rolls-Royce Cullinan'],
  'rolls-royce-ghost-series-ii': ['Rolls-Royce Ghost Series II', 'Ghost Series II'],
  'mercedes-g-wagon-w465-widetrack': ['Mercedes-Benz G-Class W465', 'Mercedes G-Wagon W465 Widetrack', 'G-Wagon W465'],
  'mercedes-g-wagon-w465-aerokit': ['Mercedes G-Wagon W465 Aerokit', 'G-Wagon Aerokit'],
  'mercedes-g-wagon-softkit': ['Mercedes G-Wagon Softkit', 'G-Wagon Softkit'],
  'mercedes-eqc': ['Mercedes-Benz EQC', 'Mercedes EQC', 'EQC'],
  'audi-rsq8-facelift': ['Audi RSQ8 Facelift', 'RSQ8 Facelift'],
  'audi-rsq8': ['Audi RSQ8', 'RSQ8'],
  'audi-rs6-rs7': ['Audi RS6 RS7', 'RS6 / RS7', 'RS6 RS7'],
  'audi-rs4': ['Audi RS4', 'RS4 B9.5', 'RS4'],
  'audi-rs3': ['Audi RS3', 'RS3'],
  'bentley-continental-gt': ['Bentley Continental GT', 'Continental GT'],
  'volkswagen-golf-r': ['Volkswagen Golf R', 'Golf R'],
  'volkswagen-transporter-t6-1': ['Volkswagen Transporter T6.1', 'Volkswagen Transporter', 'Transporter T6.1'],
};

const EXACT_COLLECTION_TO_HANDLE: Record<string, string> = {
  'land rover defender 110': 'land-rover-defender-110',
  'land rover defender 90': 'land-rover-defender-90',
  'land rover defender 130': 'land-rover-defender-130',
  'land rover defender 110 octa': 'land-rover-defender-110-octa',
  'land rover discovery 5': 'land-rover-discovery-5',
  'range rover l460': 'range-rover-l460',
  'land rover range rover l460': 'range-rover-l460',
  'range rover sport l461': 'range-rover-sport-l461',
  'land rover range rover sport l461': 'range-rover-sport-l461',
  'range rover sport l494': 'range-rover-sport-l494',
  'land rover range rover sport l494': 'range-rover-sport-l494',
  'lamborghini urus': 'lamborghini-urus',
  'lamborghini urus se': 'lamborghini-urus-se',
  'lamborghini urus s': 'lamborghini-urus-s',
  'lamborghini urus performante': 'lamborghini-urus-performante',
  'lamborghini aventador s': 'lamborghini-aventador-s',
  'rolls royce cullinan': 'rolls-royce-cullinan',
  'rolls royce ghost series ii': 'rolls-royce-ghost-series-ii',
  'mercedes benz g class w465': 'mercedes-g-wagon-w465-widetrack',
  'mercedes g wagon w465 aerokit': 'mercedes-g-wagon-w465-aerokit',
  'mercedes g wagon softkit': 'mercedes-g-wagon-softkit',
  'mercedes benz eqc': 'mercedes-eqc',
  'mercedes eqc': 'mercedes-eqc',
  'audi rsq8 facelift': 'audi-rsq8-facelift',
  'audi rsq8': 'audi-rsq8',
  'audi rs6 rs7': 'audi-rs6-rs7',
  'audi rs4': 'audi-rs4',
  'audi rs3': 'audi-rs3',
  'bentley continental gt': 'bentley-continental-gt',
  'volkswagen golf r': 'volkswagen-golf-r',
  'volkswagen transporter t6 1': 'volkswagen-transporter-t6-1',
  'volkswagen transporter': 'volkswagen-transporter-t6-1',
};

function normalizeUrbanValue(value: string | undefined | null): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[./]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/[^a-zA-Z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeUrbanValue(value))
        .filter(Boolean)
    )
  );
}

function getHandleAliases(handle: string, title?: string, brand?: string) {
  const card = URBAN_COLLECTION_CARDS.find((item) => item.collectionHandle === handle);

  return unique([
    ...(HANDLE_TO_ALIASES[handle] ?? []),
    title,
    card?.title,
    brand && title ? `${brand} ${title}` : null,
    card?.brand && card?.title ? `${card.brand} ${card.title}` : null,
  ]);
}

function getCollectionCandidates(product: UrbanMatcherProduct) {
  return unique([
    product.collection.en,
    product.collection.ua,
    ...(product.collections ?? []).flatMap((item) => [item.title.en, item.title.ua]),
  ]);
}

function getSupportCandidates(product: UrbanMatcherProduct) {
  return unique([
    product.title.en,
    product.title.ua,
    ...(product.tags ?? []),
  ]);
}

function getUrbanMatchScore(product: UrbanMatcherProduct, handle: string, title?: string, brand?: string) {
  if (product.collections?.some((item) => item.handle === handle)) {
    return 500;
  }

  const aliases = getHandleAliases(handle, title, brand);
  const collectionCandidates = getCollectionCandidates(product);
  const supportCandidates = getSupportCandidates(product);
  let score = 0;

  aliases.forEach((alias) => {
    collectionCandidates.forEach((candidate) => {
      if (candidate === alias) {
        score = Math.max(score, 100);
      } else if (alias.includes(candidate)) {
        score = Math.max(score, 85);
      }
    });

    supportCandidates.forEach((candidate) => {
      if (candidate === alias) {
        score = Math.max(score, 45);
      } else if (alias.includes(candidate)) {
        score = Math.max(score, 25);
      }
    });
  });

  return score;
}

export function getProductsForUrbanCollection(
  products: ShopProduct[],
  handle: string,
  title?: string,
  brand?: string
) {
  return products
    .map((product) => ({
      product,
      score: getUrbanMatchScore(product, handle, title, brand),
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

export function getUrbanCollectionHandleForProduct(product: UrbanMatcherProduct) {
  const explicitUrbanCollection = product.collections?.find((item) =>
    URBAN_COLLECTION_CARDS.some((card) => card.collectionHandle === item.handle)
  );

  if (explicitUrbanCollection) {
    return explicitUrbanCollection.handle;
  }

  const collectionCandidates = getCollectionCandidates(product);

  for (const candidate of collectionCandidates) {
    const exactHandle = EXACT_COLLECTION_TO_HANDLE[candidate];
    if (exactHandle) {
      return exactHandle;
    }
  }

  let bestHandle: string | null = null;
  let bestScore = 0;

  URBAN_COLLECTION_CARDS.forEach((card) => {
    const score = getUrbanMatchScore(product, card.collectionHandle, card.title, card.brand);
    if (score > bestScore) {
      bestScore = score;
      bestHandle = card.collectionHandle;
    }
  });

  return bestScore >= 60 ? bestHandle : null;
}

export function buildShopProductPath(locale: string, product: ShopProduct, preferUrban = true) {
  const urbanHandle = getUrbanCollectionHandleForProduct(product);

  if (preferUrban && urbanHandle) {
    return `/${locale}/shop/urban/products/${product.slug}`;
  }

  return buildShopStorefrontProductPathForProduct(locale, product);
}

export function isUrbanCatalogProduct(product: ShopProduct) {
  const vendorKey = normalizeUrbanValue(product.vendor);
  const brandKey = normalizeUrbanValue(product.brand);

  if (vendorKey === 'urban automotive' || vendorKey === 'urban') {
    return true;
  }

  if (brandKey === 'urban automotive' || brandKey === 'urban') {
    return true;
  }

  if (product.slug.toLowerCase().startsWith('urb-')) {
    return true;
  }

  if (product.collections?.some((item) => item.isUrban)) {
    return true;
  }

  return Boolean(getUrbanCollectionHandleForProduct(product));
}

export function getUrbanCatalogProducts(products: ShopProduct[]) {
  return products.filter((product) => isUrbanCatalogProduct(product));
}
