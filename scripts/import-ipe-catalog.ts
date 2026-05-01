#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

import {
  buildAdminProductCreateData,
  buildAdminProductUpdateData,
  type AdminShopProductPayload,
  type AdminShopProductVariantInput,
  type AdminShopProductOptionInput,
  type AdminShopProductMediaInput,
  type AdminShopProductMetafieldInput,
} from '../src/lib/shopAdminCatalog';
import { replaceStorefrontTag } from '../src/lib/shopProductStorefront';
import {
  buildIpeCanonicalTokenSetFromPriceRow,
  buildIpeCanonicalTokenSetFromOfficialProduct,
  buildIpeShortDescription,
  buildIpeSyntheticVariantSku,
  buildIpeVariantCandidates,
  cleanIpeOfficialHtml,
  computeIpeRetailPrice,
  deriveIpeCategoryLabels,
  resolveIpeVariantPricing,
  scoreIpeCanonicalTokenSets,
  serializeVariantMapForMetafield,
  translateVehicleMakeToUa,
  type IpeCanonicalTokenSet,
  type IpeOfficialOptionSnapshot,
  type IpeOfficialProductSnapshot,
  type IpeOfficialSnapshot,
  type IpeOfficialVariantSnapshot,
  type IpeParsedPriceList,
  type IpeParsedPriceListRow,
  type IpeMatchScoreBreakdown,
  type IpeVariantCandidate,
} from '../src/lib/ipeCatalogImport';
import { htmlToPlainText } from '../src/lib/sanitizeRichTextHtml';

config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

const OFFICIAL_BASE_URL = 'https://ipeofficial.com';
const DEFAULT_PARSED_JSON = path.join(process.cwd(), 'artifacts', 'ipe-price-list', '2025-price-list.parsed.json');
const DEFAULT_OUTPUT_DIR = path.join(
  process.cwd(),
  'artifacts',
  'ipe-import',
  new Date().toISOString().replace(/[:.]/g, '-')
);
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MEDIA_ROOT_DIR = path.join(PUBLIC_DIR, 'media', 'shop', 'ipe');
const USER_AGENT = 'OneCompany/IPEImport/1.0';
const MATCH_AUTO_THRESHOLD = 0.9;
const MATCH_REVIEW_THRESHOLD = 0.75;
const PER_HANDLE_VARIANT_REVIEW_LIMIT = 12;

type TranslationProvider = 'gemini' | 'none';

type CliOptions = {
  commit: boolean;
  translateUa: boolean;
  translationProvider: TranslationProvider;
  limit: number | null;
  handle: string | null;
  outputDir: string;
  parsedJsonPath: string;
  pdfPath: string | null;
  officialBaseUrl: string;
};

type SitemapResult = {
  handles: string[];
  urls: string[];
};

type RawShopifyImage = {
  id?: number | string | null;
  src?: string | null;
  url?: string | null;
  originalSrc?: string | null;
};

type RawShopifyVariant = {
  id?: number | string | null;
  title?: string | null;
  sku?: string | null;
  available?: boolean | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  featured_image?: RawShopifyImage | string | null;
};

type RawShopifyProduct = {
  id?: number | string | null;
  handle?: string | null;
  title?: string | null;
  body_html?: string | null;
  tags?: string | string[] | null;
  vendor?: string | null;
  product_type?: string | null;
  images?: RawShopifyImage[] | null;
  options?: Array<{ name?: string | null; values?: string[] | null }> | null;
  variants?: RawShopifyVariant[] | null;
};

type IpeMatchManifestItem = {
  rowIndex: number;
  sku: string;
  priceKind: string;
  brand: string;
  model: string | null;
  description: string;
  officialHandle: string | null;
  officialUrl: string | null;
  score: number;
  status: 'auto' | 'review' | 'unresolved';
  breakdown: IpeMatchScoreBreakdown | null;
  candidates: Array<{
    handle: string;
    score: number;
  }>;
};

type IpeMatchManifest = {
  createdAt: string;
  autoThreshold: number;
  reviewThreshold: number;
  rows: IpeMatchManifestItem[];
};

type IpeResolvedVariantRecord = {
  title: string;
  sku: string;
  priceUsd: number;
  optionValues: string[];
  optionNames: string[];
  baseSku: string | null;
  deltaSkus: string[];
  imageUrl: string | null;
  reviewReasons: string[];
  confidence: number;
  defaultVariant: boolean;
};

type IpeMediaPlanItem = {
  remoteUrl: string;
  publicPath: string;
  absolutePath: string;
  position: number;
};

type IpeImportRecord = {
  handle: string;
  slug: string;
  officialUrl: string;
  matchScore: number;
  status: 'draft-review';
  reviewReasons: string[];
  matchedRows: IpeMatchManifestItem[];
  unresolvedRows: IpeMatchManifestItem[];
  mediaPlan: IpeMediaPlanItem[];
  variants: IpeResolvedVariantRecord[];
  payload: AdminShopProductPayload;
};

function parseCliOptions(): CliOptions {
  const args = new Set(process.argv.slice(2));
  const commit = args.has('--commit');
  const translateUa = commit || args.has('--translate-ua');
  const translationProvider = resolveTranslationProvider(readArgValue('--translate-provider') ?? 'auto');
  const limitArg = readArgValue('--limit');
  const limit = limitArg ? Number(limitArg) || null : null;
  return {
    commit,
    translateUa,
    translationProvider,
    limit: limit != null && limit > 0 ? Math.trunc(limit) : null,
    handle: readArgValue('--handle'),
    outputDir: path.resolve(readArgValue('--output-dir') ?? DEFAULT_OUTPUT_DIR),
    parsedJsonPath: path.resolve(readArgValue('--parsed-json') ?? DEFAULT_PARSED_JSON),
    pdfPath: readArgValue('--pdf') ? path.resolve(readArgValue('--pdf') as string) : null,
    officialBaseUrl: (readArgValue('--official-base') ?? OFFICIAL_BASE_URL).replace(/\/+$/, ''),
  };
}

