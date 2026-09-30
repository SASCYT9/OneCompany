import { estimateRevozportShippingWeightKg, type RevozportSource } from "./revozport-enrichment";

const LB_TO_KG = 0.45359237;
export const REVOZPORT_DELIVERY_RESERVE = 1.1;
const round = (value: number) => Math.round(value * 1000) / 1000;

function family(sku: string) { return sku.replace(/-\d{2}$/, ""); }

export function revozportDeliveryPartClass(source: RevozportSource) {
  const text = `${source.productType ?? ""} ${source.titleEn}`.toLowerCase();
  const officialPath = source.source.officialUrl.replace(/[-_]/g, " ").toLowerCase();
  // Specific lightweight trims must be resolved before complete panels.
  if (/canard/.test(text)) return "canard";
  if (/hood.*(?:fin|vent|trim)/.test(text)) return "vent";
  if (/mirror/.test(text)) return "mirror";
  if (/rear wing|\bwing\b/.test(text) || /rear wing/.test(officialPath)) return "wing";
  if (/spoiler|spolier/.test(text)) {
    if ((source.source.productWeightLbs ?? 0) * LB_TO_KG >= 2.5) return "wing";
    return /roof/.test(text) || /roof spoiler/.test(officialPath) ? "roof_spoiler" : "trunk_spoiler";
  }
  if (/hood/.test(text)) return "hood";
  if (/trunk/.test(text)) return "trunk";
  if (/side skirt/.test(text)) return "side_skirts";
  if (/wheel arch|fender arch/.test(text)) return "fender_arches";
  if (/fender.*(?:vent|fin|trim)/.test(text)) return "vent";
  if (/fender liner/.test(text)) return "fender_liner";
  if (/fender/.test(text)) return "fender";
  if (/diffuser/.test(text)) return "diffuser";
  if (/front lip|front splitter|splitter/.test(text)) return "front_lip";
  if (/grill|grille/.test(text)) return "grille";
  if (/vent/.test(text)) return "vent";
  if (/air intake/.test(text)) return "air_intake";
  if (/undertray/.test(text)) return "undertray";
  if (/bumper/.test(text)) return "bumper";
  return "other";
}

function packageDimensions(source: RevozportSource) {
  const values = [source.length, source.width, source.height];
  if (!values.every((value) => typeof value === "number" && value > 0 && value <= 400)) return null;
  return (values as number[]).sort((a, b) => b - a);
}

export function estimateRevozportDeliveryPricingWeight(source: RevozportSource, references: readonly RevozportSource[]) {
  const partClass = revozportDeliveryPartClass(source);
  const dims = packageDimensions(source);
  const productWeightKg = (source.source.productWeightLbs ?? 0) * LB_TO_KG;
  const candidates = references.filter((candidate) =>
    family(candidate.sku) !== family(source.sku) &&
    (candidate.source.shippingWeightLbs ?? 0) > 0 &&
    revozportDeliveryPartClass(candidate) === partClass
  ).map((candidate) => {
    const referenceDims = packageDimensions(candidate);
    const referenceProductKg = (candidate.source.productWeightLbs ?? 0) * LB_TO_KG;
    const sizeDistance = dims && referenceDims
      ? dims.reduce((sum, value, index) => sum + Math.abs(Math.log(value / referenceDims[index])), 0)
      : 2;
    const productDistance = productWeightKg > 0 && referenceProductKg > 0
      ? Math.abs(Math.log(productWeightKg / referenceProductKg)) * 0.25 : 0;
    return { sku: candidate.sku, shippingWeightKg: candidate.source.shippingWeightLbs! * LB_TO_KG, distance: sizeDistance + productDistance, hasPackageDimensions: Boolean(referenceDims) };
  }).sort((a, b) => a.distance - b.distance || a.sku.localeCompare(b.sku));

  if (!candidates.length || !["roof_spoiler", "trunk_spoiler"].includes(partClass)) {
    const fallback = estimateRevozportShippingWeightKg({ ...source, productType: partClass === "wing" ? "Rear Wing" : source.productType, length: dims ? source.length : null, width: dims ? source.width : null, height: dims ? source.height : null });
    return { baseWeightKg: round(fallback.weightKg / REVOZPORT_DELIVERY_RESERVE), weightKg: fallback.weightKg, source: `approved_type_fallback:${partClass}`, confidence: "low" as const, analogues: [], dimensionsUsable: Boolean(dims) };
  }
  const nearest = candidates.slice(0, 3);
  const referencePackages = references.filter((candidate) => candidates.some((item) => item.sku === candidate.sku)).map(packageDimensions).filter((value): value is number[] => value != null);
  const withinEnvelope = Boolean(dims && referencePackages.length && dims.every((value, index) => value <= Math.max(...referencePackages.map((pack) => pack[index])) * 1.1));
  // A close measured package is more useful than averaging unrelated package sizes.
  const best = nearest[0];
  let base = best.distance <= 0.8 && dims && withinEnvelope ? best.shippingWeightKg : Math.max(...nearest.map((candidate) => candidate.shippingWeightKg));
  if (!dims || best.distance > 1.5) {
    // With insufficient geometry, use the upper-middle reference rather than
    // asserting a precise match. The reserve is still applied exactly once.
    const weights = candidates.map((candidate) => candidate.shippingWeightKg).sort((a, b) => a - b);
    base = Math.max(base, weights[Math.floor((weights.length - 1) * 0.75)]);
  }
  if (!withinEnvelope || best.distance > 0.8) {
    const legacy = estimateRevozportShippingWeightKg({ ...source, length: dims ? source.length : null, width: dims ? source.width : null, height: dims ? source.height : null });
    base = Math.max(base, legacy.weightKg / REVOZPORT_DELIVERY_RESERVE);
  }
  base = round(Math.max(base, productWeightKg));
  const selected = nearest.find((candidate) => Math.abs(round(candidate.shippingWeightKg) - base) < 0.0001);
  return { baseWeightKg: round(base), weightKg: round(base * REVOZPORT_DELIVERY_RESERVE), source: `approved_supplier_analogue:${partClass}:${selected?.sku ?? "conservative_type_floor"}`, confidence: dims && withinEnvelope && best.distance <= 0.8 ? "medium" as const : "low" as const, analogues: nearest, dimensionsUsable: Boolean(dims) };
}
