/**
 * Type definitions and runtime validation for a forged-wheel configuration.
 *
 * The same schema is used by:
 *  - the client-side Zustand store (initial state shape, type guards)
 *  - the /api/shop/forged/quote-request handler (request validation)
 *  - the admin draft renderer (typed read of pricingSnapshot.config)
 *
 * Kept dependency-free (no zod) to avoid pulling a runtime validation lib
 * into a project that hasn't standardised on one yet. If the project
 * later adopts zod or valibot, swap this for a generated schema.
 */

export const DIAMETERS = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24] as const;
export type Diameter = (typeof DIAMETERS)[number];

/** Allowed wheel widths in J (×0.5 increments). Custom widths route to manual quote. */
export const WIDTHS_J = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13] as const;
export type WidthJ = (typeof WIDTHS_J)[number];

export const PCDS = [
  "4x100",
  "4x108",
  "5x100",
  "5x108",
  "5x112",
  "5x114.3",
  "5x120",
  "5x130",
  "5x139.7",
  "6x139.7",
] as const;
export type Pcd = (typeof PCDS)[number];

/** ET / offset range — beyond this routes to manual review. */
export const ET_MIN = -30;
export const ET_MAX = 60;

/** Common centre bores in mm. "custom" routes to manual review. */
export const CENTRE_BORES = [
  54.1, 56.1, 57.1, 60.1, 64.1, 66.5, 67.1, 71.6, 72.6, 74.1, 78.1,
] as const;
export type CentreBore = (typeof CENTRE_BORES)[number] | "custom";

export const MATERIALS = ["aluminium", "magnesium", "carbon"] as const;
export type Material = (typeof MATERIALS)[number];

export const FINISHES = ["gloss", "satin", "matte", "brushed", "forged-clear", "two-tone"] as const;
export type Finish = (typeof FINISHES)[number];

export const PREVIEW_MODES = ["library", "upload", "none"] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];

export type ForgedConfig = {
  designSlug: string;
  diameter: Diameter;
  /** Front pair width. */
  widthFront: WidthJ;
  /** Rear pair width. May equal widthFront for non-staggered fitments. */
  widthRear: WidthJ;
  pcd: Pcd;
  etFront: number;
  etRear: number;
  centreBore: CentreBore;
  centreBoreCustom?: number;
  material: Material;
  finish: Finish;
  /** Hex value, including the leading "#". */
  primaryColor: string;
  /** Optional contrast accent for two-tone or splitline designs. */
  accentColor?: string;
  /** Whether the OC monogram is engraved on the spoke face. */
  ocMonogramEngraving: boolean;
  /** Free-form note from the customer (e.g. shipping deadline). */
  customerNote?: string;
  carPreviewMode: PreviewMode;
  /** Slug from carLibrary.ts when previewMode === "library". */
  carLibrarySlug?: string;
  /** Vercel Blob URL when previewMode === "upload". */
  carPhotoUrl?: string;
  /** Replica acknowledgement record. Required before submit. */
  replicaConsent?: {
    acceptedAt: string; // ISO 8601
    legalVersionTag: string;
  };
};

export const LEGAL_VERSION_TAG = "v1-2026-05-10";

export type QuoteRequestPayload = {
  config: ForgedConfig;
  customer: {
    fullName: string;
    email: string;
    phone?: string;
  };
  /** Optional locale hint so the quote email can land in UA or EN. */
  locale?: "ua" | "en";
};

export type ValidationFailure = {
  path: string;
  message: string;
};

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Runtime validator returning a list of failures. Empty array = valid.
 * Used both client-side (live form errors) and server-side (request gate).
 */
