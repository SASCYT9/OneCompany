import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { OpsAttachmentState, Prisma, type PrismaClient } from "@prisma/client";
import type { OpsTelegramMediaDescriptor } from "@/lib/operations/telegram";

export const OPS_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const OPS_AUDIO_MAX_SECONDS = 600;
export const OPS_ATTACHMENT_RETENTION_DAYS = 180;
export const OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES = BigInt(2 * 1024 * 1024 * 1024);
export const OPS_MEDIA_RETAINED_SOFT_CAP_BYTES = BigInt(10 * 1024 * 1024 * 1024);
const OPS_MEDIA_UPLOAD_FEATURE = "media_upload";
const OPS_MEDIA_RETAINED_FEATURE = "media_retained";
const OPS_MEDIA_RETAINED_BUCKET_MONTH = new Date("1970-01-01T00:00:00.000Z");

const ALLOWED_MIME_TYPES = new Set([
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "text/plain",
]);

const REJECTED_FILE_EXTENSIONS = new Set([
  "7z",
  "app",
  "bat",
  "cmd",
  "com",
  "dll",
  "dmg",
  "exe",
  "gz",
  "iso",
  "jar",
  "js",
  "lnk",
  "msi",
  "ps1",
  "rar",
  "scr",
  "sh",
  "tar",
  "vbs",
  "xlsm",
  "xltm",
  "docm",
  "dotm",
  "pptm",
  "potm",
  "zip",
]);

export class OpsMediaError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OpsMediaError";
  }
}

export type ValidatedOpsMedia = OpsTelegramMediaDescriptor & {
  mimeType: string;
  safeFileName: string;
};

export type OpsPrivateMediaStore = {
  put(input: {
    storageKey: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<{ storageKey: string }>;
  get(storageKey: string): Promise<Uint8Array>;
  remove(storageKey: string): Promise<void>;
};

function extension(fileName: string | null) {
  return String(fileName ?? "")
    .trim()
    .toLocaleLowerCase("en-US")
    .split(".")
    .pop();
}

function sanitizeFileName(fileName: string | null, kind: string, mimeType: string) {
  const fallbackExtension =
    mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "text/plain"
        ? "txt"
        : mimeType.startsWith("image/")
          ? mimeType.slice("image/".length).replace("jpeg", "jpg")
          : mimeType.startsWith("video/")
            ? "mp4"
            : mimeType.includes("ogg")
              ? "ogg"
              : "bin";
  const sanitized = String(fileName ?? "")
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}._ -]+/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return sanitized || `${kind}.${fallbackExtension}`;
}

export function validateOpsTelegramMedia(media: OpsTelegramMediaDescriptor): ValidatedOpsMedia {
  if (
    media.fileSize !== null &&
    (media.fileSize <= 0 || media.fileSize > OPS_ATTACHMENT_MAX_BYTES)
  ) {
    throw new OpsMediaError(
      "ATTACHMENT_SIZE_LIMIT",
      `Attachment must be at most ${OPS_ATTACHMENT_MAX_BYTES} bytes`
    );
  }
  if (
    media.durationSeconds !== null &&
    (media.durationSeconds <= 0 || media.durationSeconds > OPS_AUDIO_MAX_SECONDS)
  ) {
    throw new OpsMediaError(
      "AUDIO_DURATION_LIMIT",
      `Audio must be at most ${OPS_AUDIO_MAX_SECONDS} seconds`
    );
  }

  const fileExtension = extension(media.fileName);
  if (fileExtension && REJECTED_FILE_EXTENSIONS.has(fileExtension)) {
    throw new OpsMediaError(
      "ATTACHMENT_TYPE_REJECTED",
      "Executable, archive, and macro-enabled files are not accepted"
    );
  }

  const mimeType = String(media.mimeType ?? "")
    .trim()
    .toLocaleLowerCase("en-US");
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new OpsMediaError(
      "ATTACHMENT_MIME_REJECTED",
      "This attachment MIME type is not accepted"
    );
  }
  return {
    ...media,
    mimeType,
    safeFileName: sanitizeFileName(media.fileName, media.kind, mimeType),
  };
}

export function assertOpsMediaBytes(body: Uint8Array) {
  if (body.byteLength <= 0 || body.byteLength > OPS_ATTACHMENT_MAX_BYTES) {
    throw new OpsMediaError(
      "ATTACHMENT_SIZE_LIMIT",
      `Downloaded attachment must be at most ${OPS_ATTACHMENT_MAX_BYTES} bytes`
    );
  }
}

