import { createHmac, timingSafeEqual } from "node:crypto";

export const SHOP_CATALOG_OWNERSHIP_FINGERPRINT = "54f4760626c096253476c9c3948a2ef439430f3cbcf08164e2a0e2f9ff38fbe9";
export const SHOP_CATALOG_RELEASE_MARKER_VERSION = 2 as const;
export type ShopCatalogReleaseEvidence = {
  version: 2; commitSha: string; generatedAt: string; expiresAt: string;
  ownershipFingerprint: string; sourceCoverageFingerprint: string; sourcesReady: number;
  projectionLag: number;
  shadow: { sampledRequests: number; mismatches: number; errorRate: number };
  performance: { scaleP95Ms: number; publicationP95Ms: number };
  rollout: { maxCanaryPercentage: number; fullSsrApproved: boolean };
};
export type ShopCatalogActivationDecision = { allowed: boolean; requested: boolean; reasons: string[]; evidence: ShopCatalogReleaseEvidence | null };
function decode(value: string) { return Buffer.from(value, "base64url"); }
function validSha(value: string) { return /^[a-f0-9]{40}$/i.test(value); }

export function evaluateShopCatalogReleaseActivation(input: { nodeEnv?: string; readerMode?: string; canaryPercentage?: number; deployedCommit?: string; marker?: string; secret?: string; now?: Date }): ShopCatalogActivationDecision {
  const mode = input.readerMode?.trim().toLowerCase() ?? "";
  const requested = ["ssr", "canary"].includes(mode);
  if (input.nodeEnv !== "production" || !requested) return { allowed: true, requested, reasons: [], evidence: null };
  const reasons: string[] = [], secret = input.secret ?? "", now = input.now ?? new Date();
  if (!validSha(input.deployedCommit ?? "")) reasons.push("deployed commit must be a full Git SHA");
  if (Buffer.byteLength(secret) < 32) reasons.push("release signing secret must contain at least 32 bytes");
  let evidence: ShopCatalogReleaseEvidence | null = null;
  const parts = input.marker?.split(".") ?? [];
  if (parts.length !== 2) reasons.push("signed release evidence marker is required");
  else if (Buffer.byteLength(secret) >= 32) {
    try {
      const payload = decode(parts[0]!), supplied = decode(parts[1]!);
      const expected = createHmac("sha256", secret).update(payload).digest();
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) reasons.push("release evidence signature is invalid");
      else evidence = JSON.parse(payload.toString("utf8")) as ShopCatalogReleaseEvidence;
    } catch { reasons.push("release evidence marker is malformed"); }
  }
  if (evidence) {
    if (evidence.version !== SHOP_CATALOG_RELEASE_MARKER_VERSION) reasons.push("release evidence version is unsupported");
    if (evidence.commitSha !== input.deployedCommit) reasons.push("release evidence does not match deployed commit");
    if (evidence.ownershipFingerprint !== SHOP_CATALOG_OWNERSHIP_FINGERPRINT) reasons.push("source ownership fingerprint is stale");
    if (!/^[a-f0-9]{64}$/i.test(evidence.sourceCoverageFingerprint)) reasons.push("source coverage fingerprint is invalid");
    const generated = Date.parse(evidence.generatedAt), expires = Date.parse(evidence.expiresAt);
    if (!Number.isFinite(generated) || !Number.isFinite(expires) || generated > now.getTime() || expires <= now.getTime() || expires - generated > 86_400_000) reasons.push("release evidence is stale or has an invalid lifetime");
    if (evidence.sourcesReady !== 14) reasons.push("all 14 logical sources must be activation-ready");
    if (evidence.projectionLag !== 0) reasons.push("projection version lag must be zero");
    if (evidence.shadow.sampledRequests < 1000) reasons.push("shadow parity sample is too small");
    if (evidence.shadow.mismatches !== 0) reasons.push("shadow parity mismatches must be zero");
    if (!Number.isFinite(evidence.shadow.errorRate) || evidence.shadow.errorRate < 0 || evidence.shadow.errorRate > 0.001) reasons.push("shadow error rate exceeds 0.1%");
    if (!Number.isFinite(evidence.performance.scaleP95Ms) || evidence.performance.scaleP95Ms > 200) reasons.push("catalog scale p95 exceeds 200 ms");
    if (!Number.isFinite(evidence.performance.publicationP95Ms) || evidence.performance.publicationP95Ms > 2000) reasons.push("commit-to-visible p95 exceeds 2000 ms");
    const maxCanary = evidence.rollout?.maxCanaryPercentage;
    if (!Number.isInteger(maxCanary) || maxCanary < 1 || maxCanary > 100 || typeof evidence.rollout?.fullSsrApproved !== "boolean") reasons.push("rollout authorization is invalid");
    if (mode === "canary") {
      const percentage = input.canaryPercentage;
      if (!Number.isInteger(percentage) || percentage! < 0 || percentage! > 100) reasons.push("production canary percentage must be an integer from 0 to 100");
      else if (Number.isInteger(maxCanary) && percentage! > maxCanary) reasons.push(`production canary percentage ${percentage} exceeds signed maximum ${maxCanary}`);
    }
    if (mode === "ssr" && evidence.rollout?.fullSsrApproved !== true) reasons.push("full SSR rollout is not approved by signed evidence");
  }
  return { allowed: reasons.length === 0, requested, reasons, evidence };
}

export function assertShopCatalogReleaseActivation(input: Parameters<typeof evaluateShopCatalogReleaseActivation>[0]) {
  const decision = evaluateShopCatalogReleaseActivation(input);
  if (!decision.allowed) throw new Error(`Catalog V2 production activation blocked: ${decision.reasons.join("; ")}`);
  return decision;
}

export function createShopCatalogReleaseMarker(input: { evidence: ShopCatalogReleaseEvidence; secret: string; now?: Date }) {
  const payload = Buffer.from(JSON.stringify(input.evidence));
  const marker = `${payload.toString("base64url")}.${createHmac("sha256", input.secret).update(payload).digest("base64url")}`;
  const decision = evaluateShopCatalogReleaseActivation({
    nodeEnv: "production", readerMode: input.evidence.rollout.fullSsrApproved ? "ssr" : "canary",
    canaryPercentage: input.evidence.rollout.maxCanaryPercentage, deployedCommit: input.evidence.commitSha,
    marker, secret: input.secret, now: input.now,
  });
  if (!decision.allowed) throw new TypeError(`Cannot sign invalid Catalog V2 evidence: ${decision.reasons.join("; ")}`);
  return marker;
}
