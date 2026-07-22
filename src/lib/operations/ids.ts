import crypto from "node:crypto";

export function createOpsExternalId(prefix: "PRJ" | "ONE") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function createOpsSlug(title: string) {
  const normalized = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `article-${crypto.randomBytes(4).toString("hex")}`;
}
