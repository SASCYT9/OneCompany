import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  buildAdminProductSnapshotMergeUpdateData,
  type AdminShopProductPayload,
} from "../src/lib/shopAdminCatalog";
import { coordinateShopCatalogProductMutationWithClient } from "../src/lib/shopCatalogMutationCoordinator.server";
import { buildShopCatalogAdminSnapshot } from "../src/lib/shopCatalogAdminSnapshot.server";

type OfficialVariant = {
  id?: number;
  sku?: string | null;
  title?: string | null;
  price?: string | number | null;
  available?: boolean;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

type OfficialProduct = {
  handle: string;
  title: string;
  options?: Array<{ name?: string | null; values?: string[] | null }>;
  variants?: OfficialVariant[];
  images?: Array<{ src?: string | null; variant_ids?: number[] | null }>;
};

type RevozportSource = AdminShopProductPayload & {
  source: {
    officialUrl?: string | null;
    shippingWeightLbs?: number | null;
    productWeightLbs?: number | null;
    shippingWeightSource?: string | null;
  };
};

type OfficialMatch = {
  status: "safe" | "unmatched" | "ambiguous";
  sourceHandle: string;
  product: OfficialProduct | null;
  candidates: string[];
  reason: string;
};

const PREVIEW_PATH = ".tmp/revozport-catalog-preview.json";
const OFFICIAL_AUDIT_PATH = ".tmp/revozport-official-audit/products.json";
const OUTPUT_DIR = ".tmp/revozport-reconciliation";
const commit = process.argv.includes("--commit");
const ackQuarantine = process.argv.includes("--ack-quarantine=1");
const onlySku = process.argv.find((arg) => arg.startsWith("--sku="))?.slice(6);

const json = (value: unknown) =>
  JSON.stringify(value, (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested), 2);

function normalizeSku(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/-KB(?:-\d+)?$/, "")
    .replace(/-1$/, "");
}

function handleFromUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(value).pathname.replace(/\/$/, "").split("/").pop()?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function officialImages(product: OfficialProduct) {
  return [
    ...new Set(
      (product.images ?? [])
        .map((image) => String(image.src ?? "").trim())
        .filter(Boolean)
        .map((src) => (src.startsWith("//") ? `https:${src}` : src))
        .filter((src) => /^https:\/\/(?:cdn\.shopify\.com|revozport\.com)\//.test(src))
    ),
  ].slice(0, 10);
}

function usableOptions(product: OfficialProduct) {
  return (product.options ?? [])
    .map((option) => ({
      name: String(option.name ?? "").trim(),
      values: [...new Set((option.values ?? []).map((value) => String(value).trim()).filter(Boolean))],
    }))
    .filter(
      (option) =>
        option.name &&
        option.name.toLowerCase() !== "title" &&
        option.values.length > 0 &&
        !(option.values.length === 1 && option.values[0].toLowerCase() === "default title")
    );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!
  );
}

function replaceEstimatedWeight(html: string | null | undefined, locale: "ua" | "en") {
  if (!html) return html ?? null;
  const label = locale === "ua" ? "Вага відправлення" : "Shipping weight";
  const replacement = `<li>${label}: уточнюється</li>`;
  const pattern = new RegExp(`<li>${label}:[^<]*</li>`, "i");
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html;
}

function appendOptions(html: string | null | undefined, options: ReturnType<typeof usableOptions>, locale: "ua" | "en") {
  if (!html || !options.length) return html ?? null;
  const label = locale === "ua" ? "Варіант" : "Option";
  const line = `<li>${label}: ${options
    .map((option) => `${escapeHtml(option.name)} — ${option.values.map(escapeHtml).join(" / ")}`)
    .join("; ")}</li>`;
  if (html.includes(line)) return html;
  if (/<\/ul>/i.test(html)) return html.replace(/<\/ul>/i, `${line}</ul>`);
  return `${html}<ul>${line}</ul>`;
}

function upsertMetaValue(
  tx: Prisma.TransactionClient,
  productId: string,
  namespace: string,
  key: string,
  value: string
) {
  return tx.shopProductMetafield.upsert({
    where: { productId_namespace_key: { productId, namespace, key } },
    update: { value, valueType: "single_line_text_field" },
    create: { productId, namespace, key, value, valueType: "single_line_text_field" },
  });
}