function resolveTranslationProvider(value: string): TranslationProvider {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'gemini') return 'gemini';
  if (normalized === 'none') return 'none';
  if ((process.env.GEMINI_API_KEY || '').trim()) return 'gemini';
  return 'none';
}

function readArgValue(flag: string) {
  const prefixed = `${flag}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefixed));
  return found ? found.slice(prefixed.length).trim() : null;
}

function logJson(label: string, value: unknown) {
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(value, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHandle(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildPriceRowGroupKey(row: Pick<IpeParsedPriceListRow, 'brand' | 'model' | 'year_range' | 'engine'>) {
  return [
    normalizeHandle(row.brand),
    normalizeHandle(row.model),
    normalizeHandle(row.year_range),
    normalizeHandle(row.engine),
  ].join('|');
}

function buildPriceRowGroupIndex(priceList: IpeParsedPriceList) {
  const rowToGroupKey: string[] = [];
  const rowsByGroupKey = new Map<string, number[]>();

  priceList.items.forEach((row, rowIndex) => {
    const groupKey = buildPriceRowGroupKey(row);
    rowToGroupKey[rowIndex] = groupKey;
    const current = rowsByGroupKey.get(groupKey) ?? [];
    current.push(rowIndex);
    rowsByGroupKey.set(groupKey, current);
  });

  return { rowToGroupKey, rowsByGroupKey };
}

function isBrandWideAccessoryRow(row: Pick<IpeParsedPriceListRow, 'model' | 'section' | 'description' | 'remarks'>) {
  const haystack = [row.model, row.section, row.description, row.remarks].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes('accessories') && haystack.includes('upgrade option with exhaust');
}

function normalizeRemoteUrl(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('//')) return `https:${normalized}`;
  return normalized;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function parseShopifyTags(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }
  return uniqueStrings(
    String(value ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  );
}

function pickImageUrl(value: RawShopifyImage | string | null | undefined) {
  if (!value) return null;
  if (typeof value === 'string') return normalizeRemoteUrl(value);
  return normalizeRemoteUrl(value.src ?? value.url ?? value.originalSrc ?? null);
}

function buildOfficialProductUrl(baseUrl: string, handle: string) {
  return `${baseUrl}/products/${handle}`;
}

function buildOfficialVariant(product: RawShopifyProduct, variant: RawShopifyVariant, index: number): IpeOfficialVariantSnapshot {
  const optionNames = (product.options ?? []).map((option) => String(option?.name ?? '').trim()).slice(0, 3);
  const optionValues = [variant.option1, variant.option2, variant.option3]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
  const optionMap = optionNames.reduce<Record<string, string>>((accumulator, optionName, optionIndex) => {
    const optionValue = optionValues[optionIndex];
    if (optionName && optionValue) accumulator[optionName] = optionValue;
    return accumulator;
  }, {});

  return {
    id: String(variant.id ?? `${String(product.handle ?? 'variant')}-${index + 1}`),
    title: String(variant.title ?? '').trim() || optionValues.join(' / ') || 'Default Title',
    sku: String(variant.sku ?? '').trim() || null,
    available: variant.available !== false,
    featuredImage: pickImageUrl(variant.featured_image),
    optionValues,
    optionMap,
  };
}

function buildOfficialProduct(baseUrl: string, product: RawShopifyProduct): IpeOfficialProductSnapshot | null {
  const handle = normalizeHandle(product.handle);
  if (!handle) return null;
  if (/\bwheels?\b/i.test(handle) || /\bwheels?\b/i.test(String(product.title ?? ''))) return null;
  const options: IpeOfficialOptionSnapshot[] = (product.options ?? [])
    .map((option) => ({
      name: String(option?.name ?? '').trim(),
      values: uniqueStrings(option?.values ?? []),
    }))
    .filter((option) => option.name);
  const variants = (product.variants ?? []).map((variant, index) => buildOfficialVariant(product, variant, index));
  const images = uniqueStrings((product.images ?? []).map((image) => pickImageUrl(image)));
  return {
    id: String(product.id ?? handle),
    handle,
    title: String(product.title ?? '').trim(),
    bodyHtml: String(product.body_html ?? '').trim(),
    tags: parseShopifyTags(product.tags),
    vendor: String(product.vendor ?? '').trim() || null,
    productType: String(product.product_type ?? '').trim() || null,
    images,
    url: buildOfficialProductUrl(baseUrl, handle),
    options,
    variants,
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchHandlesFromSitemap(baseUrl: string): Promise<SitemapResult> {
  const rootUrl = `${baseUrl}/sitemap.xml`;
  const visited = new Set<string>();
  const handles = new Set<string>();
  const urls = new Set<string>();
  const queue = [rootUrl];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);

    const xml = await fetchText(current);
    const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => match[1].trim());
    for (const loc of locMatches) {
      if (/\/products\//.test(loc)) {
        urls.add(loc);
        const handle = normalizeHandle(loc.split('/products/')[1]?.split(/[?#]/)[0] ?? '');
        if (handle) handles.add(handle);
        continue;
      }
      if (loc.endsWith('.xml') || loc.includes('.xml?')) {
        queue.push(loc);
      }
    }
  }

  return {
    handles: Array.from(handles).sort(),
    urls: Array.from(urls).sort(),
  };
}

async function fetchProductsJson(baseUrl: string) {
  const products: IpeOfficialProductSnapshot[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const payload = await fetchJson<{ products?: RawShopifyProduct[] }>(
      `${baseUrl}/products.json?limit=250&page=${page}`
    );
    const chunk = Array.isArray(payload.products) ? payload.products : [];
    if (!chunk.length) break;
    products.push(...chunk.map((item) => buildOfficialProduct(baseUrl, item)).filter((item): item is IpeOfficialProductSnapshot => Boolean(item)));
    if (chunk.length < 250) break;
  }
  return products;
}

async function fetchProductDetail(baseUrl: string, handle: string) {
  try {
    const payload = await fetchJson<{ product?: RawShopifyProduct }>(`${baseUrl}/products/${handle}.js`);
    return payload.product ? buildOfficialProduct(baseUrl, payload.product) : null;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(concurrency, 1), values.length || 1) }, () => worker())
  );

  return results;
}

function mergeOfficialProduct(
  baseProduct: IpeOfficialProductSnapshot | null | undefined,
  detailProduct: IpeOfficialProductSnapshot | null | undefined,
  baseUrl: string,
  handle: string
) {
  const source = detailProduct ?? baseProduct;
  if (!source) return null;
  const baseImages = baseProduct?.images ?? [];
  const detailImages = detailProduct?.images ?? [];
  const baseVariants = baseProduct?.variants ?? [];
  const detailVariants = detailProduct?.variants ?? [];
  return {
    id: detailProduct?.id ?? baseProduct?.id ?? handle,
    handle,
    title: detailProduct?.title || baseProduct?.title || '',
    bodyHtml: detailProduct?.bodyHtml || baseProduct?.bodyHtml || '',
    tags: uniqueStrings([...(detailProduct?.tags ?? []), ...(baseProduct?.tags ?? [])]),
    vendor: detailProduct?.vendor ?? baseProduct?.vendor ?? null,
    productType: detailProduct?.productType ?? baseProduct?.productType ?? null,
    images: uniqueStrings([...detailImages, ...baseImages]),
    url: source.url || buildOfficialProductUrl(baseUrl, handle),
    options: (detailProduct?.options?.length ? detailProduct.options : baseProduct?.options) ?? [],
    variants: detailVariants.length ? detailVariants : baseVariants,
  } satisfies IpeOfficialProductSnapshot;
}

async function fetchOfficialSnapshot(baseUrl: string, handleFilter?: string | null): Promise<IpeOfficialSnapshot> {
  const [sitemap, productsJson] = await Promise.all([
    fetchHandlesFromSitemap(baseUrl),
    fetchProductsJson(baseUrl),
  ]);

  const byHandle = new Map(productsJson.map((product) => [product.handle, product] as const));
  const handles = uniqueStrings([...sitemap.handles, ...Array.from(byHandle.keys())]);
  const detailHandles = handleFilter ? uniqueStrings([handleFilter]) : handles;
  const detailHandleSet = new Set(detailHandles);
  const detailed = new Map(
    (
      await mapWithConcurrency(detailHandles, handleFilter ? 1 : 12, async (handle) => [
        handle,
        await fetchProductDetail(baseUrl, handle),
      ] as const)
    ).filter((entry): entry is readonly [string, IpeOfficialProductSnapshot | null] => Boolean(entry))
  );

  const products = handles
    .map((handle) =>
      mergeOfficialProduct(
        byHandle.get(handle),
        detailHandleSet.has(handle) ? detailed.get(handle) ?? null : null,
        baseUrl,
        handle
      )
    )
    .filter((product): product is IpeOfficialProductSnapshot => Boolean(product))
    .sort((left, right) => left.handle.localeCompare(right.handle));

  return {
    sourceBaseUrl: baseUrl,
    crawledAt: new Date().toISOString(),
    productCount: products.length,
    handlesFromSitemap: sitemap.handles,
    products,
  };
}

async function ensureDirectory(target: string) {
  await fs.mkdir(target, { recursive: true });
}

async function writeJsonFile(target: string, value: unknown) {
  await ensureDirectory(path.dirname(target));
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function loadParsedPriceList(options: CliOptions): Promise<IpeParsedPriceList> {
  try {
    const raw = await fs.readFile(options.parsedJsonPath, 'utf8');
    return JSON.parse(raw) as IpeParsedPriceList;
  } catch (error) {
    if (!options.pdfPath) {
      throw error;
    }
  }

  await ensureDirectory(path.dirname(options.parsedJsonPath));
  const parsedCsvPath = options.parsedJsonPath.replace(/\.json$/i, '.csv');
  const pythonCandidates = ['python', 'py'];
  let lastError: string | null = null;

  for (const command of pythonCandidates) {
    const args =
      command === 'py'
        ? ['-3', 'scripts/parse-ipe-price-list.py', options.pdfPath as string, '--json-out', options.parsedJsonPath, '--csv-out', parsedCsvPath]
        : ['scripts/parse-ipe-price-list.py', options.pdfPath as string, '--json-out', options.parsedJsonPath, '--csv-out', parsedCsvPath];
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    if (result.status === 0) {
      const raw = await fs.readFile(options.parsedJsonPath, 'utf8');
      return JSON.parse(raw) as IpeParsedPriceList;
    }
    lastError = `${command}: ${result.stderr || result.stdout || 'unknown parser failure'}`;
  }

  throw new Error(`Unable to build parsed IPE price list. ${lastError ?? ''}`.trim());
}

function buildMatchManifest(
  priceList: IpeParsedPriceList,
  snapshot: IpeOfficialSnapshot
): IpeMatchManifest {
  const preparedProducts = snapshot.products.map((product) => ({
    product,
    tokens: buildIpeCanonicalTokenSetFromOfficialProduct(product),
  }));
  const preparedProductsByMake = new Map<string, typeof preparedProducts>();
  for (const entry of preparedProducts) {
    const make = entry.tokens.vehicleMake;
    if (!make) continue;
    const current = preparedProductsByMake.get(make) ?? [];
    current.push(entry);
    preparedProductsByMake.set(make, current);
  }

  const rows = priceList.items.map((row, rowIndex) => {
    const rowTokens = buildIpeCanonicalTokenSetFromPriceRow(row);
    const candidatePool = rowTokens.vehicleMake
      ? (preparedProductsByMake.get(rowTokens.vehicleMake) ?? preparedProducts)
      : preparedProducts;
    const candidates = candidatePool
      .map((entry) => {
        const breakdown = scoreIpeCanonicalTokenSets(rowTokens, entry.tokens);
        return {
          product: entry.product,
          score: breakdown.total,
          breakdown,
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);
    const best = candidates[0] ?? null;
    const status =
      !best || best.score < MATCH_REVIEW_THRESHOLD
        ? 'unresolved'
        : best.score >= MATCH_AUTO_THRESHOLD
          ? 'auto'
          : 'review';
    return {
      rowIndex,
      sku: row.sku,
      priceKind: row.price_kind,
      brand: row.brand,
      model: row.model,
      description: row.description,
      officialHandle: best?.product.handle ?? null,
      officialUrl: best?.product.url ?? null,
      score: best?.score ?? 0,
      status,
      breakdown: best?.breakdown ?? null,
      candidates: candidates.map((candidate) => ({
        handle: candidate.product.handle,
        score: candidate.score,
      })),
    } satisfies IpeMatchManifestItem;
  });

  return {
    createdAt: new Date().toISOString(),
    autoThreshold: MATCH_AUTO_THRESHOLD,
    reviewThreshold: MATCH_REVIEW_THRESHOLD,
    rows,
  };
}

function groupManifestRowsByHandle(manifest: IpeMatchManifest) {
  const map = new Map<string, IpeMatchManifestItem[]>();
  for (const item of manifest.rows) {
    if (!item.officialHandle || item.priceKind !== 'absolute') continue;
    const current = map.get(item.officialHandle) ?? [];
    current.push(item);
    map.set(item.officialHandle, current);
  }
  return map;
}

function buildMediaPlan(product: IpeOfficialProductSnapshot): IpeMediaPlanItem[] {
  return product.images.map((remoteUrl, index) => {
    const extension = resolveImageExtension(remoteUrl);
    const filename = `${String(index + 1).padStart(2, '0')}${extension}`;
    const absolutePath = path.join(MEDIA_ROOT_DIR, product.handle, filename);
    const publicPath = `/${path.relative(PUBLIC_DIR, absolutePath).split(path.sep).join('/')}`;
    return {
      remoteUrl,
      publicPath,
      absolutePath,
      position: index + 1,
    };
  });
}

function resolveImageExtension(remoteUrl: string) {
  try {
    const pathname = new URL(remoteUrl).pathname.toLowerCase();
    const extension = path.extname(pathname);
    if (['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(extension)) {
      return extension === '.jpeg' ? '.jpg' : extension;
    }
  } catch {
    // ignore
  }
  return '.jpg';
}

function buildCategoryAndCollection(rows: readonly IpeParsedPriceListRow[], productTokens: IpeCanonicalTokenSet) {
  const category = deriveIpeCategoryLabels(rows);
  const collectionEn = productTokens.vehicleMake ?? 'iPE Exhaust';
  return {
    category,
    collectionEn,
    collectionUa: productTokens.vehicleMake ? translateVehicleMakeToUa(productTokens.vehicleMake) : 'iPE Exhaust',
  };
}

function buildBaseTags(product: IpeOfficialProductSnapshot, productTokens: IpeCanonicalTokenSet, categoryEn: string) {
  const systemTokens = uniqueStrings(
    [
      productTokens.systemFamily,
      categoryEn,
      product.vendor,
      product.productType,
      productTokens.vehicleMake,
      'iPE',
      'iPE exhaust',
      'Innotech Performance Exhaust',
      ...product.tags,
      ...productTokens.featureFlags,
    ].map((value) => String(value ?? '').trim())
  );

  return replaceStorefrontTag(systemTokens, 'main');
}

// Postprocessor for Gemini Ukrainian output. Two responsibilities:
//   1. Repair domain-specific terminology Gemini gets wrong on iPE copy
//      ("патрубок" → "труба" for exhaust pipes, "наконечник" → "насадка"
//      for tips, "клапаном" → "клапанами" — exhaust is dual so plural).
//   2. Promote the OPF warning ("ПОПЕРЕДЖЕННЯ - Перед покупкою...") from
//      inline <strong> into a tagged callout that the iPE storefront layout
//      renders as a styled warning bar.
export function sanitizeIpeUaCopy(value: string, options?: { isHtml?: boolean }): string {
  if (!value) return value;
  let out = value;

  // "Передній патрубок" / "Середній патрубок" — exhaust pipes (двойной выхлоп → plural)
  out = out.replace(/\bПередн(?:ій|ьому|ього)\s+патрубо(?:к|ка|ку|ком|ці)\b/gi, 'Передні труби');
  out = out.replace(/\bСередн(?:ій|ьому|ього)\s+патрубо(?:к|ка|ку|ком|ці)\b/gi, 'Середні труби');
  // Standalone "патрубок" in exhaust context → "труба"
  out = out.replace(/\bпатрубок(?=[^\n<]{0,80}(?:вихлоп|глушник|катал|x[- ]?пайп|h[- ]?пайп|даунпайп))/gi, 'труба');
  out = out.replace(/(?<=(?:вихлоп|глушник|x[- ]?пайп|h[- ]?пайп)[^\n<]{0,80})\bпатрубок\b/gi, 'труба');

  // Tips: наконечник → насадка (all forms)
  out = out.replace(/\bНаконечник(и|а|ів|ам|ами|ах)?\b/g, (_match, suffix) => {
    const map: Record<string, string> = {
      '': 'Насадка',
      'и': 'Насадки',
      'а': 'Насадка',
      'ів': 'Насадок',
      'ам': 'Насадкам',
      'ами': 'Насадками',
      'ах': 'Насадках',
    };
    return map[suffix ?? ''] ?? 'Насадки';
  });
  out = out.replace(/\bнаконечник(и|а|ів|ам|ами|ах)?\b/g, (_match, suffix) => {
    const map: Record<string, string> = {
      '': 'насадка',
      'и': 'насадки',
      'а': 'насадка',
      'ів': 'насадок',
      'ам': 'насадкам',
      'ами': 'насадками',
      'ах': 'насадках',
    };
    return map[suffix ?? ''] ?? 'насадки';
  });

  // "штатного керування клапаном" → "клапанами" (plural, dual-valve setup)
  out = out.replace(/\bкерування\s+клапаном\b/gi, 'керування клапанами');
  out = out.replace(/\bкеруванням\s+клапаном\b/gi, 'керуванням клапанами');
  // "клапанамИ" with Latin/wrong-case I sometimes leaks through Gemini
  out = out.replace(/клапанам[ИI]\b/g, 'клапанами');

  // OPF warning callout: tag it for the storefront to render as a styled banner.
  // We support both HTML (with <strong>) and plain-text shapes.
  const warningRx = /(?:<strong>)?\s*ПОПЕРЕДЖЕННЯ\s*[-–—]\s*Перед\s+покупкою[^<\n]*?Дякуємо\.\s*(?:<\/strong>)?/g;
  if (options?.isHtml) {
    out = out.replace(warningRx, (match) => {
      const text = match.replace(/<\/?strong>/gi, '').trim();
      return `<aside data-warning="opf" class="ipe-warning ipe-warning--opf"><strong>${text}</strong></aside>`;
    });
  }

  return out;
}

async function translateTextToUa(
  provider: TranslationProvider,
  value: string,
  cache: Map<string, string>,
  options?: { isHtml?: boolean }
) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  const cacheKey = `${provider}:${options?.isHtml ? 'html' : 'text'}:${normalized}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let translated = '';
  if (provider === 'gemini') {
    translated = await translateWithGemini(normalized, options);
  } else {
    translated = normalized;
  }

  translated = sanitizeIpeUaCopy(translated, options);

  cache.set(cacheKey, translated);
  return translated;
}

