import { createHash } from "node:crypto";

import { extractSupportedExternalVideos } from "./shopProductVideo";

export type FiSourceProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: Array<{ id: number; title: string; sku: string | null; available: boolean; price: string; compare_at_price: string | null; position: number }>;
  images: Array<{ id: number; position: number; src: string; width: number; height: number }>;
};

export type FiFitment = { brand: string; model: string; body: string };
export type FiFitmentEntry = { id: string; handle: string; status: string; applications: FiFitment[] };

export type FiCanonicalDraft = ReturnType<typeof buildFiCanonicalDraft>;

const CYRILLIC_RE = /[\u0400-\u04ff]/u;

function stripIframes(html: string) {
  return html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/giu, "").replace(/<p[^>]*>\s*<\/p>/giu, "").trim();
}

function escapeHtml(value: string) {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
}

function vehicleLabel(applications: readonly FiFitment[]) {
  return [...new Set(applications.map(({ brand, model, body }) => [brand, model, body].filter(Boolean).join(" ")))].join(" / ");
}

function titleEn(product: FiSourceProduct, applications: readonly FiFitment[]) {
  const vehicle = vehicleLabel(applications);
  const source = product.title.replace(/^Fi\s*EXHAUST\s*/iu, "").replace(/\s+для\s+.+$/iu, "").trim();
  const kind = /downpipe/iu.test(product.product_type || product.title) ? "Downpipe" : source || "Valvetronic Exhaust System";
  return `Fi EXHAUST ${kind} for ${vehicle}`.replace(/\s+/gu, " ").trim();
}

function extractKitContents(html: string) {
  const section = html.match(/<strong[^>]*>Комплектація:\s*<\/strong>[\s\S]*?<li[^>]*>([\s\S]*?)<\/li>/iu)?.[1]
    ?? html.match(/<strong[^>]*>Основна конфігурація:\s*<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/iu)?.[1]
    ?? "";
  return section.replace(/<[^>]+>/gu, " ").replace(/&nbsp;/gu, " ").replace(/\s+/gu, " ").trim();
}

function kitContentsEn(html: string) {
  return extractKitContents(html)
    .replace(/залежно від обраної версії/giu, "depending on the selected version")
    .replace(/залежно від версії/giu, "depending on the version")
    .replace(/з індивідуально спроектованими внутрішніми елементами/giu, "with custom-engineered internals")
    .replace(/з унікальним внутрішнім дизайном/giu, "with a unique internal design")
    .replace(/з (?:ретельно |індивідуально |спеціально |унікально )?(?:спроектованим|розробленим) внутрішнім дизайном/giu, "with a purpose-engineered internal design")
    .replace(/з ретельно спроектованим дизайном/giu, "with a purpose-engineered design")
    .replace(/оптимізованим для facelift моделей/giu, "optimized for facelift models")
    .replace(/для гібридної силової установки з твін-турбо V6/giu, "for the hybrid twin-turbo V6 powertrain")
    .replace(/для потужного твін-турбо V8/giu, "for the high-output twin-turbo V8")
    .replace(/для твін-турбо/giu, "for the twin-turbo")
    .replace(/для суперчарджованого/giu, "for the supercharged")
    .replace(/для атмосферного/giu, "for the naturally aspirated")
    .replace(/для двигуна/giu, "for the")
    .replace(/для Performante/giu, "for the Performante")
    .replace(/для EVO/giu, "for the EVO")
    .replace(/або/giu, "or")
    .replace(/\s+/gu, " ")
    .trim();
}

function bodyEn(product: FiSourceProduct, applications: readonly FiFitment[]) {
  const vehicle = escapeHtml(vehicleLabel(applications));
  const kit = escapeHtml(kitContentsEn(product.body_html));
  const isDownpipe = /downpipe/iu.test(product.product_type || product.title);
  return [
    `<p>The <strong>Fi EXHAUST</strong> ${isDownpipe ? "downpipe" : "valvetronic exhaust system"} for <strong>${vehicle}</strong> is a premium, vehicle-specific performance upgrade. It is engineered for precise fitment and improved exhaust flow.</p>`,
    "<p><strong>Key features:</strong></p>",
    `<ul><li>Vehicle-specific configuration for ${vehicle}</li><li>High-quality performance exhaust construction</li>${isDownpipe ? "" : "<li>Valve-controlled sound with quiet and sport modes</li>"}</ul>`,
    kit ? `<p><strong>Kit contents:</strong></p><p>${kit}</p>` : "",
    isDownpipe ? "" : "<p><strong>System control:</strong> Depending on the selected configuration, valve operation can retain the OEM strategy or use the optional Fi Pro remote and mobile app. The exact supplied components are listed above.</p>",
    "<p>Please confirm the vehicle model, chassis and production year before ordering.</p>",
  ].filter(Boolean).join("\n");
}