function findMatch(source: RevozportSource, official: OfficialProduct[]): OfficialMatch {
  const sourceHandle = handleFromUrl(source.source?.officialUrl);
  const normalized = normalizeSku(source.sku);
  const candidates = official.flatMap((product) =>
    (product.variants ?? [])
      .filter((variant) => normalizeSku(variant.sku) === normalized)
      .map(() => product)
  );
  const uniqueCandidates = [...new Map(candidates.map((product) => [product.handle, product])).values()];
  const fromSourceUrl = uniqueCandidates.filter((product) => product.handle.toLowerCase() === sourceHandle);
  if (fromSourceUrl.length === 1) {
    return {
      status: "safe",
      sourceHandle,
      product: fromSourceUrl[0],
      candidates: uniqueCandidates.map((product) => product.handle),
      reason: "normalized SKU and source URL agree",
    };
  }
  if (uniqueCandidates.length === 1) {
    return {
      status: "safe",
      sourceHandle,
      product: uniqueCandidates[0],
      candidates: uniqueCandidates.map((product) => product.handle),
      reason: "normalized SKU maps to one official product",
    };
  }
  if (uniqueCandidates.length > 1) {
    return {
      status: "ambiguous",
      sourceHandle,
      product: null,
      candidates: uniqueCandidates.map((product) => product.handle),
      reason: "normalized SKU maps to multiple official products",
    };
  }
  return {
    status: "unmatched",
    sourceHandle,
    product: null,
    candidates: [],
    reason: "source SKU is absent from current official variants",
  };
}

function buildVariantPayload(
  source: RevozportSource,
  product: OfficialProduct,
  estimatedWeight: boolean,
  currentInventoryQty: number
  ): AdminShopProductPayload["variants"] {
  const options = usableOptions(product);
  const officialVariants = product.variants ?? [];
  const firstOfficial = officialVariants[0];
  const sourceSku = source.sku ?? null;
  return officialVariants.map((variant, index) => {
    const officialSku = String(variant.sku ?? "").trim() || null;
    const isPrimary = index === 0;
    const optionValue = options.length && variant.title && variant.title !== "Default Title" ? variant.title : null;
    const officialPrice = asNumber(variant.price);
    const image = officialImages(product).find((src) =>
      (product.images ?? []).some(
        (candidate) =>
          (candidate.src?.startsWith("//") ? `https:${candidate.src}` : candidate.src) === src &&
          (!candidate.variant_ids?.length || candidate.variant_ids.includes(Number(variant.id)))
      )
    ) ?? officialImages(product)[0] ?? null;
    return {
      title: optionValue ?? (isPrimary ? "Default" : variant.title ?? officialSku ?? "Option"),
      sku: isPrimary ? sourceSku : officialSku,
      position: index + 1,
      option1Value: optionValue,
      inventoryQty: isPrimary ? currentInventoryQty : 0,
      inventoryPolicy: "CONTINUE" as const,
      inventoryTracker: "manual",
      fulfillmentService: "manual",
      priceUsd: isPrimary ? source.priceUsd ?? officialPrice : officialPrice,
      requiresShipping: true,
      taxable: true,
      image,
      weightUnit: "kg",
      weight: estimatedWeight ? null : source.weight ?? null,
      grams: estimatedWeight || source.weight == null ? null : Math.round(source.weight * 1000),
      length: source.length ?? null,
      width: source.width ?? null,
      height: source.height ?? null,
      isDefault: isPrimary,
      isDimensionsEstimated: estimatedWeight,
    };
  });
}

function buildPayload(source: RevozportSource, product: OfficialProduct, current: any): AdminShopProductPayload {
  const options = usableOptions(product);
  const images = officialImages(product);
  const estimatedWeight = source.source.shippingWeightLbs == null || source.source.shippingWeightLbs <= 0;
  const bodyUa = replaceEstimatedWeight(current.bodyHtmlUa ?? source.bodyHtmlUa, "ua");
  const bodyEn = replaceEstimatedWeight(current.bodyHtmlEn ?? source.bodyHtmlEn, "en");
  const withOptionsUa = appendOptions(bodyUa, options, "ua");
  const withOptionsEn = appendOptions(bodyEn, options, "en");
  const meta = [...(source.metafields ?? [])].filter(
    (item) =>
      !(
        item.namespace === "revozport_logistics" &&
        [
          "shipping_weight_kg",
          "estimated_shipping_weight_kg",
          "calculated_shipping_usd",
          "estimated_weight_safety_margin_pct",
        ].includes(item.key)
      )
  );
  const currentVariant = current.variants?.[0];
  return {
    ...(source as AdminShopProductPayload),
    titleUa: current.titleUa,
    titleEn: current.titleEn,
    shortDescUa: current.shortDescUa,
    shortDescEn: current.shortDescEn,
    longDescUa: withOptionsUa,
    longDescEn: withOptionsEn,
    bodyHtmlUa: withOptionsUa,
    bodyHtmlEn: withOptionsEn,
    seoTitleUa: current.seoTitleUa,
    seoTitleEn: current.seoTitleEn,
    seoDescriptionUa: current.seoDescriptionUa,
    seoDescriptionEn: current.seoDescriptionEn,
    status: current.status,
    isPublished: current.isPublished,
    publishedAt: current.publishedAt?.toISOString?.() ?? null,
    priceUsd: current.priceUsd == null ? source.priceUsd : Number(current.priceUsd),
    image: images[0] ?? null,
    gallery: images,
    weight: estimatedWeight ? null : source.weight ?? null,
    isDimensionsEstimated: estimatedWeight,
    media: images.map((src, index) => ({ src, altText: current.titleEn, position: index + 1, mediaType: "IMAGE" as const })),
    options: options.map((option, index) => ({ name: option.name, position: index + 1, values: option.values })),
    variants: buildVariantPayload(source, product, estimatedWeight, currentVariant?.inventoryQty ?? 0),
    metafields: meta,
  };
}