async function translateWithGemini(value: string, options?: { isHtml?: boolean }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  const model = 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: options?.isHtml
                  ? `Translate this official automotive product HTML from English to Ukrainian.\n\nRules:\n1. Output HTML only.\n2. Keep all tags.\n3. Keep brand names, vehicle names, model codes, part numbers, SKU, OPF, OBDII in English.\n4. Use premium natural Ukrainian automotive terminology.\n5. Do not add claims that are not in the source.\n\n${value}`
                  : `Translate this official automotive product title or short copy from English to Ukrainian.\n\nRules:\n1. Output plain Ukrainian text only.\n2. Keep brand names, vehicle names, model codes, part numbers, SKU, OPF, OBDII in English.\n3. Do not add claims that are not in the source.\n\n${value}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      const retryAfter = Number(response.headers.get('retry-after') || NaN);
      const retryable = response.status === 429 || response.status === 500 || response.status === 502 || response.status === 503 || response.status === 504;
      if (retryable && attempt < 4) {
        const delayMs = Number.isFinite(retryAfter)
          ? Math.max(1000, retryAfter * 1000)
          : 1500 * (attempt + 1);
        await sleep(delayMs);
        continue;
      }
      throw new Error(`Gemini translation failed: HTTP ${response.status}${details ? ` ${details}` : ''}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    let translated = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    translated = translated.replace(/^```html?/i, '').replace(/```$/i, '').trim();
    if (!translated) {
      if (attempt < 4) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error('Gemini returned an empty translation');
    }
    return translated;
  }

  throw new Error('Gemini translation failed after retries');
}