function normalizedFitment(applications: readonly FiFitment[]) {
  const rows = applications.map((application) => ({
    vehicleType: "car" as const,
    make: application.brand,
    models: [application.model],
    chassisCodes: application.body ? [application.body] : [],
    yearRanges: [], engines: [], fuel: null, bodyStyles: [], drivetrains: [], markets: [], transmission: null, opfGpf: "unknown" as const,
  }));
  return {
    version: 2, status: "verified", vehicleType: "car", make: new Set(rows.map((row) => row.make)).size === 1 ? rows[0]?.make ?? null : null,
    models: [...new Set(rows.flatMap((row) => row.models))], chassisCodes: [...new Set(rows.flatMap((row) => row.chassisCodes))],
    yearRanges: [], applications: rows, confidence: "high", source: "import", verifiedAt: null, verifiedBy: "fi-shopify-csv-v1", note: null, dependency: null,
  };
}

export function buildFiCanonicalDraft(product: FiSourceProduct, fitment: FiFitmentEntry) {
  const issues: string[] = [];
  const variant = product.variants[0];
  const videos = extractSupportedExternalVideos(product.body_html);
  const cleanUa = stripIframes(product.body_html);
  const englishTitle = titleEn(product, fitment.applications);
  const englishBody = bodyEn(product, fitment.applications);
  if (!fitment.applications.length) issues.push("fitment_missing");
  if (fitment.status === "REVIEW_REQUIRED") issues.push("fitment_review_required");
  if (!variant?.sku) issues.push("sku_missing");
  if (!variant?.price || !/^\d+(?:\.\d+)?$/u.test(variant.price)) issues.push("price_uah_missing");
  if (!product.images.length) issues.push("images_missing");
  if (CYRILLIC_RE.test(englishTitle) || CYRILLIC_RE.test(englishBody)) issues.push("english_contains_cyrillic");
  const media = [
    ...product.images.sort((a, b) => a.position - b.position).map((image) => ({ externalMediaId: String(image.id), mediaType: "IMAGE" as const, src: image.src, altText: englishTitle, position: image.position })),
    ...videos.map((video, index) => ({ externalMediaId: `video:${product.id}:${video.videoId}`, mediaType: "EXTERNAL_VIDEO" as const, src: video.src, altText: `${englishTitle} sound video`, position: product.images.length + index + 1 })),
  ];
  const fitmentJson = JSON.stringify(normalizedFitment(fitment.applications));
  return {
    source: { sourceKey: "shopify-fi-exhaust", externalProductId: String(product.id), revision: product.updated_at, payloadHash: createHash("sha256").update(JSON.stringify(product)).digest("hex") },
    product: {
      slug: product.handle, sku: variant?.sku ?? null, scope: "auto" as const, brand: "Fi EXHAUST" as const, vendor: "Fi EXHAUST" as const,
      titleUa: product.title, titleEn: englishTitle, bodyHtmlUa: cleanUa, bodyHtmlEn: englishBody,
      seoTitleUa: product.title, seoTitleEn: englishTitle, seoDescriptionUa: null, seoDescriptionEn: null,
      productType: product.product_type || "Вихлопна система", productCategory: "exhaust-systems", tags: [...new Set(product.tags)],
      stock: "preOrder" as const, status: "ACTIVE" as const, isPublished: false as const,
      priceUah: variant?.price ?? null, priceEur: null, compareAtUah: variant?.compare_at_price ?? null, image: product.images[0]?.src ?? null,
    },
    variants: variant ? [{ externalVariantId: String(variant.id), title: null, sku: variant.sku, barcode: null, position: 1, optionValues: [], inventoryQty: 0, inventoryPolicy: "CONTINUE" as const, priceUah: variant.price, compareAtUah: variant.compare_at_price, isDefault: true }] : [],
    media,
    options: [] as Array<{ externalOptionId: string; name: string; position: number; values: string[] }>,
    metafields: [
      { externalMetafieldId: `derived:${product.id}:onecompany.normalized_fitment`, namespace: "onecompany", key: "normalized_fitment", value: fitmentJson, valueType: "json" },
      { externalMetafieldId: `derived:${product.id}:fi.source_vendor`, namespace: "fi", key: "source_vendor", value: product.vendor, valueType: "single_line_text_field" },
      ...(extractKitContents(product.body_html) ? [{ externalMetafieldId: `derived:${product.id}:fi.kit_contents`, namespace: "fi", key: "kit_contents", value: extractKitContents(product.body_html), valueType: "multi_line_text_field" }] : []),
    ],
    applications: fitment.applications,
    issues: [...new Set(issues)].sort(),
  };
}
