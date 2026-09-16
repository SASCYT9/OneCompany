import { createHash, randomBytes } from "node:crypto";

import type { CatalogPresentationShare } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CatalogBrochureSnapshot } from "./catalogBrochureSnapshot";

export function createCatalogShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCatalogShareToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function validCatalogShareToken(token: string) {
  return /^[A-Za-z0-9_-]{40,60}$/.test(token);
}

export function catalogShareSnapshot(share: CatalogPresentationShare) {
  return share.snapshot as unknown as CatalogBrochureSnapshot;
}

export async function findCatalogPresentationShare(token: string, trackView = false) {
  if (!validCatalogShareToken(token)) return null;
  const now = new Date();
  const share = await prisma.catalogPresentationShare.findFirst({
    where: {
      tokenHash: hashCatalogShareToken(token),
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
  });
  if (!share || !trackView) return share;
  return prisma.catalogPresentationShare.update({
    where: { id: share.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: now },
  });
}
