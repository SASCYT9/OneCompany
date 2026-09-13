import sharp from "sharp";
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

async function downloadProductImage(src: string, signal: AbortSignal): Promise<Buffer | null> {
  try {
    let url = trustedProformaImageUrl(src);
    for (let redirects = 0; url && redirects <= 3; redirects++) {
      // Never forward admin cookies or follow an unchecked redirect to an arbitrary host.
      const response = await fetch(url, { redirect: "manual", signal });
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
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .png()
        .timeout({ seconds: 4 })
        .toBuffer();
    }
  } catch {
    // A broken primary photo must not prevent trying this product's other media.
  }
  return null;
}

export async function loadProformaImages(items: ProformaOrder["items"]) {
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
              pending = downloadProductImage(
                src,
                AbortSignal.any([signal, AbortSignal.timeout(5000)])
              );
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
