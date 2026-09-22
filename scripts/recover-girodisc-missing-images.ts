#!/usr/bin/env tsx

import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";

import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import {
  buildShopProductMediaBlobPathname,
  normalizeShopProductMediaSource,
  rewriteShopProductMediaValue,
} from "../src/lib/shopProductMediaMigration";

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const commit = args.includes("--commit");
const brand = option("--brand") ?? "GiroDisc";
const discoveryConcurrency = positiveInteger("--discovery-concurrency") ?? 6;
const rewriteConcurrency = positiveInteger("--rewrite-concurrency") ?? 4;
const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";
const BLOB_PUBLIC_HOST = "rfip333zgtfizdii.public.blob.vercel-storage.com";
const uploadedThisRun = new Set<string>();

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  sku: true,
  brand: true,
  titleUa: true,
  titleEn: true,
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
} satisfies Prisma.ShopProductSelect;

type ProductRow = Prisma.ShopProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

type RecoveryResolution = {
  source: string;
  sku: string;
  officialPage: string | null;
  officialImage: string | null;
  blobUrl: string | null;
  status: "uploaded" | "existing" | "failed" | "pending";
  error?: string;
};

const EXPLICIT_OFFICIAL_IMAGES: Record<string, { page: string; image: string }> = {
  "BURGER-1521652035": {
    page: "https://burgertuning.com/products/replacement-control-boards",
    image:
      "https://cdn.shopify.com/s/files/1/0890/2048/products/N54_JB4_replacement_board.jpg?v=1775842545",
  },
  "BURGER-1150281603": {
    page: "https://burgertuning.com/products/jb4-replacement-enclosure-case-or-cover",
    image:
      "https://cdn.shopify.com/s/files/1/0890/2048/files/JB4_high_temprature_enclosure.png?v=1784740056",
  },
  "96481775DA": {
    page: "https://ducatism.com/en-us/products/96481773da-96481775da",
    image: "https://ducatism.com/cdn/shop/files/ducatism_96481772da.jpg?v=1747552444",
  },
  "96482501AA": {
    page: "https://ducatism.com/en-gb/products/ducati-multistradav4-96482501aa",
    image:
      "https://ducatism.com/cdn/shop/files/images_1_2aac1f5e-cad2-4bf7-ad85-40d0003ac749.jpg?v=1772174546",
  },
  "96482291BA": {
    page: "https://shop.ducatimilano.com/en/310477-scarico-racing-completo-akrapovic-96482291ba-multistrada-v4s.html",
    image:
      "https://shop-ps.ducatimilano.com/57279-home_default/scarico-racing-completo-akrapovic-96482291ba-multistrada-v4s.jpg",
  },
  "96482291AA": {
    page: "https://victoryparts.it/en/exhaust/1012-akrapovic-racing-exhaust-for-multistrada-v4-rally-96482291aa.html",
    image:
      "https://victoryparts.it/2505-large_default/akrapovic-racing-exhaust-for-multistrada-v4-rally-96482291aa.jpg",
  },
  "96482441BA": {
    page: "https://www.ducperformance.com/product/ducati-silencer-96482441ba/",
    image:
      "https://ducperformance.com/wp-content/uploads/2025/09/BE509ED773993A2772CD8316CF18C484.jpg",
  },
  "96482293BA": {
    page: "https://www.ducati.com/us/en/accessories/ACC013206",
    image:
      "https://media.ducati.com/EPCResources/GRAPHICS/immagini_accessori/F9/F9D226B5AE84FFD8D3B58ECA7711DF3D.png",
  },
  "A1-300": {
    page: "https://www.trackdayshop.cz/girodisc-a1-300-sada-prednich-dvoudilnych-brzdovych-kotoucu-mclaren-senna/",
    image:
      "https://cdn.myshoptet.com/usr/www.trackdayshop.cz/user/shop/big/26159_26159-girodisc-a1-300-sada-brzdovych-kotoucu.jpg?ff=1&x=1024&y=768&q=95&ts=6a78d897&sg=2a03b0b7",
  },
  "CCRK1-075": {
    page: "https://atomic-shop.eu/products/girodisc-ccrk1-075-front-brake-caliper-rebuild-kit-30-34-38-mm",
    image:
      "https://atomic-shop.eu/cdn/shop/files/girodisc-front-brake-caliper-rebuild-kit_1.jpg?v=1786978184&width=1024",
  },
  "CDB1-005": {
    page: "https://www.ddesignmotorsport.com/en/cdb1-005-girodisc-dust-boot-kit",
    image: "https://www.ddesignmotorsport.com/bilder/artiklar/gdsCDB1-005.jpg?m=1671068028",
  },
  "CDB2-003": {
    page: "https://www.ddesignmotorsport.com/en/cdb2-003-girodisc-dust-boot-kit",
    image: "https://www.ddesignmotorsport.com/bilder/artiklar/gdsCDB2-003.jpg?m=1671068034",
  },
  "GP50-1666.16": {
    page: "https://atomic-shop.eu/products/girodisc-gp50-1666-16-brake-pads-gp50-racing-for-ford-mustang-shelby-gt500-2013-2014",
    image:
      "https://atomic-shop.eu/cdn/shop/files/girodisc-brake-pads-magic-performance.jpg?v=1786978178&width=1024",
  },
  "MP-1289": {
    page: "https://atomic-shop.eu/products/girodisc-mp-1289-brake-pads-magic-performance-for-mercedes-benz-cl63-amg-cl63-amg-c216-s63-amg-s65-amg-w212",
    image:
      "https://atomic-shop.eu/cdn/shop/files/girodisc-brake-pads-magic-performance_942aaf5a-6d2b-456e-95de-780cdf60bb3d.jpg?v=1786978179&width=1024",
  },
};

