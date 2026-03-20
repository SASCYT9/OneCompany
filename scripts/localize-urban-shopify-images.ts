import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import { PrismaClient, Prisma } from '@prisma/client';

loadEnv({ path: join(process.cwd(), '.env.local') });
loadEnv();

const prisma = new PrismaClient();

const STORE_KEY = 'urban';
const SHOPIFY_CDN_RE = /https?:\/\/[^/\s]*cdn\.shopify\.com\//i;
const OUTPUT_DIR = join(process.cwd(), 'public', 'images', 'shop', 'products', STORE_KEY);
const REPORT_DIR = join(process.cwd(), 'scripts', 'dist');
const MANIFEST_PATH = join(REPORT_DIR, 'urban-shopify-image-manifest.json');
const REPORT_PATH = join(REPORT_DIR, 'urban-shopify-image-localization.json');
const DOWNLOAD_CONCURRENCY = 8;

type ManifestEntry = {
  sourceUrl: string;
  localPath: string;
  localUrl: string;
  sha1: string;
  size: number;
  contentType: string | null;
  updatedAt: string;
};

type Manifest = Record<string, ManifestEntry>;

type ProductRow = {
  id: string;
  slug: string;
  image: string | null;
  gallery: Prisma.JsonValue | null;
  media: Array<{ id: string; src: string }>;
  variants: Array<{ id: string; image: string | null }>;
};

function isShopifyUrl(value: string | null | undefined): value is string {
  return Boolean(value && SHOPIFY_CDN_RE.test(value));
}

function toJsonStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function sanitizeSegment(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalized || 'asset';
}

function fileExtensionFromContentType(contentType: string | null) {
  const normalized = String(contentType ?? '').toLowerCase();
  if (normalized.includes('image/jpeg')) return '.jpg';
  if (normalized.includes('image/png')) return '.png';
  if (normalized.includes('image/webp')) return '.webp';
  if (normalized.includes('image/gif')) return '.gif';
  if (normalized.includes('image/svg+xml')) return '.svg';
  if (normalized.includes('image/avif')) return '.avif';
  return '';
}

function fileExtensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const ext = parse(pathname).ext.toLowerCase();
    if (ext && ext.length <= 6) return ext;
  } catch {
    return '';
  }

  return '';
}

function buildTarget(url: string, contentType: string | null) {
  const hash = createHash('sha1').update(url).digest('hex');
  const shard = hash.slice(0, 2);
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  })();
  const sourceBaseName = sanitizeSegment(parse(pathname).name || 'image');
  const extension = fileExtensionFromContentType(contentType) || fileExtensionFromUrl(url) || '.bin';
  const fileName = `${sourceBaseName}-${hash.slice(0, 10)}${extension}`;
  const relativePath = join(shard, fileName);
  const localPath = join(OUTPUT_DIR, relativePath);
  const localUrl = `/images/shop/products/${STORE_KEY}/${relativePath.replace(/\\/g, '/')}`;

  return {
    hash,
    localPath,
    localUrl,
  };
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) return {};

  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
  } catch {
    return {};
  }
}