export function validateForgedConfig(c: Partial<ForgedConfig>): ValidationFailure[] {
  const errs: ValidationFailure[] = [];
  if (!c.designSlug || typeof c.designSlug !== "string") {
    errs.push({ path: "designSlug", message: "Оберіть дизайн." });
  }
  if (!c.diameter || !DIAMETERS.includes(c.diameter as Diameter)) {
    errs.push({ path: "diameter", message: "Невірний діаметр." });
  }
  if (!c.widthFront || !WIDTHS_J.includes(c.widthFront as WidthJ)) {
    errs.push({ path: "widthFront", message: "Невірна ширина переду." });
  }
  if (!c.widthRear || !WIDTHS_J.includes(c.widthRear as WidthJ)) {
    errs.push({ path: "widthRear", message: "Невірна ширина заду." });
  }
  if (!c.pcd || !PCDS.includes(c.pcd as Pcd)) {
    errs.push({ path: "pcd", message: "Оберіть PCD." });
  }
  if (typeof c.etFront !== "number" || c.etFront < ET_MIN || c.etFront > ET_MAX) {
    errs.push({ path: "etFront", message: `ET переду має бути від ${ET_MIN} до ${ET_MAX}.` });
  }
  if (typeof c.etRear !== "number" || c.etRear < ET_MIN || c.etRear > ET_MAX) {
    errs.push({ path: "etRear", message: `ET заду має бути від ${ET_MIN} до ${ET_MAX}.` });
  }
  if (!c.centreBore) {
    errs.push({ path: "centreBore", message: "Оберіть центральний отвір." });
  } else if (c.centreBore === "custom") {
    if (
      typeof c.centreBoreCustom !== "number" ||
      c.centreBoreCustom < 50 ||
      c.centreBoreCustom > 110
    ) {
      errs.push({ path: "centreBoreCustom", message: "Введіть діаметр від 50 до 110 мм." });
    }
  }
  if (!c.material || !MATERIALS.includes(c.material as Material)) {
    errs.push({ path: "material", message: "Оберіть матеріал." });
  }
  if (!c.finish || !FINISHES.includes(c.finish as Finish)) {
    errs.push({ path: "finish", message: "Оберіть фініш." });
  }
  if (!c.primaryColor || !HEX_RE.test(c.primaryColor)) {
    errs.push({ path: "primaryColor", message: "Невірний HEX-колір." });
  }
  if (c.accentColor && !HEX_RE.test(c.accentColor)) {
    errs.push({ path: "accentColor", message: "Невірний HEX-колір акценту." });
  }
  if (!c.carPreviewMode || !PREVIEW_MODES.includes(c.carPreviewMode as PreviewMode)) {
    errs.push({ path: "carPreviewMode", message: "Оберіть режим попереднього перегляду." });
  }
  return errs;
}

export function validateQuoteRequest(p: Partial<QuoteRequestPayload>): ValidationFailure[] {
  const errs: ValidationFailure[] = [];
  if (!p.customer || typeof p.customer !== "object") {
    errs.push({ path: "customer", message: "Контактні дані відсутні." });
    return errs;
  }
  if (!p.customer.fullName || p.customer.fullName.trim().length < 2) {
    errs.push({ path: "customer.fullName", message: "Введіть ім'я." });
  }
  if (!p.customer.email || !EMAIL_RE.test(p.customer.email)) {
    errs.push({ path: "customer.email", message: "Введіть коректний email." });
  }
  if (!p.config) {
    errs.push({ path: "config", message: "Конфігурація відсутня." });
    return errs;
  }
  if (!p.config.replicaConsent || !p.config.replicaConsent.acceptedAt) {
    errs.push({
      path: "config.replicaConsent",
      message: "Підтвердіть, що ви ознайомлені з умовами замовлення репродукції.",
    });
  }
  errs.push(
    ...validateForgedConfig(p.config).map((e) => ({ path: `config.${e.path}`, message: e.message }))
  );
  return errs;
}

export function makeDefaultConfig(designSlug: string): ForgedConfig {
  return {
    designSlug,
    diameter: 19,
    widthFront: 9,
    widthRear: 10.5,
    pcd: "5x112",
    etFront: 30,
    etRear: 25,
    centreBore: 66.5,
    material: "aluminium",
    finish: "satin",
    primaryColor: "#1c1c1c",
    ocMonogramEngraving: true,
    carPreviewMode: "library",
  };
}
