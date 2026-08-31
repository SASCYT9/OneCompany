import "server-only";

import type { PrismaClient, ShopCatalogProjectionTarget } from "@prisma/client";

import { prisma } from "./prisma";

export type ShopCatalogAdminPublicationStatus = "SAVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

export type ShopCatalogPublicationStatus = {
  productId: string;
  version: string;
  status: ShopCatalogAdminPublicationStatus;
  tracked: boolean;
  outboxId: string | null;
  outboxStatus: string | null;
  attempts: number;
  requiredTargets: ShopCatalogProjectionTarget[];
  pendingTargets: ShopCatalogProjectionTarget[];
  failedTargets: ShopCatalogProjectionTarget[];
  maxVersionLag: string;
  lastError: string | null;
  savedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

function targetsFromPayload(payload: unknown): ShopCatalogProjectionTarget[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const targets = (payload as { projectionTargets?: unknown }).projectionTargets;
  if (!Array.isArray(targets)) return [];
  const allowed = new Set<ShopCatalogProjectionTarget>([
    "CONTENT",
    "SEARCH",
    "PRICE",
    "INVENTORY",
    "SETTINGS",
  ]);
  return [...new Set(targets.filter((value): value is ShopCatalogProjectionTarget =>
    typeof value === "string" && allowed.has(value as ShopCatalogProjectionTarget)
  ))];
}

export async function getShopCatalogPublicationStatusWithClient(
  client: PrismaClient,
  input: { productId: string; version?: string | null }
): Promise<ShopCatalogPublicationStatus | null> {
  const product = await client.shopProduct.findUnique({
    where: { id: input.productId },
    select: { id: true, catalogVersion: true },
  });
  if (!product) return null;

  let requestedVersion = product.catalogVersion;
  if (input.version != null) {
    if (!/^[0-9]+$/.test(input.version)) throw new TypeError("Invalid catalog version");
    requestedVersion = BigInt(input.version);
    if (requestedVersion > product.catalogVersion) throw new TypeError("Catalog version is ahead of product");
  }

  const outbox = await client.shopCatalogOutbox.findUnique({
    where: {
      entityType_entityId_canonicalVersion: {
        entityType: "PRODUCT",
        entityId: product.id,
        canonicalVersion: requestedVersion,
      },
    },
  });
  const now = new Date().toISOString();
  if (!outbox) {
    return {
      productId: product.id,
      version: requestedVersion.toString(),
      status: "SAVED",
      tracked: false,
      outboxId: null,
      outboxStatus: null,
      attempts: 0,
      requiredTargets: [],
      pendingTargets: [],
      failedTargets: [],
      maxVersionLag: requestedVersion.toString(),
      lastError: null,
      savedAt: null,
      publishedAt: null,
      updatedAt: now,
    };
  }

  const requiredTargets = targetsFromPayload(outbox.payload);
  const receipts = requiredTargets.length
    ? await client.shopCatalogPublicationReceipt.findMany({
        where: { entityType: "PRODUCT", entityId: product.id, target: { in: requiredTargets } },
      })
    : [];
  const receiptByTarget = new Map(receipts.map((receipt) => [receipt.target, receipt]));
  const pendingTargets = requiredTargets.filter(
    (target) => (receiptByTarget.get(target)?.appliedVersion ?? BigInt(0)) < requestedVersion
  );
  const failedTargets = requiredTargets.filter((target) => {
    const receipt = receiptByTarget.get(target);
    return receipt?.status === "FAILED" && receipt.failedVersion === requestedVersion;
  });
  const maxVersionLag = requiredTargets.reduce((max, target) => {
    const applied = receiptByTarget.get(target)?.appliedVersion ?? BigInt(0);
    const lag = requestedVersion > applied ? requestedVersion - applied : BigInt(0);
    return lag > max ? lag : max;
  }, BigInt(0));

  const published = requiredTargets.length > 0 && pendingTargets.length === 0;
  const failed = outbox.status === "DEAD_LETTER" || failedTargets.length > 0;
  const publishing =
    outbox.status === "PROCESSING" ||
    receipts.some((receipt) =>
      receipt.status === "PUBLISHING" && receipt.processingVersion === requestedVersion
    );
  const status: ShopCatalogAdminPublicationStatus = failed
    ? "FAILED"
    : published
      ? "PUBLISHED"
      : publishing
        ? "PUBLISHING"
        : "SAVED";
  const lastError =
    outbox.lastError ??
    failedTargets.map((target) => receiptByTarget.get(target)?.lastError).find(Boolean) ??
    null;

  return {
    productId: product.id,
    version: requestedVersion.toString(),
    status,
    tracked: true,
    outboxId: outbox.id,
    outboxStatus: outbox.status,
    attempts: outbox.attempts,
    requiredTargets,
    pendingTargets,
    failedTargets,
    maxVersionLag: maxVersionLag.toString(),
    lastError,
    savedAt: outbox.createdAt.toISOString(),
    publishedAt: status === "PUBLISHED" ? outbox.processedAt?.toISOString() ?? null : null,
    updatedAt: outbox.updatedAt.toISOString(),
  };
}

export function getShopCatalogPublicationStatus(input: { productId: string; version?: string | null }) {
  return getShopCatalogPublicationStatusWithClient(prisma, input);
}