function startsWithBytes(body: Uint8Array, expected: readonly number[], offset = 0) {
  return expected.every((value, index) => body[offset + index] === value);
}

function asciiAt(body: Uint8Array, value: string, offset = 0) {
  return startsWithBytes(
    body,
    Array.from(value).map((character) => character.charCodeAt(0)),
    offset
  );
}

export function assertOpsMediaMagicBytes(body: Uint8Array, mimeType: string) {
  assertOpsMediaBytes(body);
  const mime = mimeType.toLocaleLowerCase("en-US");
  let valid = false;
  if (mime === "image/jpeg") {
    valid = startsWithBytes(body, [0xff, 0xd8, 0xff]);
  } else if (mime === "image/png") {
    valid = startsWithBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } else if (mime === "image/webp") {
    valid = asciiAt(body, "RIFF") && asciiAt(body, "WEBP", 8);
  } else if (mime === "application/pdf") {
    valid = asciiAt(body, "%PDF-");
  } else if (mime === "text/plain") {
    valid = !body.includes(0);
  } else if (mime === "audio/ogg" || mime === "audio/opus") {
    valid = asciiAt(body, "OggS");
  } else if (mime === "audio/flac") {
    valid = asciiAt(body, "fLaC");
  } else if (mime === "audio/wav") {
    valid = asciiAt(body, "RIFF") && asciiAt(body, "WAVE", 8);
  } else if (mime === "audio/mpeg" || mime === "audio/mp3") {
    valid = asciiAt(body, "ID3") || (body[0] === 0xff && (body[1] & 0xe0) === 0xe0);
  } else if (mime === "audio/aac") {
    valid = body[0] === 0xff && (body[1] & 0xf6) === 0xf0;
  } else if (mime === "audio/mp4" || mime === "audio/m4a" || mime === "video/mp4") {
    valid = asciiAt(body, "ftyp", 4);
  } else if (mime === "audio/webm") {
    valid = startsWithBytes(body, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  if (!valid) {
    throw new OpsMediaError(
      "ATTACHMENT_SIGNATURE_MISMATCH",
      "Attachment bytes do not match the declared MIME type"
    );
  }
}

export async function assertOpsMediaStorageBudget(input: {
  client: PrismaClient;
  incomingBytes: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [monthly, retained] = await Promise.all([
    input.client.opsAttachment.aggregate({
      where: {
        createdAt: { gte: month },
        state: { not: OpsAttachmentState.REJECTED },
      },
      _sum: { sizeBytes: true },
    }),
    input.client.opsAttachment.aggregate({
      where: {
        state: {
          in: [
            OpsAttachmentState.PENDING,
            OpsAttachmentState.READY,
            OpsAttachmentState.QUARANTINED,
          ],
        },
      },
      _sum: { sizeBytes: true },
    }),
  ]);
  const incoming = BigInt(Math.max(0, input.incomingBytes));
  if ((monthly._sum.sizeBytes ?? BigInt(0)) + incoming > OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES) {
    throw new OpsMediaError(
      "MEDIA_MONTHLY_UPLOAD_CAP",
      "The monthly operations upload cap has been reached"
    );
  }
  if ((retained._sum.sizeBytes ?? BigInt(0)) + incoming > OPS_MEDIA_RETAINED_SOFT_CAP_BYTES) {
    throw new OpsMediaError(
      "MEDIA_RETAINED_SOFT_CAP",
      "The retained operations media soft cap has been reached"
    );
  }
}

export type OpsMediaStorageReservation = {
  key: string;
  month: Date;
  bytes: bigint;
};

function mediaMonth(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function mediaReservationHash(month: Date, bytes: bigint) {
  return crypto
    .createHash("sha256")
    .update(month.toISOString())
    .update("\0")
    .update(bytes.toString())
    .digest("hex");
}

export async function reserveOpsMediaStorageBudget(input: {
  client: PrismaClient;
  reservationKey: string;
  incomingBytes: number;
  now?: Date;
}): Promise<OpsMediaStorageReservation> {
  const bytes = BigInt(Math.max(0, input.incomingBytes));
  if (bytes <= BigInt(0)) {
    throw new OpsMediaError("ATTACHMENT_SIZE_LIMIT", "Attachment must not be empty");
  }
  const month = mediaMonth(input.now);
  const key = input.reservationKey.trim().slice(0, 200);
  if (key.length < 8) {
    throw new OpsMediaError("MEDIA_RESERVATION_INVALID", "Media reservation key is invalid");
  }
  const requestHash = mediaReservationHash(month, bytes);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await input.client.$transaction(
        async (tx) => {
          const existing = await tx.opsIdempotencyRecord.findUnique({
            where: {
              scope_key: {
                scope: "ops.media.storage-reservation",
                key,
              },
            },
          });
          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new OpsMediaError(
                "MEDIA_RESERVATION_CONFLICT",
                "Media reservation key was already used for another file size"
              );
            }
            return { key, month, bytes };
          }

          const monthly = await tx.opsUsageBucket.upsert({
            where: {
              month_feature: {
                month,
                feature: OPS_MEDIA_UPLOAD_FEATURE,
              },
            },
            create: { month, feature: OPS_MEDIA_UPLOAD_FEATURE },
            update: {},
            select: { id: true, storageBytes: true },
          });
          const retained = await tx.opsUsageBucket.upsert({
            where: {
              month_feature: {
                month: OPS_MEDIA_RETAINED_BUCKET_MONTH,
                feature: OPS_MEDIA_RETAINED_FEATURE,
              },
            },
            create: {
              month: OPS_MEDIA_RETAINED_BUCKET_MONTH,
              feature: OPS_MEDIA_RETAINED_FEATURE,
            },
            update: {},
            select: { id: true, storageBytes: true },
          });

          if (monthly.storageBytes + bytes > OPS_MEDIA_MONTHLY_UPLOAD_CAP_BYTES) {
            throw new OpsMediaError(
              "MEDIA_MONTHLY_UPLOAD_CAP",
              "The monthly operations upload cap has been reached"
            );
          }
          if (retained.storageBytes + bytes > OPS_MEDIA_RETAINED_SOFT_CAP_BYTES) {
            throw new OpsMediaError(
              "MEDIA_RETAINED_SOFT_CAP",
              "The retained operations media soft cap has been reached"
            );
          }

          await tx.opsUsageBucket.update({
            where: { id: monthly.id },
            data: { storageBytes: { increment: bytes } },
          });
          await tx.opsUsageBucket.update({
            where: { id: retained.id },
            data: { storageBytes: { increment: bytes } },
          });
          await tx.opsIdempotencyRecord.create({
            data: {
              scope: "ops.media.storage-reservation",
              key,
              requestHash,
              responseBody: {
                month: month.toISOString(),
                bytes: bytes.toString(),
              },
              statusCode: 201,
              resourceType: "ops.media.reservation",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          return { key, month, bytes };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if ((error as { code?: string }).code === "P2034" && attempt < 3) {
        continue;
      }
      throw error;
    }
  }
  throw new OpsMediaError("MEDIA_RESERVATION_FAILED", "Could not reserve media storage");
}

export async function releaseOpsMediaStorageReservation(input: {
  client: PrismaClient;
  reservation: OpsMediaStorageReservation;
}) {
  await input.client.$transaction(
    async (tx) => {
      const existing = await tx.opsIdempotencyRecord.findUnique({
        where: {
          scope_key: {
            scope: "ops.media.storage-reservation",
            key: input.reservation.key,
          },
        },
        select: { id: true },
      });
      if (!existing) return;
      const buckets = [
        {
          month: input.reservation.month,
          feature: OPS_MEDIA_UPLOAD_FEATURE,
        },
        {
          month: OPS_MEDIA_RETAINED_BUCKET_MONTH,
          feature: OPS_MEDIA_RETAINED_FEATURE,
        },
      ];
      for (const bucket of buckets) {
        await tx.opsUsageBucket.updateMany({
          where: {
            month: bucket.month,
            feature: bucket.feature,
            storageBytes: { gte: input.reservation.bytes },
          },
          data: { storageBytes: { decrement: input.reservation.bytes } },
        });
      }
      await tx.opsIdempotencyRecord.delete({ where: { id: existing.id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function releaseOpsRetainedStorageBytes(input: {
  client: PrismaClient;
  bytes: bigint;
}) {
  if (input.bytes <= BigInt(0)) return;
  await input.client.opsUsageBucket.updateMany({
    where: {
      month: OPS_MEDIA_RETAINED_BUCKET_MONTH,
      feature: OPS_MEDIA_RETAINED_FEATURE,
      storageBytes: { gte: input.bytes },
    },
    data: { storageBytes: { decrement: input.bytes } },
  });
}

export function checksumOpsMedia(body: Uint8Array) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export function createOpsMediaStorageKey(input: {
  namespace?: string;
  telegramFileUniqueId: string | null;
  checksum: string;
  fileName: string;
}) {
  const namespace = String(input.namespace ?? "shared")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 100);
  const identity = String(input.telegramFileUniqueId ?? input.checksum)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .slice(0, 100);
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
  return `operations/telegram/${namespace}/${identity}/${input.checksum.slice(0, 16)}-${safeFileName}`;
}

export function opsAttachmentRetentionAt(now = new Date()) {
  return new Date(now.getTime() + OPS_ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function createVercelPrivateOpsMediaStore(
  token = process.env.OPS_BLOB_READ_WRITE_TOKEN,
  storeId = process.env.OPS_BLOB_STORE_ID
): OpsPrivateMediaStore {
  const normalizedToken = String(token ?? "").trim();
  const normalizedStoreId = String(storeId ?? "").trim();
  if (!normalizedToken && !normalizedStoreId) {
    throw new OpsMediaError(
      "PRIVATE_BLOB_NOT_CONFIGURED",
      "OPS_BLOB_READ_WRITE_TOKEN or OPS_BLOB_STORE_ID is required"
    );
  }
  const auth = normalizedToken ? { token: normalizedToken } : { storeId: normalizedStoreId };
  return {
    async put(input) {
      const { put } = await import("@vercel/blob");
      const result = await put(input.storageKey, Buffer.from(input.body), {
        access: "private",
        addRandomSuffix: false,
        contentType: input.contentType,
        ...auth,
      });
      return { storageKey: result.pathname };
    },
    async get(storageKey) {
      const { get } = await import("@vercel/blob");
      const result = await get(storageKey, {
        access: "private",
        ...auth,
        useCache: false,
      });
      if (!result) {
        throw new OpsMediaError("ATTACHMENT_NOT_FOUND", "Private attachment was not found");
      }
      const body = new Uint8Array(await new Response(result.stream).arrayBuffer());
      assertOpsMediaBytes(body);
      return body;
    },
    async remove(storageKey) {
      const { del } = await import("@vercel/blob");
      await del(storageKey, auth);
    },
  };
}

function localOpsMediaPath(rootDir: string, storageKey: string) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, storageKey.replaceAll("\\", "/"));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new OpsMediaError("ATTACHMENT_STORAGE_KEY_INVALID", "Invalid local attachment key");
  }
  return { root, target };
}

export function createLocalPrivateOpsMediaStore(rootDir: string): OpsPrivateMediaStore {
  const normalizedRoot = String(rootDir ?? "").trim();
  if (!normalizedRoot) {
    throw new OpsMediaError("PRIVATE_BLOB_NOT_CONFIGURED", "OPS_LOCAL_MEDIA_DIR is required");
  }
  if (process.env.NODE_ENV === "production") {
    throw new OpsMediaError(
      "LOCAL_MEDIA_FORBIDDEN",
      "Local attachment storage cannot be used in production"
    );
  }
  return {
    async put(input) {
      const { root, target } = localOpsMediaPath(normalizedRoot, input.storageKey);
      await fs.mkdir(root, { recursive: true });
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, input.body, { mode: 0o600 });
      return { storageKey: input.storageKey };
    },
    async get(storageKey) {
      const { target } = localOpsMediaPath(normalizedRoot, storageKey);
      const body = new Uint8Array(await fs.readFile(target));
      assertOpsMediaBytes(body);
      return body;
    },
    async remove(storageKey) {
      const { target } = localOpsMediaPath(normalizedRoot, storageKey);
      await fs.rm(target, { force: true });
    },
  };
}

export function isLocalOpsMediaStoreConfigured() {
  return getOpsMediaConfiguration().provider === "local";
}

export type OpsMediaConfiguration = {
  provider: "local" | "vercel_blob" | "missing" | "invalid";
  configured: boolean;
  productionReady: boolean;
};

/**
 * Returns a safe, secret-free description of the selected attachment store.
 * Local storage deliberately wins in development so Lab media never reaches a
 * remote store by accident. It is rejected in production.
 */
export function getOpsMediaConfiguration(
  env: Partial<
    Pick<
      NodeJS.ProcessEnv,
      "NODE_ENV" | "OPS_LOCAL_MEDIA_DIR" | "OPS_BLOB_READ_WRITE_TOKEN" | "OPS_BLOB_STORE_ID"
    >
  > = process.env
): OpsMediaConfiguration {
  const localConfigured = Boolean(env.OPS_LOCAL_MEDIA_DIR?.trim());
  const blobConfigured = Boolean(
    env.OPS_BLOB_READ_WRITE_TOKEN?.trim() || env.OPS_BLOB_STORE_ID?.trim()
  );

  if (localConfigured) {
    if (env.NODE_ENV === "production") {
      return {
        provider: "invalid",
        configured: false,
        productionReady: false,
      };
    }
    return {
      provider: "local",
      configured: true,
      productionReady: false,
    };
  }
  if (blobConfigured) {
    return {
      provider: "vercel_blob",
      configured: true,
      productionReady: true,
    };
  }
  return {
    provider: "missing",
    configured: false,
    productionReady: false,
  };
}

export function getOpsBlobAuthOptions() {
  const token = process.env.OPS_BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token } as const;
  const storeId = process.env.OPS_BLOB_STORE_ID?.trim();
  if (storeId) return { storeId } as const;
  throw new OpsMediaError(
    "PRIVATE_BLOB_NOT_CONFIGURED",
    "OPS_BLOB_READ_WRITE_TOKEN or OPS_BLOB_STORE_ID is required"
  );
}

export function createConfiguredOpsMediaStore(): OpsPrivateMediaStore {
  const configuration = getOpsMediaConfiguration();
  if (configuration.provider === "local") {
    return createLocalPrivateOpsMediaStore(process.env.OPS_LOCAL_MEDIA_DIR!);
  }
  if (configuration.provider === "invalid") {
    throw new OpsMediaError(
      "LOCAL_MEDIA_FORBIDDEN",
      "Local attachment storage cannot be used in production"
    );
  }
  return createVercelPrivateOpsMediaStore();
}

export async function downloadOpsTelegramFile(input: {
  token?: string | null;
  fileId: string;
  fetchImpl?: typeof fetch;
}) {
  const token = String(input.token ?? process.env.OPS_TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    throw new OpsMediaError("TELEGRAM_TOKEN_NOT_CONFIGURED", "OPS_TELEGRAM_BOT_TOKEN is required");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const metadataResponse = await fetchImpl(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(input.fileId)}`,
    { signal: AbortSignal.timeout(8_000), cache: "no-store" }
  );
  if (!metadataResponse.ok) {
    throw new OpsMediaError(
      "TELEGRAM_GET_FILE_FAILED",
      `Telegram getFile returned ${metadataResponse.status}`
    );
  }
  const metadata = (await metadataResponse.json()) as {
    ok?: boolean;
    result?: { file_path?: string; file_size?: number };
  };
  const filePath = String(metadata.result?.file_path ?? "").trim();
  if (!metadata.ok || !filePath || filePath.includes("..")) {
    throw new OpsMediaError("TELEGRAM_FILE_INVALID", "Telegram returned an invalid file path");
  }
  if (metadata.result?.file_size && metadata.result.file_size > OPS_ATTACHMENT_MAX_BYTES) {
    throw new OpsMediaError(
      "ATTACHMENT_SIZE_LIMIT",
      "Telegram file exceeds the 20 MB application cap"
    );
  }

  const fileResponse = await fetchImpl(
    `https://api.telegram.org/file/bot${token}/${filePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    { signal: AbortSignal.timeout(30_000), cache: "no-store" }
  );
  if (!fileResponse.ok) {
    throw new OpsMediaError(
      "TELEGRAM_DOWNLOAD_FAILED",
      `Telegram file download returned ${fileResponse.status}`
    );
  }
  const declaredLength = Number(fileResponse.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > OPS_ATTACHMENT_MAX_BYTES) {
    throw new OpsMediaError(
      "ATTACHMENT_SIZE_LIMIT",
      "Telegram file exceeds the 20 MB application cap"
    );
  }
  const body = new Uint8Array(await fileResponse.arrayBuffer());
  assertOpsMediaBytes(body);
  return body;
}
