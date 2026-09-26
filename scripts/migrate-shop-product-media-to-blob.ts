#!/usr/bin/env tsx
/*
 * Copy remote product media into Vercel Blob and rewrite catalog references.
 *
 * The default mode is a read-only plan. --commit uploads first and only then
 * rewrites a product when every remote media source referenced by that product
 * has a successful Blob mapping. This prevents partial galleries.
 *
 * Usage:
 *   npm run shop:media:blob:dry
 *   npm run shop:media:blob:dry -- --brand="MST Performance"
 *   npm run shop:media:blob -- --commit
 */

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";
import { isBlobStorageConfigured } from "@/lib/runtimeBlobStorage";
import {
  assertBlobCleanupSucceeded,
  deleteUploadedBlobUrls,
  getUnreferencedUploadedBlobUrls,
} from "@/lib/blobUploadRetention";
import { buildShopCatalogAdminSnapshot } from "@/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "@/lib/shopCatalogMutationCoordinator.server";
import {
  buildShopProductMediaBlobPathname,
  collectRemoteShopProductMediaSources,
  getShopProductMediaDownloadCandidates,
  normalizeShopProductMediaSource,
  rewriteShopProductMediaValue,
} from "@/lib/shopProductMediaMigration";

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);
const curlExecutable = process.platform === "win32" ? "curl.exe" : "curl";
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const reusePublicBlobs = args.includes("--reuse-public-blobs");
const allowPartial = args.includes("--allow-partial");
const concurrency = Math.max(1, Math.min(32, Number(option("--concurrency") ?? 8) || 8));
const rewriteConcurrency = Math.max(
  1,
  Math.min(8, Number(option("--rewrite-concurrency") ?? 8) || 8)
);
const transactionMaxWaitMs = Math.max(
  2_000,
  Math.min(60_000, Number(option("--transaction-max-wait") ?? 2_000) || 2_000)
);
const limit = parsePositiveInteger(option("--limit"));
const brand = option("--brand");
const slug = option("--slug");
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const uploadedThisRun = new Set<string>();
const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  sku: true,
  brand: true,
  image: true,
  gallery: true,
  catalogVersion: true,
  media: {
    select: { id: true, src: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  },
  variants: {
    select: { id: true, image: true },
    orderBy: [{ position: "asc" as const }, { createdAt: "asc" as const }],
  },
  metafields: {
    where: { namespace: "wheelforce_import", key: "accessory_options" },
    select: { id: true, namespace: true, key: true, value: true },
  },
} satisfies Prisma.ShopProductSelect;

type ProductRow = Prisma.ShopProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

type SourceResolution = {
  source: string;
  blobUrl: string | null;
  status: "existing" | "uploaded" | "failed" | "pending";
  error?: string;
};

function option(name: string) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

function parsePositiveInteger(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return token;
}

function blobStoreId(token: string) {
  const parts = token.split("_");
  const storeId = parts[3]?.trim();
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN does not contain a store id");
  return storeId;
}

function curlHeaders(token: string) {
  return [
    "-H",
    `Authorization: Bearer ${token}`,
    "-H",
    `x-vercel-blob-store-id: ${blobStoreId(token)}`,
    "-H",
    `x-api-version: ${BLOB_API_VERSION}`,
  ];
}

function parseCurlStatus(output: string) {
  const marker = "\n__ONECOMPANY_STATUS__:";
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) throw new Error("curl response status marker was missing");
  return {
    status: Number(output.slice(markerIndex + marker.length).trim()),
    body: output.slice(0, markerIndex),
  };
}

