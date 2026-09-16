import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SHOP_REMOTE_IMAGE_HOSTS } from "@/lib/shopImageHosts";
import type { ProformaOrder } from "./orderProforma";
import { proformaImageSources, proformaImageUrl } from "./orderProformaImageSources";

const allowedHosts = new Set(SHOP_REMOTE_IMAGE_HOSTS);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export function trustedProformaImageUrl(src: string) {
  const normalized = proformaImageUrl(src);
  if (!normalized) return null;
  const url = new URL(normalized);
  return allowedHosts.has(url.hostname) ||
    /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)
    ? url
    : null;
}

async function readImageBytes(response: Response) {
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    reader.releaseLock();
  }
}

async function normalizeImageBytes(bytes: Buffer, maxDimension: number): Promise<Buffer | null> {
  try {
    // Decode the actual bytes: suppliers sometimes send a generic content-type.
    // React-PDF only accepts PNG/JPEG; normalize WebP/AVIF and resize for print.
    const input = sharp(bytes, { limitInputPixels: 40_000_000 });
    const metadata = await input.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"].includes(metadata.format)
    )
      return null;
    return await input
      .rotate()
      .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
      .png()
      .timeout({ seconds: 4 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function readLocalProductImage(src: string, maxDimension: number): Promise<Buffer | null> {
  try {
    const rawPath =
      src.startsWith("/") && !src.startsWith("//")
        ? src.split(/[?#]/, 1)[0] || ""
        : (() => {
            const url = new URL(src);
            return ["onecompany.global", "one-company.com.ua"].includes(url.hostname)
              ? url.pathname
              : "";
          })();
    const decodedPath = decodeURIComponent(rawPath);
    if (!decodedPath || decodedPath.includes("\\") || decodedPath.split("/").includes(".."))
      return null;
    const publicDir = path.resolve(process.cwd(), "public");
    const filePath = path.resolve(publicDir, decodedPath.replace(/^\/+/, ""));
    if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${path.sep}`)) return null;
    return await normalizeImageBytes(await readFile(filePath), maxDimension);
  } catch {
    return null;
  }
}

async function downloadProductImage(
  src: string,
  signal: AbortSignal,
  maxDimension: number
): Promise<Buffer | null> {
  try {
    let url = trustedProformaImageUrl(src);
    for (let redirects = 0; url && redirects <= 3; redirects++) {
      // Never forward admin cookies or follow an unchecked redirect to an arbitrary host.
      const response = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1",
          "User-Agent": "OneCompany-Catalog-PDF/1.0",
        },
      });
      if (REDIRECT_CODES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        url = location ? trustedProformaImageUrl(new URL(location, url).href) : null;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const bytes = await readImageBytes(response);
      if (!bytes?.length) return null;
      return await normalizeImageBytes(bytes, maxDimension);
    }
  } catch {
    // A broken primary photo must not prevent trying this product's other media.
  }
  return null;
}

export async function loadProformaImages(
  items: ProformaOrder["items"],
  options: { maxDimension?: number } = {}
) {
  const maxDimension = Math.min(1800, Math.max(240, options.maxDimension ?? 480));
  const cache = new Map<string, Promise<Buffer | null>>();
  const pictures: (Buffer | null)[] = [];
  for (let i = 0; i < items.length; i += 4) {
    pictures.push(
      ...(await Promise.all(
        items.slice(i, i + 4).map(async (item) => {
          const signal = AbortSignal.timeout(12_000);
          for (const src of proformaImageSources(item)) {
            if (signal.aborted) break;
            let pending = cache.get(src);
            if (!pending) {
              pending = (async () =>
                (await readLocalProductImage(src, maxDimension)) ??
                (await downloadProductImage(
                  src,
                  AbortSignal.any([signal, AbortSignal.timeout(5000)]),
                  maxDimension
                )))();
              cache.set(src, pending);
            }
            const picture = await pending;
            if (picture) return picture;
          }
          return null;
        })
      ))
    );
  }
  return pictures;
}