function positiveInteger(name: string) {
  const raw = args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function option(name: string) {
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!value) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return value;
}

function storeId(value: string) {
  const id = value.split("_")[3]?.trim();
  if (!id) throw new Error("BLOB_READ_WRITE_TOKEN does not contain a store id");
  return id;
}

function blobHeaders() {
  const value = token();
  return [
    "-H",
    `Authorization: Bearer ${value}`,
    "-H",
    `x-vercel-blob-store-id: ${storeId(value)}`,
    "-H",
    `x-api-version: ${BLOB_API_VERSION}`,
  ];
}

function parseCurlStatus(output: string) {
  const marker = "\n__ONECOMPANY_STATUS__:";
  const index = output.lastIndexOf(marker);
  if (index < 0) throw new Error("curl status marker missing");
  return { status: Number(output.slice(index + marker.length).trim()), body: output.slice(0, index) };
}

function finalHeaders(raw: string) {
  const blocks = raw
    .split(/\r?\n\r?\n/)
    .filter((block) => /^HTTP\/\d(?:\.\d)?\s+\d+/m.test(block));
  const block = blocks.at(-1) ?? raw;
  return {
    status: Number(block.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/m)?.[1] ?? 0),
    contentType: block.match(/^content-type:\s*([^\r\n]+)/im)?.[1]?.split(";", 1)[0]?.trim() ?? "",
  };
}