async function curlJson(
  method: "GET" | "POST",
  pathname: string,
  body?: unknown
): Promise<any> {
  const token = blobToken();
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    "120",
    "--request",
    method,
    ...curlHeaders(token),
    "-H",
    "content-type: application/json",
  ];
  if (body !== undefined) args.push("--data-raw", JSON.stringify(body));
  args.push(
    "--write-out",
    "\n__ONECOMPANY_STATUS__:%{http_code}",
    `${BLOB_API_URL}${pathname}`
  );

  const result = await execFileAsync(curlExecutable, args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const response = parseCurlStatus(String(result.stdout));
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Blob API ${method} ${pathname} returned HTTP ${response.status}: ${response.body.slice(0, 240)}`);
  }
  return response.body ? JSON.parse(response.body) : null;
}

function parseFinalCurlHeaders(rawHeaders: string) {
  const blocks = rawHeaders
    .split(/\r?\n\r?\n/)
    .filter((block) => /^HTTP\/\d(?:\.\d)?\s+\d+/m.test(block));
  const final = blocks.at(-1) ?? rawHeaders;
  const status = Number(final.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/m)?.[1] ?? 0);
  const contentType = final.match(/^content-type:\s*([^\r\n]+)/im)?.[1]?.trim() ?? "";
  const contentLength = Number(final.match(/^content-length:\s*(\d+)/im)?.[1] ?? NaN);
  return { status, contentType, contentLength };
}

async function downloadRemoteImageCandidate(source: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "onecompany-media-"));
  const bodyPath = path.join(tempDir, "body");
  const headerPath = path.join(tempDir, "headers");
  try {
    const result = await execFileAsync(
      curlExecutable,
      [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "60",
        "--dump-header",
        headerPath,
        "--output",
        bodyPath,
        "-H",
        "accept: image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.1",
        "-A",
        "OneCompany catalog media migration/1.0",
        source,
      ],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    void result;
    const headers = parseFinalCurlHeaders(await fs.readFile(headerPath, "utf8"));
    if (headers.status < 200 || headers.status >= 300) {
      throw new Error(`source returned HTTP ${headers.status}`);
    }
    const buffer = await fs.readFile(bodyPath);
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`source is larger than ${formatBytes(MAX_IMAGE_BYTES)}`);
    }
    const contentType = headers.contentType.split(";", 1)[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`source returned non-image content-type ${contentType || "unknown"}`);
    }
    return { buffer, contentType };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadRemoteImage(source: string) {
  let lastError: unknown = null;
  for (const candidate of getShopProductMediaDownloadCandidates(source)) {
    try {
      return await downloadRemoteImageCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "source download failed"));
}

async function uploadPublicBlobViaCurl(pathname: string, buffer: Buffer, contentType: string) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "onecompany-blob-"));
  const bodyPath = path.join(tempDir, "body");
  try {
    await fs.writeFile(bodyPath, buffer);
    const token = blobToken();
    const result = await execFileAsync(
      curlExecutable,
      [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "120",
        "--request",
        "PUT",
        ...curlHeaders(token),
        "-H",
        "x-vercel-blob-access: public",
        "-H",
        `x-content-type: ${contentType}`,
        "-H",
        "x-add-random-suffix: 0",
        "-H",
        "x-allow-overwrite: 0",
        "-H",
        "x-cache-control-max-age: 2592000",
        "--upload-file",
        bodyPath,
        "--write-out",
        "\n__ONECOMPANY_STATUS__:%{http_code}",
        `${BLOB_API_URL}/?pathname=${encodeURIComponent(pathname)}`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
    );
    const response = parseCurlStatus(String(result.stdout));
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Blob upload returned HTTP ${response.status}: ${response.body.slice(0, 240)}`);
    }
    return JSON.parse(response.body) as { url: string; pathname: string };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function deleteBlobViaCurl(url: string) {
  await curlJson("POST", "/delete", { urls: [url] });
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  workerCount: number
) {
  let cursor = 0;
  async function pump() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, pump));
}

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
        : "";
      const message = error instanceof Error ? error.message : String(error);
      const transient = code === "P1017" || code === "P2024" || code === "P2028" ||
        code === "P2034" || /40001|could not serialize|Catalog version conflict|Unable to start a transaction in the given time/u.test(message);
      if (!transient || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error("Catalog media migration retry loop exhausted");
}

function buildWhere(): Prisma.ShopProductWhereInput {
  const where: Prisma.ShopProductWhereInput = {};
  if (brand) where.brand = { equals: brand, mode: "insensitive" };
  if (slug) where.slug = slug;
  return where;
}

async function loadProducts() {
  return prisma.shopProduct.findMany({
    where: buildWhere(),
    select: PRODUCT_SELECT,
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
  });
}

function productSources(product: ProductRow) {
  const sources = new Set<string>();
  collectRemoteShopProductMediaSources(product.image, sources);
  collectRemoteShopProductMediaSources(product.gallery, sources);
  collectRemoteShopProductMediaSources(product.media, sources);
  collectRemoteShopProductMediaSources(product.variants, sources);
  for (const metafield of product.metafields) {
    try {
      collectRemoteShopProductMediaSources(JSON.parse(metafield.value), sources);
    } catch {
      // Keep malformed accessory metadata untouched and migrate all other media.
    }
  }
  return sources;
}

function contentTypeFromSource(source: string) {
  const pathname = new URL(source).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".avif")) return "image/avif";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return pathname.endsWith(".jpg") || pathname.endsWith(".jpeg") ? "image/jpeg" : null;
}