async function upsertMeta(
  tx: Prisma.TransactionClient,
  productId: string,
  namespace: string,
  key: string,
  value: string
) {
  await upsertMetaValue(tx, productId, namespace, key, value);
}

async function reconcileLogistics(tx: Prisma.TransactionClient, productId: string, estimated: boolean, weight: number | null) {
  const keys = ["shipping_weight_kg", "estimated_shipping_weight_kg", "calculated_shipping_usd", "estimated_weight_safety_margin_pct"];
  await tx.shopProductMetafield.deleteMany({ where: { productId, namespace: "revozport_logistics", key: { in: keys } } });
  if (estimated) {
    await upsertMeta(tx, productId, "revozport_logistics", "shipping_weight_source", "pending_official_weight");
    await upsertMeta(tx, productId, "revozport_logistics", "shipping_weight_status", "quote_required");
  } else if (weight != null) {
    await upsertMeta(tx, productId, "revozport_logistics", "shipping_weight_kg", weight.toFixed(3),);
    await upsertMeta(tx, productId, "revozport_logistics", "shipping_weight_source", "workbook_shipping_weight");
  }
}

async function main() {
  const preview = JSON.parse(await readFile(PREVIEW_PATH, "utf8")) as { products: RevozportSource[] };
  const officialCache = JSON.parse(await readFile(OFFICIAL_AUDIT_PATH, "utf8")) as { products: OfficialProduct[] };
  const plans = preview.products.map((source) => ({ source, match: findMatch(source, officialCache.products) }));
  const safe = plans.filter((plan) => plan.match.status === "safe");
  const quarantine = plans.filter((plan) => plan.match.status !== "safe");
  const finish = safe.filter((plan) => usableOptions(plan.match.product!).length > 0);
  const summary = {
    mode: commit ? "commit" : "dry-run",
    sourceProducts: plans.length,
    safeProducts: safe.length,
    quarantineProducts: quarantine.length,
    officialOptionProducts: finish.length,
    estimatedWeightsRemoved: safe.filter((plan) => plan.source.source.shippingWeightLbs == null || plan.source.source.shippingWeightLbs <= 0).length,
    sourceWeightProducts: safe.filter((plan) => plan.source.source.shippingWeightLbs != null && plan.source.source.shippingWeightLbs > 0).length,
    quarantineReasons: quarantine.reduce<Record<string, number>>((result, plan) => {
      result[plan.match.status] = (result[plan.match.status] ?? 0) + 1;
      return result;
    }, {}),
  };
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(`${OUTPUT_DIR}/plan.json`, json({ summary, plans }), "utf8");
  console.log(json(summary));
  if (!commit) return;
  if (!process.argv.includes("--target=onecompany.global")) throw new Error("Commit requires explicit --target=onecompany.global");
  if (!ackQuarantine) throw new Error("Commit requires --ack-quarantine=1; unmatched/ambiguous rows will be moved to DRAFT, never deleted");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport" }, include: { media: true, options: true, variants: true, metafields: true } });
    const beforePath = `${OUTPUT_DIR}/before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await writeFile(beforePath, json(rows), "utf8");
    const completed: Array<{ sku: string; action: string; productId: string }> = [];
    for (const plan of plans) {
      if (onlySku && plan.source.sku !== onlySku) continue;
      const row = rows.find((candidate) => candidate.sku === plan.source.sku);
      if (!row) continue;
      if (plan.match.status === "safe" && plan.match.product) {
        const payload = buildPayload(plan.source, plan.match.product, row);
        const updateData = buildAdminProductSnapshotMergeUpdateData(payload, row as never);
        delete (updateData as Record<string, unknown>).media;
        const officialUrl = `https://revozport.com/products/${plan.match.product.handle}`;
        const options = usableOptions(plan.match.product);
        const officialImages = officialImagesForProduct(plan.match.product);
        const estimated = plan.source.source.shippingWeightLbs == null || plan.source.source.shippingWeightLbs <= 0;
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: row.id,
          expectedCatalogVersion: row.catalogVersion.toString(),
          changeDomains: ["CONTENT", "SEO", "MEDIA", "PRICE", "INVENTORY"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            const current = await tx.shopProduct.findUniqueOrThrow({ where: { id: row.id }, select: { brand: true, sku: true } });
            if (current.brand !== "Revozport" || current.sku !== row.sku) throw new Error(`Revozport row changed during reconcile: ${row.sku}`);
            await tx.shopProductMedia.deleteMany({ where: { productId: row.id } });
            await tx.shopProduct.update({ where: { id: row.id }, data: updateData });
            if (officialImages.length) {
              await tx.shopProductMedia.createMany({ data: officialImages.map((src, index) => ({ productId: row.id, src, altText: row.titleEn, position: index + 1, mediaType: "IMAGE" as const })) });
            }
            await reconcileLogistics(tx, row.id, estimated, estimated ? null : plan.source.weight ?? null);
            await upsertMeta(tx, row.id, "revozport_source", "official_url", officialUrl);
            await upsertMeta(tx, row.id, "revozport_reconciliation", "status", "official_sku_reconciled");
            await upsertMeta(tx, row.id, "revozport_reconciliation", "official_handle", plan.match.product!.handle);
            await upsertMeta(tx, row.id, "revozport_reconciliation", "official_options", JSON.stringify(options));
            await upsertMeta(tx, row.id, "revozport_reconciliation", "official_variant_skus", JSON.stringify((plan.match.product!.variants ?? []).map((variant) => variant.sku).filter(Boolean)));
            return buildShopCatalogAdminSnapshot(tx, row.id, nextCatalogVersion, { type: "IMPORT", id: "revozport-reconcile@system.local", reason: "revozport.official-options-media-weight-reconcile" });
          },
        });
        completed.push({ sku: row.sku ?? plan.source.sku, action: `reconciled:${mutation.outboxId}`, productId: row.id });
      } else {
        const mutation = await coordinateShopCatalogProductMutationWithClient(prisma, {
          productId: row.id,
          expectedCatalogVersion: row.catalogVersion.toString(),
          changeDomains: ["CONTENT", "SEO", "MEDIA"],
          async mutateAndSnapshot(tx, nextCatalogVersion) {
            const current = await tx.shopProduct.findUniqueOrThrow({ where: { id: row.id }, select: { brand: true, sku: true } });
            if (current.brand !== "Revozport" || current.sku !== row.sku) throw new Error(`Revozport row changed during quarantine: ${row.sku}`);
            await tx.shopProduct.update({ where: { id: row.id }, data: { status: "DRAFT", isPublished: false, publishedAt: null, weight: null, isDimensionsEstimated: true } });
            await tx.shopProductVariant.updateMany({ where: { productId: row.id }, data: { weight: null, grams: null, isDimensionsEstimated: true } });
            await tx.shopProductMetafield.deleteMany({ where: { productId: row.id, namespace: "revozport_logistics", key: { in: ["shipping_weight_kg", "estimated_shipping_weight_kg", "calculated_shipping_usd", "estimated_weight_safety_margin_pct"] } } });
            await upsertMeta(tx, row.id, "revozport_logistics", "shipping_weight_source", "pending_official_weight");
            await upsertMeta(tx, row.id, "revozport_logistics", "shipping_weight_status", "quote_required");
            await upsertMeta(tx, row.id, "revozport_reconciliation", "status", `quarantined_${plan.match.status}`);
            await upsertMeta(tx, row.id, "revozport_reconciliation", "reason", plan.match.reason);
            await upsertMeta(tx, row.id, "revozport_reconciliation", "candidate_official_handles", JSON.stringify(plan.match.candidates));
            return buildShopCatalogAdminSnapshot(tx, row.id, nextCatalogVersion, { type: "IMPORT", id: "revozport-reconcile@system.local", reason: "revozport.unmatched-or-ambiguous-quarantine" });
          },
        });
        completed.push({ sku: row.sku ?? plan.source.sku, action: `quarantined:${mutation.outboxId}`, productId: row.id });
      }
    }
    await writeFile(`${OUTPUT_DIR}/completed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, json(completed), "utf8");
    console.log(json({ ...summary, completed: completed.length }));
  } finally {
    await prisma.$disconnect();
  }
}

function officialImagesForProduct(product: OfficialProduct) {
  return [...new Set((product.images ?? []).map((image) => String(image.src ?? "").trim()).filter(Boolean).map((src) => (src.startsWith("//") ? `https:${src}` : src)).filter((src) => /^https:\/\/(?:cdn\.shopify\.com|revozport\.com)\//.test(src)))].slice(0, 10);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
