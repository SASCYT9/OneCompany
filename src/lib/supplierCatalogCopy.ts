import type { SupplierFitmentApplication } from "@/lib/shopImportFitment";
import { canonicalizeSupplierVehicles } from "@/lib/supplierVehicleCanonical";

/**
 * Generated + reviewed UA/EN product copy for supplier catalogues (Link ECU,
 * Dinan, APR). Written by scripts/catalog-copy from the manufacturer's own
 * page, validated against it, and corrected by hand through overrides.
 */
export type SupplierCopySpec = { label: string; value: string };

export type SupplierCopyVehicle = {
  make: string;
  model: string;
  chassisCode: string | null;
  engine: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  market: string | null;
  note: string | null;
};

export type SupplierCopy = {
  titleEn: string;
  titleUa: string;
  shortDescEn: string;
  shortDescUa: string;
  introEn: string[];
  introUa: string[];
  keyPointsEn: string[];
  keyPointsUa: string[];
  specsEn: SupplierCopySpec[];
  specsUa: SupplierCopySpec[];
  inBoxEn: string[];
  inBoxUa: string[];
  fitmentEn: string[];
  fitmentUa: string[];
  importantEn: string[];
  importantUa: string[];
  seoTitleEn: string;
  seoTitleUa: string;
  seoDescriptionEn: string;
  seoDescriptionUa: string;
  imageAltEn: string;
  imageAltUa: string;
  vehicles: SupplierCopyVehicle[];
};

/** Manual review corrections kept apart from generated copy, so regeneration keeps them. */
export type SupplierCopyOverride = Partial<SupplierCopy>;

export function applySupplierCopyOverride(
  copy: SupplierCopy,
  override: SupplierCopyOverride | undefined
): SupplierCopy {
  return override ? { ...copy, ...override } : copy;
}

export function slugifySupplierText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug of at most `maxLength` characters cut at a word boundary. */
export function trimSupplierSlug(value: string, maxLength: number) {
  let trimmed = "";
  for (const part of slugifySupplierText(value).split("-").filter(Boolean)) {
    const next = trimmed ? `${trimmed}-${part}` : part;
    if (next.length > maxLength) break;
    trimmed = next;
  }
  return trimmed;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(items: string[]) {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  return clean.length
    ? `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
}

function heading(text: string) {
  return `<p><strong>${escapeHtml(text)}</strong></p>`;
}

const SECTION_LABELS = {
  ua: {
    keyPoints: "Головне",
    fitment: "Сумісність",
    important: "Важливо перед замовленням",
    specs: "Характеристики",
    inBox: "Комплектація",
  },
  en: {
    keyPoints: "Key features",
    fitment: "Vehicle fitment",
    important: "Before you order",
    specs: "Specifications",
    inBox: "In the box",
  },
} as const;

/**
 * Product page description in the house style (bold paragraph headings and
 * bullet lists), so it reads well in the shared product page without
 * brand-specific CSS.
 */
export function buildSupplierDescriptionHtml(copy: SupplierCopy, locale: "ua" | "en") {
  const isUa = locale === "ua";
  const labels = SECTION_LABELS[locale];
  const intro = (isUa ? copy.introUa : copy.introEn)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const keyPoints = isUa ? copy.keyPointsUa : copy.keyPointsEn;
  const fitment = isUa ? copy.fitmentUa : copy.fitmentEn;
  const important = isUa ? copy.importantUa : copy.importantEn;
  const specs = (isUa ? copy.specsUa : copy.specsEn).filter(
    (spec) => spec.label.trim() && spec.value.trim()
  );
  const inBox = isUa ? copy.inBoxUa : copy.inBoxEn;
  const blocks = [intro];
  if (keyPoints.length) blocks.push(heading(labels.keyPoints), list(keyPoints));
  if (fitment.length) blocks.push(heading(labels.fitment), list(fitment));
  if (important.length) blocks.push(heading(labels.important), list(important));
  if (specs.length) {
    blocks.push(
      heading(labels.specs),
      `<ul>${specs
        .map(
          (spec) =>
            // One inline span: list items are flex rows on the product page, so a bare
            // <strong> + text would split into two ragged columns.
            `<li><span><strong>${escapeHtml(spec.label.trim().replace(/:$/, ""))}:</strong> ${escapeHtml(spec.value.trim())}</span></li>`
        )
        .join("")}</ul>`
    );
  }
  if (inBox.length) blocks.push(heading(labels.inBox), list(inBox));
  return blocks.join("");
}

export function nullableSupplierText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

/** Car applications for the supplier fitment contract, without duplicates. */
export function supplierCopyVehicleApplications(
  vehicles: SupplierCopyVehicle[]
): SupplierFitmentApplication[] {
  const applications: SupplierFitmentApplication[] = [];
  // The vehicle picker matches its own model and chassis names literally.
  for (const vehicle of canonicalizeSupplierVehicles(vehicles)) {
    const make = nullableSupplierText(vehicle.make);
    const model = nullableSupplierText(vehicle.model);
    if (!make || !model) continue;
    applications.push({
      vehicleType: "car",
      make,
      model,
      chassisCode: nullableSupplierText(vehicle.chassisCode),
      yearFrom: vehicle.yearFrom ?? null,
      yearTo: vehicle.yearTo ?? null,
      engine: nullableSupplierText(vehicle.engine),
      fuel: null,
      bodyStyle: null,
      drivetrain: null,
      transmission: null,
      market: nullableSupplierText(vehicle.market),
      opfGpf: "unknown",
    });
  }
  return Array.from(
    new Map(applications.map((application) => [JSON.stringify(application), application])).values()
  );
}

/** Search and filter tags taken from the vehicles a product fits (trim and picker names). */
export function supplierCopyVehicleTags(vehicles: SupplierCopyVehicle[]) {
  const tags = new Set<string>();
  for (const vehicle of [...vehicles, ...canonicalizeSupplierVehicles(vehicles)]) {
    for (const value of [vehicle.make, vehicle.model, vehicle.chassisCode, vehicle.engine]) {
      const text = nullableSupplierText(value);
      if (!text) continue;
      for (const part of text.split("/")) {
        const clean = part.trim();
        if (clean) tags.add(clean);
      }
    }
  }
  return Array.from(tags);
}
