import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, constants } from "node:zlib";
import { canonicalizeCatalogBaselineValue, hashCatalogBaselineValue } from "./shopCatalogBaseline";

const ENCODING = "onecompany-canonical-brotli-json-v1";
const LEGACY_GZIP_ENCODING = "onecompany-canonical-gzip-json-v1";
const COMPRESS_THRESHOLD = 1024 * 1024;
const MAX_CANONICAL_BYTES = 512 * 1024 * 1024;
type CompressedCanonical = {
  $encoding: typeof ENCODING | typeof LEGACY_GZIP_ENCODING;
  contentHash: string;
  compressedHash: string;
  uncompressedBytes: number;
  data: string;
};
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

/** Same canonical hash and every original value; only large payload transport changes. */
export function encodeShopCatalogRevisionCanonical(value: unknown) {
  const canonical = canonicalizeCatalogBaselineValue(value);
  const json = JSON.stringify(canonical);
  const contentHash = sha256(json);
  const bytes = Buffer.byteLength(json);
  if (bytes < COMPRESS_THRESHOLD) return { canonical, contentHash };
  if (bytes > MAX_CANONICAL_BYTES) throw new Error("Canonical snapshot exceeds supported size");
  const compressed = brotliCompressSync(json, { params: {
    [constants.BROTLI_PARAM_QUALITY]: 6, [constants.BROTLI_PARAM_LGWIN]: 24,
  } });
  if (compressed.length * 4 / 3 + 256 >= bytes) return { canonical, contentHash };
  return { contentHash, canonical: { $encoding: ENCODING, contentHash,
    compressedHash: sha256(compressed), uncompressedBytes: bytes,
    data: compressed.toString("base64") } satisfies CompressedCanonical };
}

/** Publication can check integrity without inflating the complete archival payload. */
export function validateShopCatalogRevisionCanonical(value: unknown, expectedHash: string) {
  if (!value || typeof value !== "object" || !("$encoding" in value)) return;
  const encoded = value as CompressedCanonical;
  if (![ENCODING, LEGACY_GZIP_ENCODING].includes(encoded.$encoding) || encoded.contentHash !== expectedHash ||
    !Number.isSafeInteger(encoded.uncompressedBytes) || encoded.uncompressedBytes < 1 ||
    encoded.uncompressedBytes > MAX_CANONICAL_BYTES || typeof encoded.data !== "string" ||
    encoded.data.length > MAX_CANONICAL_BYTES * 2 || typeof encoded.compressedHash !== "string")
    throw new Error("Invalid compressed canonical snapshot envelope");
  const data = Buffer.from(encoded.data, "base64");
  if (data.toString("base64") !== encoded.data || sha256(data) !== encoded.compressedHash)
    throw new Error("Compressed canonical snapshot checksum mismatch");
}

/** Restore/audit reader supports both legacy raw JSON and lossless compressed JSON. */
export function decodeShopCatalogRevisionCanonical(value: unknown, expectedHash?: string): unknown {
  if (!value || typeof value !== "object" || !("$encoding" in value)) {
    if (expectedHash && hashCatalogBaselineValue(value) !== expectedHash) throw new Error("Canonical snapshot hash mismatch");
    return value;
  }
  const encoded = value as CompressedCanonical;
  validateShopCatalogRevisionCanonical(encoded, expectedHash ?? encoded.contentHash);
  const decompress = encoded.$encoding === LEGACY_GZIP_ENCODING ? gunzipSync : brotliDecompressSync;
  const raw = decompress(Buffer.from(encoded.data, "base64"), { maxOutputLength: encoded.uncompressedBytes });
  if (raw.length !== encoded.uncompressedBytes || sha256(raw) !== encoded.contentHash)
    throw new Error("Canonical snapshot hash or size mismatch");
  return JSON.parse(raw.toString("utf8"));
}