async function curlText(url: string) {
  const result = await execFileAsync(
    "curl.exe",
    ["--silent", "--show-error", "--location", "--max-time", "40", "-A", "Mozilla/5.0", url],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  return String(result.stdout);
}

async function curlJson(method: "POST", pathname: string, body: unknown) {
  const result = await execFileAsync(
    "curl.exe",
    [
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "120",
      "--request",
      method,
      ...blobHeaders(),
      "-H",
      "content-type: application/json",
      "--data-raw",
      JSON.stringify(body),
      "--write-out",
      "\n__ONECOMPANY_STATUS__:%{http_code}",
      `${BLOB_API_URL}${pathname}`,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
  );
  const response = parseCurlStatus(String(result.stdout));
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Blob API ${method} ${pathname} returned HTTP ${response.status}`);
  }
  return response.body ? JSON.parse(response.body) : null;
}

async function downloadImage(url: string) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "onecompany-girodisc-recovery-"));
  const bodyPath = path.join(temp, "body");
  const headerPath = path.join(temp, "headers");
  try {
    await execFileAsync(
      "curl.exe",
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
        "-A",
        "OneCompany catalog recovery/1.0",
        url,
      ],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
    );
    const headers = finalHeaders(await fs.readFile(headerPath, "utf8"));
    if (headers.status < 200 || headers.status >= 300) {
      throw new Error(`official image returned HTTP ${headers.status}`);
    }
    if (!headers.contentType.startsWith("image/")) {
      throw new Error(`official source returned ${headers.contentType || "unknown content-type"}`);
    }
    return { buffer: await fs.readFile(bodyPath), contentType: headers.contentType };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

async function uploadBlob(pathname: string, buffer: Buffer, contentType: string) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "onecompany-girodisc-blob-"));
  const bodyPath = path.join(temp, "body");
  try {
    await fs.writeFile(bodyPath, buffer);
    const result = await execFileAsync(
      "curl.exe",
      [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "120",
        "--request",
        "PUT",
        ...blobHeaders(),
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
    if (response.status === 409) {
      return `https://${BLOB_PUBLIC_HOST}/${pathname}`;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Blob upload returned HTTP ${response.status}`);
    }
    const body = JSON.parse(response.body) as { url?: string };
    if (!body.url) throw new Error("Blob upload did not return a URL");
    uploadedThisRun.add(body.url);
    return body.url;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

function officialImageFromPage(html: string) {
  const urls = [...html.matchAll(/https:\/\/cdn11\.bigcommerce\.com\/[^"\s]+/g)].map(
    (match) => match[0]
  );
  return urls.find((url) => url.includes("/images/stencil/1280x1280/products/")) ?? null;
}

async function discoverOfficialImage(product: ProductRow) {
  if (!product.sku) return { officialPage: null, officialImage: null };
  const searchUrl = `https://girodisc.com/search.php?search_query=${encodeURIComponent(product.sku)}`;
  const searchHtml = await curlText(searchUrl);
  const officialPage =
    searchHtml.match(
      /href="(https:\/\/girodisc\.com\/[^"?]+)\/?(?:\?[^\"]*)?"\s+class="card-figure__link"/
    )?.[1] ?? null;
  if (!officialPage) return { officialPage: null, officialImage: null };
  const pageHtml = await curlText(officialPage);
  if (!pageHtml.toLowerCase().includes(product.sku.toLowerCase())) {
    return { officialPage, officialImage: null };
  }
  return { officialPage, officialImage: officialImageFromPage(pageHtml) };
}

async function resolveOfficialImage(product: ProductRow) {
  const explicit = product.sku ? EXPLICIT_OFFICIAL_IMAGES[product.sku] : undefined;
  if (explicit) {
    const { stdout: meta } = await execFileAsync(
      "curl.exe",
      [
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "30",
        "-A",
        "OneCompany catalog recovery/1.0",
        "-o",
        "NUL",
        "-w",
        "%{http_code} %{content_type} %{size_download}",
        explicit.image,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    const probe = String(meta).trim();
    if (!/^200\s+image\//i.test(probe)) {
      throw new Error(`explicit source probe failed: ${probe}`);
    }
    return { officialPage: explicit.page, officialImage: explicit.image };
  }
  if (brand !== "GiroDisc") return { officialPage: null, officialImage: null };
  return discoverOfficialImage(product);
}

async function retryTransient<T>(action: () => Promise<T>) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (!(code === "P1017" || code === "P2024" || code === "P2034") || attempt === 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error("recovery retry loop exhausted");
}

async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>, count: number) {
  let cursor = 0;
  async function pump() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, pump));
}

async function main() {
  console.log("=== GiroDisc missing product media recovery ===");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY-RUN"}`);
  const products = await prisma.shopProduct.findMany({
    where: {
      brand,
      image: {
        startsWith: "http",
        not: { startsWith: "https://rfip333zgtfizdii.public.blob.vercel-storage.com/" },
      },
    },
    select: PRODUCT_SELECT,
    orderBy: { sku: "asc" },
  });
  const resolutions = new Map<string, RecoveryResolution>();
  await runWithConcurrency(products, async (product) => {
    const source = normalizeShopProductMediaSource(product.image);
    if (!source) return;
    try {
      const official = await resolveOfficialImage(product);
      if (!official.officialImage) {
        resolutions.set(source, {
          source,
          sku: product.sku ?? product.slug,
          officialPage: official.officialPage,
          officialImage: null,
          blobUrl: null,
          status: "failed",
          error: "No exact official SKU image was found",
        });
        return;
      }
      if (!commit) {
        resolutions.set(source, {
          source,
          sku: product.sku ?? product.slug,
          officialPage: official.officialPage,
          officialImage: official.officialImage,
          blobUrl: null,
          status: "pending",
        });
        return;
      }
      const downloaded = await downloadImage(official.officialImage);
      const pathname = buildShopProductMediaBlobPathname(source);
      const blobUrl = await uploadBlob(pathname, downloaded.buffer, downloaded.contentType);
      resolutions.set(source, {
        source,
        sku: product.sku ?? product.slug,
        officialPage: official.officialPage,
        officialImage: official.officialImage,
        blobUrl,
        status: uploadedThisRun.has(blobUrl) ? "uploaded" : "existing",
      });
    } catch (error) {
      resolutions.set(source, {
        source,
        sku: product.sku ?? product.slug,
        officialPage: null,
        officialImage: null,
        blobUrl: null,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, discoveryConcurrency);

  const resolved = new Map(
    [...resolutions.entries()]
      .filter(([, resolution]) => resolution.blobUrl)
      .map(([source, resolution]) => [source, resolution.blobUrl!] as const)
  );
  const failed = [...resolutions.values()].filter((resolution) => resolution.status === "failed");
  const pending = [...resolutions.values()].filter((resolution) => resolution.status === "pending");
  const successful = [...resolutions.values()].filter(
    (resolution) => resolution.status === "uploaded" || resolution.status === "existing"
  );
  console.log(
    JSON.stringify({
      products: products.length,
      uniqueSources: resolutions.size,
      successful: successful.length,
      pending: pending.length,
      failed: failed.length,
      failedDetails: failed,
    }, null, 2)
  );
  if (!commit) return;

  let rewrittenProducts = 0;
  let rewrittenMedia = 0;
  let rewrittenVariants = 0;
  let mutationFailures = 0;
  await runWithConcurrency(products, async (product) => {
    const source = normalizeShopProductMediaSource(product.image);
    const blobUrl = source ? resolved.get(source) : undefined;
    if (!blobUrl) return;
    const rewrittenGallery = rewriteShopProductMediaValue(product.gallery, resolved);
    const mediaUpdates = product.media
      .map((media) => {
        const current = normalizeShopProductMediaSource(media.src);
        return current === source ? { id: media.id, src: blobUrl } : null;
      })
      .filter((value): value is { id: string; src: string } => Boolean(value));
    const variantUpdates = product.variants
      .map((variant) => {
        const current = normalizeShopProductMediaSource(variant.image);
        return current === source ? { id: variant.id, image: blobUrl } : null;
      })
      .filter((value): value is { id: string; image: string } => Boolean(value));
    try {
      await retryTransient(() =>
        coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: product.id,
          expectedCatalogVersion: product.catalogVersion.toString(),
          changeDomains: ["MEDIA"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            await tx.shopProduct.update({
              where: { id: product.id },
              data: {
                image: blobUrl,
                ...(rewrittenGallery.replacements
                  ? { gallery: rewrittenGallery.value as Prisma.InputJsonValue }
                  : {}),
              },
            });
            for (const media of mediaUpdates) {
              await tx.shopProductMedia.updateMany({
                where: { id: media.id, productId: product.id },
                data: { src: media.src },
              });
            }
            for (const variant of variantUpdates) {
              await tx.shopProductVariant.updateMany({
                where: { id: variant.id, productId: product.id },
                data: { image: variant.image },
              });
            }
            return buildShopCatalogAdminSnapshot(tx, product.id, nextCatalogVersion, {
              type: "IMPORT",
              id: "shop-product-media-recovery@system.local",
              reason: `shop.product-media.recover-${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-official`,
            });
          },
        })
      );
      rewrittenProducts += 1;
      rewrittenMedia += mediaUpdates.length;
      rewrittenVariants += variantUpdates.length;
    } catch (error) {
      mutationFailures += 1;
      console.error(`Product mutation skipped for ${product.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, rewriteConcurrency);
  console.log(JSON.stringify({ rewrittenProducts, rewrittenMedia, rewrittenVariants, mutationFailures }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