function resolveImageContentType(response: Response, source: string) {
  const header = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (header) {
    if (!header.startsWith("image/")) {
      throw new Error(`source returned non-image content-type ${header}`);
    }
    return header;
  }
  const bySource = contentTypeFromSource(source);
  if (!bySource) throw new Error("source did not provide an image content-type");
  return bySource;
}

async function downloadImage(source: string) {
  const response = await fetch(source, {
    redirect: "follow",
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.1",
      "user-agent": "OneCompany catalog media migration/1.0",
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);

  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new Error(`source is larger than ${formatBytes(MAX_IMAGE_BYTES)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`source is larger than ${formatBytes(MAX_IMAGE_BYTES)}`);
  }

  return { buffer, contentType: resolveImageContentType(response, source) };
}

async function loadExistingBlobUrls(sources: string[]) {
  if (reusePublicBlobs) {
    const sample = await prisma.shopProduct.findFirst({
      where: {
        ...(brand ? { brand: { equals: brand, mode: "insensitive" as const } } : {}),
        image: { contains: ".public.blob.vercel-storage.com" },
      },
      select: { image: true },
    });
    if (!sample?.image) throw new Error("No public Blob URL is available to identify the existing store");
    const origin = new URL(sample.image).origin;
    const existing = new Map<string, string>();
    await runWithConcurrency(sources, async (source) => {
      const pathname = buildShopProductMediaBlobPathname(source);
      const url = `${origin}/${pathname}`;
      try {
        const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
        if (response.ok && response.headers.get("content-type")?.toLowerCase().startsWith("image/")) {
          existing.set(pathname, url);
        }
      } catch {
        // Missing Blob copies remain unresolved and are reported below.
      }
    }, concurrency);
    return existing;
  }
  if (!isBlobStorageConfigured()) return new Map<string, string>();
  const existing = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "1000", prefix: "media/library/shop-products/" });
    if (cursor) params.set("cursor", cursor);
    const page = (await curlJson("GET", `?${params.toString()}`)) as {
      blobs: Array<{ pathname: string; url: string }>;
      cursor?: string;
      hasMore?: boolean;
    };
    for (const blob of page.blobs ?? []) existing.set(blob.pathname, blob.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return existing;
}

async function resolveSources(sources: string[], existingBlobUrls: Map<string, string>) {
  const resolutions = new Map<string, SourceResolution>();
  const missing: string[] = [];

  for (const source of sources) {
    const pathname = buildShopProductMediaBlobPathname(source);
    const existing = existingBlobUrls.get(pathname);
    if (existing) {
      resolutions.set(source, { source, blobUrl: existing, status: "existing" });
    } else if (commit && !reusePublicBlobs) {
      missing.push(source);
    } else if (reusePublicBlobs) {
      resolutions.set(source, { source, blobUrl: null, status: "failed", error: "No verified public Blob copy" });
    } else {
      resolutions.set(source, { source, blobUrl: null, status: "pending" });
    }
  }

  if (!commit || reusePublicBlobs) return resolutions;

  await runWithConcurrency(
    missing,
    async (source) => {
      try {
        const downloaded = await downloadRemoteImage(source);
        const pathname = buildShopProductMediaBlobPathname(source);
        const uploaded = await uploadPublicBlobViaCurl(
          pathname,
          downloaded.buffer,
          downloaded.contentType
        );
        existingBlobUrls.set(pathname, uploaded.url);
        uploadedThisRun.add(uploaded.url);
        resolutions.set(source, { source, blobUrl: uploaded.url, status: "uploaded" });
      } catch (error) {
        resolutions.set(source, {
          source,
          blobUrl: null,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    concurrency
  );

  return resolutions;
}

async function rewriteProducts(products: ProductRow[], resolvedSources: Map<string, string>) {
  let productPrimaryImages = 0;
  let productGalleries = 0;
  let productMedia = 0;
  let variantImages = 0;
  let accessoryOptionImages = 0;
  let productsSkipped = 0;
  let mutationFailures = 0;
  const catalogOutboxIds: string[] = [];

  await runWithConcurrency(
    products,
    async (product) => {
    const expectedSources = productSources(product);
    if (!allowPartial && [...expectedSources].some((source) => !resolvedSources.has(source))) {
      productsSkipped += 1;
      return;
    }

    const primarySource = normalizeShopProductMediaSource(product.image);
    const nextPrimary = primarySource ? resolvedSources.get(primarySource) : undefined;
    const rewrittenGallery = rewriteShopProductMediaValue(product.gallery, resolvedSources);
    const mediaUpdates = product.media
      .map((media) => {
        const source = normalizeShopProductMediaSource(media.src);
        const next = source ? resolvedSources.get(source) : undefined;
        return next ? { id: media.id, src: next } : null;
      })
      .filter((value): value is { id: string; src: string } => Boolean(value));
    const variantUpdates = product.variants
      .map((variant) => {
        const source = normalizeShopProductMediaSource(variant.image);
        const next = source ? resolvedSources.get(source) : undefined;
        return next ? { id: variant.id, image: next } : null;
      })
      .filter((value): value is { id: string; image: string } => Boolean(value));
    const metafieldUpdates = product.metafields.flatMap((metafield) => {
      try {
        const rewritten = rewriteShopProductMediaValue(
          JSON.parse(metafield.value),
          resolvedSources
        );
        return rewritten.replacements
          ? [{ id: metafield.id, value: JSON.stringify(rewritten.value) }]
          : [];
      } catch {
        return [];
      }
    });

    const primaryChanged = Boolean(nextPrimary && nextPrimary !== product.image);
    const hasChanges =
      primaryChanged ||
      rewrittenGallery.replacements > 0 ||
      mediaUpdates.length > 0 ||
      variantUpdates.length > 0 ||
      metafieldUpdates.length > 0;
    if (!hasChanges) return;

    const mutation = await retryTransient(async () => {
      const latest = await prisma.shopProduct.findUnique({
        where: { id: product.id },
        select: { catalogVersion: true },
      });
      if (!latest) throw new Error(`Missing product during media migration: ${product.id}`);
      return coordinateShopCatalogProductMutationWithClient(prisma, {
        productId: product.id,
        expectedCatalogVersion: latest.catalogVersion.toString(),
      changeDomains: ["MEDIA"],
      transactionMaxWaitMs,
        async mutateAndSnapshot(tx, nextCatalogVersion) {
          const productData: Prisma.ShopProductUpdateInput = {};
          if (primaryChanged && nextPrimary) productData.image = nextPrimary;
          if (rewrittenGallery.replacements > 0) {
            productData.gallery = rewrittenGallery.value as Prisma.InputJsonValue;
          }
          if (Object.keys(productData).length > 0) {
            await tx.shopProduct.update({ where: { id: product.id }, data: productData });
          }
          for (const media of mediaUpdates) {
            const updated = await tx.shopProductMedia.updateMany({
              where: { id: media.id, productId: product.id },
              data: { src: media.src },
            });
            if (updated.count !== 1) throw new Error(`Media ownership changed for ${media.id}`);
          }
          for (const variant of variantUpdates) {
            const updated = await tx.shopProductVariant.updateMany({
              where: { id: variant.id, productId: product.id },
              data: { image: variant.image },
            });
            if (updated.count !== 1) throw new Error(`Media ownership changed for ${variant.id}`);
          }
          for (const metafield of metafieldUpdates) {
            const updated = await tx.shopProductMetafield.updateMany({
              where: {
                id: metafield.id,
                productId: product.id,
                namespace: "wheelforce_import",
                key: "accessory_options",
              },
              data: { value: metafield.value },
            });
            if (updated.count !== 1) {
              throw new Error("Accessory media ownership changed for " + metafield.id);
            }
          }
          return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
            type: "IMPORT",
            id: "shop-product-media-blob-migration@system.local",
            reason: "shop.product-media.blob-migration",
          });
        },
      });
    }).catch((error) => {
      mutationFailures += 1;
      console.error(
        `Product mutation skipped for ${product.slug}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    });

    if (!mutation) return;

    catalogOutboxIds.push(mutation.outboxId);
    if (primaryChanged) productPrimaryImages += 1;
    if (rewrittenGallery.replacements > 0) productGalleries += 1;
    productMedia += mediaUpdates.length;
    variantImages += variantUpdates.length;
    accessoryOptionImages += metafieldUpdates.length;
    },
    rewriteConcurrency
  );

  return {
    productPrimaryImages,
    productGalleries,
    productMedia,
    variantImages,
    accessoryOptionImages,
    productsSkipped,
    mutationFailures,
    catalogOutboxIds,
  };
}