function persistManifest(manifest: Manifest) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function fetchBufferWithRetry(url: string) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'OneCompanyShopImageLocalizer/1.0',
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type'),
      };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to download ${url}`);
}

async function ensureLocalizedAsset(url: string, manifest: Manifest) {
  const existing = manifest[url];
  if (existing && existsSync(existing.localPath)) {
    return existing;
  }

  const { buffer, contentType } = await fetchBufferWithRetry(url);
  const target = buildTarget(url, contentType);

  mkdirSync(join(OUTPUT_DIR, target.localUrl.split('/').slice(-2, -1)[0] ?? ''), { recursive: true });
  mkdirSync(parse(target.localPath).dir, { recursive: true });
  writeFileSync(target.localPath, buffer);

  const entry: ManifestEntry = {
    sourceUrl: url,
    localPath: target.localPath,
    localUrl: target.localUrl,
    sha1: createHash('sha1').update(buffer).digest('hex'),
    size: statSync(target.localPath).size,
    contentType,
    updatedAt: new Date().toISOString(),
  };

  manifest[url] = entry;
  return entry;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const manifest = loadManifest();

  const products = (await prisma.shopProduct.findMany({
    where: { storeKey: STORE_KEY },
    select: {
      id: true,
      slug: true,
      image: true,
      gallery: true,
      media: {
        select: {
          id: true,
          src: true,
        },
      },
      variants: {
        select: {
          id: true,
          image: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })) as ProductRow[];

  const urlSet = new Set<string>();

  for (const product of products) {
    if (isShopifyUrl(product.image)) urlSet.add(product.image);
    for (const image of toJsonStringArray(product.gallery)) {
      if (isShopifyUrl(image)) urlSet.add(image);
    }
    for (const media of product.media) {
      if (isShopifyUrl(media.src)) urlSet.add(media.src);
    }
    for (const variant of product.variants) {
      if (isShopifyUrl(variant.image)) urlSet.add(variant.image);
    }
  }

  const shopifyUrls = Array.from(urlSet.values()).sort();
  const limit = pLimit(DOWNLOAD_CONCURRENCY);
  const failures: Array<{ url: string; error: string }> = [];

  if (apply) {
    await Promise.all(
      shopifyUrls.map((url) =>
        limit(async () => {
          try {
            await ensureLocalizedAsset(url, manifest);
          } catch (error) {
            failures.push({
              url,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })
      )
    );

    persistManifest(manifest);
  }

  let productsUpdated = 0;
  let mediaUpdated = 0;
  let variantsUpdated = 0;
  let galleryEntriesUpdated = 0;

  if (apply) {
    for (const product of products) {
      const productUpdate: Prisma.ShopProductUpdateInput = {};

      if (isShopifyUrl(product.image) && manifest[product.image]) {
        productUpdate.image = manifest[product.image].localUrl;
      }

      const gallery = toJsonStringArray(product.gallery);
      if (gallery.length) {
        const localizedGallery = gallery.map((value) => (isShopifyUrl(value) && manifest[value] ? manifest[value].localUrl : value));
        const changedEntries = localizedGallery.filter((value, index) => value !== gallery[index]).length;
        if (changedEntries > 0) {
          productUpdate.gallery = localizedGallery;
          galleryEntriesUpdated += changedEntries;
        }
      }

      if (Object.keys(productUpdate).length > 0) {
        await prisma.shopProduct.update({
          where: { id: product.id },
          data: productUpdate,
        });
        productsUpdated += 1;
      }

      for (const media of product.media) {
        if (isShopifyUrl(media.src) && manifest[media.src]) {
          await prisma.shopProductMedia.update({
            where: { id: media.id },
            data: {
              src: manifest[media.src].localUrl,
            },
          });
          mediaUpdated += 1;
        }
      }

      for (const variant of product.variants) {
        if (isShopifyUrl(variant.image) && manifest[variant.image]) {
          await prisma.shopProductVariant.update({
            where: { id: variant.id },
            data: {
              image: manifest[variant.image].localUrl,
            },
          });
          variantsUpdated += 1;
        }
      }
    }
  }

  const successfulLocalizations = Object.keys(manifest).filter((url) => isShopifyUrl(url)).length;
  const report = {
    generatedAt: new Date().toISOString(),
    storeKey: STORE_KEY,
    apply,
    totals: {
      products: products.length,
      uniqueShopifyUrls: shopifyUrls.length,
      successfulLocalizations,
      failedLocalizations: failures.length,
      productsUpdated,
      mediaUpdated,
      variantsUpdated,
      galleryEntriesUpdated,
    },
    failures,
  };

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nLocalization report saved to ${REPORT_PATH}`);
  if (apply) {
    console.log(`Manifest saved to ${MANIFEST_PATH}`);
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