async function downloadMedia(plan: readonly IpeMediaPlanItem[]) {
  const map = new Map<string, string>();
  for (const item of plan) {
    await ensureDirectory(path.dirname(item.absolutePath));
    try {
      await fs.access(item.absolutePath);
      map.set(item.remoteUrl, item.publicPath);
      continue;
    } catch {
      // missing file, continue to download
    }

    const response = await fetch(item.remoteUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Image download failed: ${item.remoteUrl} -> HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(item.absolutePath, buffer);
    map.set(item.remoteUrl, item.publicPath);
  }
  return map;
}

function buildVariantOptions(
  product: IpeOfficialProductSnapshot,
  candidates: readonly IpeVariantCandidate[],
  variants: readonly IpeResolvedVariantRecord[]
) {
  const meaningfulOfficialOptions = product.options.filter((option) => option.name && option.values.length > 0);
  if (candidates.some((candidate) => candidate.source === 'official') && meaningfulOfficialOptions.length > 0) {
    const options: AdminShopProductOptionInput[] = meaningfulOfficialOptions.slice(0, 3).map((option, index) => ({
      name: option.name,
      position: index + 1,
      values: uniqueStrings(
        variants.map((variant) => variant.optionValues[index]).filter(Boolean)
      ),
    }));
    return options.filter((option) => option.values.length > 0);
  }

  if (variants.length > 1) {
    return [
      {
        name: 'Configuration',
        position: 1,
        values: uniqueStrings(variants.map((variant) => variant.title)),
      },
    ] satisfies AdminShopProductOptionInput[];
  }

  return [] satisfies AdminShopProductOptionInput[];
}

function determineDefaultVariantIndex(_candidates: readonly IpeVariantCandidate[], variants: readonly IpeResolvedVariantRecord[]) {
  // Cat-back is the most-purchased configuration (~70% of iPE sales for BMW
  // exhaust platforms); within that, Factory front-pipe + Catted (OPF) is the
  // street-legal default. Score every variant by how closely its option values
  // match that profile, breaking ties by lowest price (the cleanest catback).
  const score = (variant: IpeResolvedVariantRecord) => {
    const joined = variant.optionValues.filter(Boolean).join(' | ').toLowerCase();
    let s = 0;
    if (/\bcat\s*back\b|\bcatback\b/.test(joined) && !/\bfull\s*system\b/.test(joined)) s += 1000;
    if (/\bfactory\b/.test(joined)) s += 100;
    if (/\bcatted\b/.test(joined)) s += 50;
    if (/\bopf\b/.test(joined) && !/\bnon[- ]?opf\b/.test(joined)) s += 25;
    if (/\bstainless\b/.test(joined)) s += 10;
    return s;
  };

  let bestIndex = -1;
  let bestScore = -1;
  let bestPrice = Number.POSITIVE_INFINITY;
  variants.forEach((variant, index) => {
    if (variant.priceUsd <= 0) return;
    const variantScore = score(variant);
    if (
      variantScore > bestScore ||
      (variantScore === bestScore && variant.priceUsd < bestPrice)
    ) {
      bestScore = variantScore;
      bestPrice = variant.priceUsd;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0) return bestIndex;

  let lowestIndex = 0;
  let lowestPrice = Number.POSITIVE_INFINITY;
  variants.forEach((variant, index) => {
    if (variant.priceUsd > 0 && variant.priceUsd < lowestPrice) {
      lowestPrice = variant.priceUsd;
      lowestIndex = index;
    }
  });
  return lowestIndex;
}

async function buildImportRecord(
  product: IpeOfficialProductSnapshot,
  matchedItems: readonly IpeMatchManifestItem[],
  manifest: IpeMatchManifest,
  priceList: IpeParsedPriceList,
  rowToGroupKey: readonly string[],
  rowsByGroupKey: ReadonlyMap<string, readonly number[]>,
  options: CliOptions,
  translationCache: Map<string, string>
): Promise<IpeImportRecord | null> {
  const matchedBrands = new Set(
    matchedItems.map((item) => priceList.items[item.rowIndex]?.brand).filter((brand): brand is string => Boolean(brand))
  );
  const importedRows = Array.from(
    new Set([
      ...matchedItems.flatMap((item) => {
        const groupKey = rowToGroupKey[item.rowIndex] ?? '';
        return groupKey ? Array.from(rowsByGroupKey.get(groupKey) ?? [item.rowIndex]) : [item.rowIndex];
      }),
      ...priceList.items.flatMap((row, rowIndex) =>
        matchedBrands.has(row.brand) && isBrandWideAccessoryRow(row) ? [rowIndex] : []
      ),
    ])
  ).sort((left, right) => left - right);

  const priceRows = importedRows
    .map((rowIndex) => priceList.items[rowIndex])
    .filter((row): row is IpeParsedPriceListRow => Boolean(row))
    .map((row) =>
      row.price_kind === 'absolute' && row.retail_usd == null
        ? {
            ...row,
            retail_usd: computeIpeRetailPrice(row.msrp_usd, {
              thresholdUsd: priceList.pricing_formula?.threshold_usd,
              lowFeeUsd: priceList.pricing_formula?.low_fee_usd,
              highFeeUsd: priceList.pricing_formula?.high_fee_usd,
            }),
          }
        : row
    );
  if (!priceRows.length) return null;

  const productTokens = buildIpeCanonicalTokenSetFromOfficialProduct(product);
  const cleanedBodyHtmlEn = cleanIpeOfficialHtml(product.bodyHtml);
  const shortDescEn = buildIpeShortDescription(cleanedBodyHtmlEn || product.title);
  const longDescEn = htmlToPlainText(cleanedBodyHtmlEn || product.bodyHtml);
  const { category, collectionEn, collectionUa } = buildCategoryAndCollection(priceRows, productTokens);

  const variantCandidates = buildIpeVariantCandidates(product, priceRows).slice(0, PER_HANDLE_VARIANT_REVIEW_LIMIT);
  const resolvedVariants = variantCandidates
    .map((candidate) => {
      const pricing = resolveIpeVariantPricing(product, candidate, priceRows);
      if (!pricing.baseRow || pricing.priceUsd == null || pricing.priceUsd <= 0) return null;
      const directMatch = candidate.baseRow ?? pricing.baseRow;
      const optionSignature = [candidate.title, ...candidate.optionValues].filter(Boolean).join(' | ') || candidate.title;
      return {
        title: candidate.title,
        sku:
          candidate.source === 'absolute-row' && directMatch.sku
            ? directMatch.sku
            : directMatch.sku && pricing.deltaRows.length === 0
              ? directMatch.sku
              : buildIpeSyntheticVariantSku(product.handle, optionSignature),
        priceUsd: pricing.priceUsd,
        optionValues: candidate.optionValues,
        optionNames: candidate.optionNames,
        baseSku: directMatch.sku ?? null,
        deltaSkus: pricing.deltaRows.map((row) => row.sku),
        imageUrl: candidate.imageUrl ?? product.images[0] ?? null,
        reviewReasons: pricing.reviewReasons,
        confidence: pricing.confidence,
        defaultVariant: Boolean(candidate.defaultVariant),
      } satisfies IpeResolvedVariantRecord;
    })
    .filter((variant): variant is IpeResolvedVariantRecord => Boolean(variant));

  if (!resolvedVariants.length) {
    return null;
  }

  const mediaPlan = buildMediaPlan(product);
  if (!mediaPlan.length) {
    return null;
  }

  const unresolvedRows = manifest.rows.filter((item) => item.status === 'unresolved' && importedRows.includes(item.rowIndex));
  const reviewReasons = uniqueStrings([
    matchedItems.some((item) => item.status === 'review' || item.status === 'unresolved')
      ? 'product-match-review-threshold'
      : null,
    !cleanedBodyHtmlEn ? 'official-body-empty' : null,
    unresolvedRows.length ? 'unresolved-price-rows-nearby' : null,
  ]);

  let titleUa = product.title;
  let bodyHtmlUa = '';
  let shortDescUa = '';
  let longDescUa = '';

  if (options.translateUa) {
    if (options.translationProvider === 'none') {
      throw new Error('UA translation is required for commit but no translation provider is configured');
    }
    titleUa = await translateTextToUa(options.translationProvider, product.title, translationCache);
    bodyHtmlUa = cleanedBodyHtmlEn
      ? await translateTextToUa(options.translationProvider, cleanedBodyHtmlEn, translationCache, { isHtml: true })
      : '';
    shortDescUa = bodyHtmlUa ? buildIpeShortDescription(bodyHtmlUa) : shortDescEn;
    longDescUa = bodyHtmlUa ? htmlToPlainText(bodyHtmlUa) : longDescEn;
  } else {
    reviewReasons.push('ua-translation-pending');
  }

  const defaultIndex = determineDefaultVariantIndex(variantCandidates, resolvedVariants);
  const optionDefinitions = buildVariantOptions(product, variantCandidates, resolvedVariants);

  const variantPayloads: AdminShopProductVariantInput[] = resolvedVariants.map((variant, index) => ({
    title: variant.title,
    sku: variant.sku,
    position: index + 1,
    option1Value: optionDefinitions[0] ? (variant.optionValues[0] ?? variant.title) : null,
    option2Value: optionDefinitions[1] ? (variant.optionValues[1] ?? null) : null,
    option3Value: optionDefinitions[2] ? (variant.optionValues[2] ?? null) : null,
    inventoryQty: 0,
    inventoryPolicy: 'CONTINUE',
    priceUsd: variant.priceUsd,
    priceEur: null,
    priceUah: null,
    requiresShipping: true,
    taxable: true,
    image: mediaPlan[0]?.publicPath ?? null,
    isDefault: index === defaultIndex,
  }));

  const variantMapJson = serializeVariantMapForMetafield(
    product,
    resolvedVariants.map((variant) => ({
      title: variant.title,
      sku: variant.sku,
      priceUsd: variant.priceUsd,
      optionValues: variant.optionValues,
      baseSku: variant.baseSku,
      deltaSkus: variant.deltaSkus,
      reviewReasons: variant.reviewReasons,
    }))
  );

  const matchScore =
    matchedItems.reduce((sum, item) => sum + item.score, 0) / Math.max(matchedItems.length, 1);
  const baseTags = buildBaseTags(product, productTokens, category.en);
  const payload: AdminShopProductPayload = {
    slug: `ipe-${product.handle}`,
    sku: resolvedVariants[defaultIndex]?.sku ?? resolvedVariants[0]?.sku ?? null,
    scope: 'auto',
    storefront: 'main',
    brand: 'iPE exhaust',
    vendor: 'Innotech Performance Exhaust',
    productType: category.en,
    productCategory: category.en,
    categoryId: null,
    tags: baseTags,
    collectionIds: [],
    status: 'DRAFT',
    titleUa,
    titleEn: product.title,
    categoryUa: category.ua,
    categoryEn: category.en,
    shortDescUa: shortDescUa || null,
    shortDescEn: shortDescEn || null,
    longDescUa: longDescUa || null,
    longDescEn: longDescEn || null,
    bodyHtmlUa: bodyHtmlUa || null,
    bodyHtmlEn: cleanedBodyHtmlEn || null,
    leadTimeUa: null,
    leadTimeEn: null,
    stock: 'preOrder',
    collectionUa,
    collectionEn,
    priceEur: null,
    priceUsd: resolvedVariants[defaultIndex]?.priceUsd ?? resolvedVariants[0]?.priceUsd ?? null,
    priceUah: null,
    priceEurB2b: null,
    priceUsdB2b: null,
    priceUahB2b: null,
    compareAtEur: null,
    compareAtUsd: null,
    compareAtUah: null,
    compareAtEurB2b: null,
    compareAtUsdB2b: null,
    compareAtUahB2b: null,
    weight: null,
    length: null,
    width: null,
    height: null,
    isDimensionsEstimated: false,
    image: mediaPlan[0]?.publicPath ?? null,
    seoTitleUa: titleUa,
    seoTitleEn: product.title,
    seoDescriptionUa: shortDescUa || null,
    seoDescriptionEn: shortDescEn || null,
    isPublished: false,
    publishedAt: null,
    gallery: mediaPlan.map((item) => item.publicPath),
    highlights: null,
    media: mediaPlan.map((item, index) => ({
      src: item.publicPath,
      altText: `${product.title} ${index + 1}`,
      position: index + 1,
      mediaType: 'IMAGE',
    })) satisfies AdminShopProductMediaInput[],
    options: optionDefinitions,
    variants: variantPayloads,
    metafields: [
      {
        namespace: 'custom',
        key: 'official_handle',
        value: product.handle,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'official_url',
        value: product.url,
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'crawl_date',
        value: new Date().toISOString(),
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'match_score',
        value: matchScore.toFixed(3),
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'source_pdf_name',
        value: path.basename(priceList.source_pdf),
        valueType: 'single_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'variant_map_json',
        value: variantMapJson,
        valueType: 'multi_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'matched_row_indexes',
        value: importedRows.join(','),
        valueType: 'multi_line_text_field',
      },
      {
        namespace: 'custom',
        key: 'review_reasons',
        value: reviewReasons.join('\n'),
        valueType: 'multi_line_text_field',
      },
    ] satisfies AdminShopProductMetafieldInput[],
  };

  return {
    handle: product.handle,
    slug: payload.slug,
    officialUrl: product.url,
    matchScore: Number(matchScore.toFixed(3)),
    status: 'draft-review',
    reviewReasons,
    matchedRows: [...matchedItems].sort((left, right) => left.rowIndex - right.rowIndex),
    unresolvedRows,
    mediaPlan,
    variants: resolvedVariants,
    payload,
  };
}

async function fetchExistingProducts(slugs: readonly string[]) {
  if (!slugs.length) return new Map<string, { id: string; slug: string }>();
  const rows = await prisma.shopProduct.findMany({
    where: { slug: { in: [...slugs] } },
    select: { id: true, slug: true },
  });
  return new Map(rows.map((row) => [row.slug, row] as const));
}

async function applyImportRecord(record: IpeImportRecord) {
  const mediaMap = await downloadMedia(record.mediaPlan);
  const payload: AdminShopProductPayload = {
    ...record.payload,
    image: mediaMap.get(record.mediaPlan[0]?.remoteUrl ?? '') ?? record.payload.image,
    gallery: record.mediaPlan.map((item) => mediaMap.get(item.remoteUrl) ?? item.publicPath),
    media: record.payload.media.map((item, index) => {
      const planned = record.mediaPlan[index];
      return {
        ...item,
        src: planned ? mediaMap.get(planned.remoteUrl) ?? planned.publicPath : item.src,
      };
    }),
    variants: record.payload.variants.map((variant, index) => ({
      ...variant,
      image: record.mediaPlan[index]
        ? mediaMap.get(record.mediaPlan[index].remoteUrl) ?? record.mediaPlan[index].publicPath
        : mediaMap.get(record.mediaPlan[0]?.remoteUrl ?? '') ?? variant.image ?? null,
    })),
  };

  const existing = await prisma.shopProduct.findUnique({
    where: { slug: payload.slug },
    select: { id: true, slug: true },
  });

  if (existing) {
    await prisma.shopProduct.update({
      where: { slug: payload.slug },
      data: buildAdminProductUpdateData(payload),
    });
    return 'updated' as const;
  }

  await prisma.shopProduct.create({
    data: buildAdminProductCreateData(payload),
  });
  return 'created' as const;
}

async function main() {
  const options = parseCliOptions();
  await ensureDirectory(options.outputDir);

  logJson('config', {
    mode: options.commit ? 'commit' : 'dry-run',
    translateUa: options.translateUa,
    translationProvider: options.translationProvider,
    limit: options.limit,
    handle: options.handle,
    outputDir: options.outputDir,
    parsedJsonPath: options.parsedJsonPath,
    pdfPath: options.pdfPath,
    officialBaseUrl: options.officialBaseUrl,
  });

  const [priceList, officialSnapshot] = await Promise.all([
    loadParsedPriceList(options),
    fetchOfficialSnapshot(options.officialBaseUrl, options.handle ? normalizeHandle(options.handle) : null),
  ]);
  const { rowToGroupKey, rowsByGroupKey } = buildPriceRowGroupIndex(priceList);

  await writeJsonFile(path.join(options.outputDir, 'official-snapshot.json'), officialSnapshot);

  const matchManifest = buildMatchManifest(priceList, officialSnapshot);
  await writeJsonFile(path.join(options.outputDir, 'match-manifest.json'), matchManifest);

  const groupedMatches = groupManifestRowsByHandle(matchManifest);
  const translationCache = new Map<string, string>();
  const records: IpeImportRecord[] = [];

  const handles = Array.from(groupedMatches.keys())
    .filter((handle) => (options.handle ? handle === normalizeHandle(options.handle) : true))
    .sort();

  for (const handle of handles) {
    const product = officialSnapshot.products.find((item) => item.handle === handle);
    if (!product) continue;
    const record = await buildImportRecord(
      product,
      groupedMatches.get(handle) ?? [],
      matchManifest,
      priceList,
      rowToGroupKey,
      rowsByGroupKey,
      options,
      translationCache
    );
    if (record) {
      records.push(record);
    }
  }

  const limitedRecords = options.limit != null ? records.slice(0, options.limit) : records;
  await writeJsonFile(path.join(options.outputDir, 'import-batch.json'), limitedRecords);

  const existing = await fetchExistingProducts(limitedRecords.map((record) => record.slug));
  const summary = {
    officialProducts: officialSnapshot.productCount,
    priceRows: priceList.items.length,
    manifestRows: matchManifest.rows.length,
    matchedHandles: groupedMatches.size,
    importableHandles: records.length,
    applyingHandles: limitedRecords.length,
    existingDraftsOrProducts: Array.from(existing.keys()).length,
    manifestStatusCounts: {
      auto: matchManifest.rows.filter((item) => item.status === 'auto').length,
      review: matchManifest.rows.filter((item) => item.status === 'review').length,
      unresolved: matchManifest.rows.filter((item) => item.status === 'unresolved').length,
    },
    sample: limitedRecords.slice(0, 10).map((record) => ({
      handle: record.handle,
      slug: record.slug,
      matchScore: record.matchScore,
      variants: record.variants.length,
      reviewReasons: record.reviewReasons,
      action: existing.has(record.slug) ? 'update' : 'create',
    })),
  };

  await writeJsonFile(path.join(options.outputDir, 'summary.json'), summary);
  logJson('summary', summary);

  if (!options.commit) {
    return;
  }

  if (options.translationProvider === 'none') {
    throw new Error('Commit requires UA translation, but no translation provider is configured');
  }

  let created = 0;
  let updated = 0;
  const errors: Array<{ slug: string; message: string }> = [];

  for (const record of limitedRecords) {
    try {
      const action = await applyImportRecord(record);
      if (action === 'created') created += 1;
      if (action === 'updated') updated += 1;
      console.log(`[${action}] ${record.slug}`);
    } catch (error) {
      errors.push({
        slug: record.slug,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const commitSummary = {
    created,
    updated,
    errors,
    committedAt: new Date().toISOString(),
  };

  await writeJsonFile(path.join(options.outputDir, 'commit-summary.json'), commitSummary);
  logJson('commit-summary', commitSummary);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