async function cleanupUnreferencedUploads() {
  if (!commit || uploadedThisRun.size === 0) return;
  const [products, media, variants, metafields] = await Promise.all([
    prisma.shopProduct.findMany({ select: { image: true, gallery: true } }),
    prisma.shopProductMedia.findMany({ select: { src: true } }),
    prisma.shopProductVariant.findMany({ select: { image: true } }),
    prisma.shopProductMetafield.findMany({
      where: { namespace: "wheelforce_import", key: "accessory_options" },
      select: { value: true },
    }),
  ]);
  const retainedBlobUrls = new Set<string>([
    ...products.flatMap((product) => collectBlobUrls(product.gallery)),
    ...products.flatMap((product) => collectBlobUrls(product.image)),
    ...media.flatMap((row) => collectBlobUrls(row.src)),
    ...variants.flatMap((row) => collectBlobUrls(row.image)),
    ...metafields.flatMap((row) => collectBlobUrls(row.value)),
  ]);
  const orphaned = getUnreferencedUploadedBlobUrls(uploadedThisRun, retainedBlobUrls);
  const cleanup = await deleteUploadedBlobUrls(orphaned, deleteBlobViaCurl);
  console.log(`Orphan uploads removed: ${cleanup.deleted.length}/${orphaned.length}`);
  assertBlobCleanupSucceeded(cleanup.failures);
}

function collectBlobUrls(value: unknown) {
  const urls: string[] = [];
  const visit = (entry: unknown) => {
    if (typeof entry === "string" && entry.includes(".blob.vercel-storage.com/")) {
      urls.push(entry);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (entry && typeof entry === "object") {
      Object.values(entry as Record<string, unknown>).forEach(visit);
    }
  };
  visit(value);
  return urls;
}

async function main() {
  console.log("=== Shop product media → Vercel Blob migration ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN (pass --commit to apply)"}`);
  console.log(`Scope: ${brand ? `brand=${brand}` : slug ? `slug=${slug}` : "all products"}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`DB rewrite concurrency: ${rewriteConcurrency}; transaction max wait: ${transactionMaxWaitMs}ms`);
  console.log(`Incomplete products: ${allowPartial ? "rewrite verified sources only" : "skip atomically"}`);

  if (commit && !reusePublicBlobs && !isBlobStorageConfigured()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Pull the intended Vercel environment before --commit."
    );
  }

  const products = await loadProducts();
  const sourceSet = new Set<string>();
  for (const product of products) {
    for (const source of productSources(product)) sourceSet.add(source);
  }
  const sources = [...sourceSet].sort();
  const existingBlobUrls = await loadExistingBlobUrls(sources);
  const resolutions = await resolveSources(sources, existingBlobUrls);
  const resolvedSources = new Map(
    [...resolutions.entries()]
      .filter(([, resolution]) => resolution.blobUrl)
      .map(([source, resolution]) => [source, resolution.blobUrl!] as const)
  );
  const failed = [...resolutions.values()].filter((resolution) => resolution.status === "failed");
  const existing = [...resolutions.values()].filter((resolution) => resolution.status === "existing");
  const uploaded = [...resolutions.values()].filter((resolution) => resolution.status === "uploaded");
  const pending = [...resolutions.values()].filter((resolution) => resolution.status === "pending");

  console.log(`Products inspected: ${products.length}`);
  console.log(`Unique remote media sources: ${sources.length}`);
  console.log(`Already in Blob: ${existing.length}`);
  console.log(`Uploaded now: ${uploaded.length}`);
  if (!commit) console.log(`Would upload: ${pending.length}`);
  console.log(`Source failures: ${failed.length}`);
  for (const failure of failed.slice(0, 20)) {
    console.log(`  - ${failure.source}: ${failure.error}`);
  }
  if (failed.length > 20) console.log(`  …and ${failed.length - 20} more`);

  if (commit) {
    const dbSummary = await rewriteProducts(products, resolvedSources);
    console.log(`Products skipped because media was incomplete: ${dbSummary.productsSkipped}`);
    console.log(`Primary images rewritten: ${dbSummary.productPrimaryImages}`);
    console.log(`Product galleries rewritten: ${dbSummary.productGalleries}`);
    console.log(`Product media rows rewritten: ${dbSummary.productMedia}`);
    console.log(`Variant images rewritten: ${dbSummary.variantImages}`);
    console.log(`Accessory option image sets rewritten: ${dbSummary.accessoryOptionImages}`);
    console.log(`Product mutation failures for retry: ${dbSummary.mutationFailures}`);
    console.log(`Catalog outbox events: ${dbSummary.catalogOutboxIds.length}`);
    if (dbSummary.mutationFailures > 0) process.exitCode = 1;
  } else {
    console.log("Dry-run only: no Blob uploads or database writes were made.");
  }

  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\nShop product media Blob migration failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupUnreferencedUploads();
    } catch (error) {
      console.error(`Orphan cleanup failed: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
