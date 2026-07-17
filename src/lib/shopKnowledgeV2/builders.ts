import type { ShopProduct } from "@/lib/shopCatalog";
import { extractProductFitment } from "@/lib/crossShopFitment";
import {
  classifyProductFitment,
  mergePersistedFitment,
  NORMALIZED_FITMENT_KEY,
  NORMALIZED_FITMENT_NAMESPACE,
  type NormalizedFitment,
  type VehicleApplication,
} from "@/lib/shopFitmentQuality";
import { buildShopSearchText } from "@/lib/shopSearch";
import {
  extractCategoryAttributes,
  extractCategoryAttributesFromText,
} from "@/lib/shopKnowledgeV2/attributes";
import { hashKnowledgeValue } from "@/lib/shopKnowledgeV2/hash";
import {
  buildKnowledgeChunks,
  collectKnowledgeTextSources,
  htmlToKnowledgeText,
} from "@/lib/shopKnowledgeV2/text";
import {
  SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
  SHOP_KNOWLEDGE_V2_SCHEMA_VERSION,
  type KnowledgeAttributeValue,
  type KnowledgeConfidence,
  type KnowledgeEvidenceSource,
  type KnowledgeManagerApplicationSource,
  type KnowledgeOpfGpf,
  type KnowledgeSourceProduct,
  type ShopKnowledgeBuild,
  type ShopKnowledgeEvidenceDraft,
  type ShopProductAttributeDraft,
  type ShopVariantKnowledgeDraft,
  type ShopVehicleApplicationDraft,
} from "@/lib/shopKnowledgeV2/types";

function parseLocalizedHighlights(value: unknown): Array<{ ua: string; en: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const ua = htmlToKnowledgeText(typeof record.ua === "string" ? record.ua : "");
    const en = htmlToKnowledgeText(typeof record.en === "string" ? record.en : "");
    return ua || en ? [{ ua, en }] : [];
  });
}

function toCatalogProduct(product: KnowledgeSourceProduct): ShopProduct {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku ?? "",
    scope: product.scope === "moto" ? "moto" : "auto",
    brand: product.brand ?? "",
    vendor: product.vendor ?? undefined,
    productType: product.productType ?? undefined,
    tags: product.tags,
    title: { ua: product.titleUa, en: product.titleEn },
    category: { ua: product.categoryUa ?? "", en: product.categoryEn ?? "" },
    shortDescription: { ua: product.shortDescUa ?? "", en: product.shortDescEn ?? "" },
    longDescription: {
      ua: product.bodyHtmlUa ?? product.longDescUa ?? "",
      en: product.bodyHtmlEn ?? product.longDescEn ?? "",
    },
    leadTime: { ua: product.leadTimeUa ?? "", en: product.leadTimeEn ?? "" },
    stock: "inStock",
    collection: { ua: product.collectionUa ?? "", en: product.collectionEn ?? "" },
    price: { eur: 0, usd: 0, uah: 0 },
    image: "",
    highlights: parseLocalizedHighlights(product.highlights),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      position: variant.position,
      optionValues: [variant.option1Value, variant.option2Value, variant.option3Value].filter(
        (value): value is string => Boolean(value)
      ),
      inventoryQty: variant.inventoryQty,
      price: { eur: 0, usd: 0, uah: 0 },
    })),
  };
}

function resolveFitment(product: KnowledgeSourceProduct): NormalizedFitment {
  const catalogProduct = toCatalogProduct(product);
  const automatic = classifyProductFitment(catalogProduct, extractProductFitment(catalogProduct));
  const persisted = product.metafields.find(
    (metafield) =>
      metafield.namespace === NORMALIZED_FITMENT_NAMESPACE &&
      metafield.key === NORMALIZED_FITMENT_KEY
  );
  return mergePersistedFitment(automatic, persisted?.value);
}

function sourceForFitment(fitment: NormalizedFitment): KnowledgeEvidenceSource {
  if (fitment.source === "import") return "supplier";
  // The normalized-fitment metafield is a migrated/manual override source, even
  // when it records who verified it. Only a field-level admin application may
  // become MANAGER provenance; otherwise every reindex would turn the legacy
  // projection into a self-authenticating canonical manager row.
  if (fitment.source === "manual") return "manual_fitment";
  return "description_extraction";
}

function priorityForSource(source: KnowledgeEvidenceSource): number {
  switch (source) {
    case "manager":
      return 1;
    case "manual_fitment":
      return 2;
    case "supplier":
      return 3;
    case "category_adapter":
      return 4;
    case "description_extraction":
      return 5;
  }
}

function confidenceForFitment(fitment: NormalizedFitment): KnowledgeConfidence {
  if (fitment.status === "verified" || fitment.status === "universal") return "verified";
  if (fitment.confidence === "high") return "high";
  if (fitment.confidence === "medium") return "medium";
  if (fitment.confidence === "low") return "low";
  return "unknown";
}

function getAttributeValue(
  attributes: ShopProductAttributeDraft[],
  key: string
): KnowledgeAttributeValue | null {
  return attributes.find((attribute) => attribute.key === key)?.value ?? null;
}

function stringAttribute(attributes: ShopProductAttributeDraft[], key: string): string | null {
  const value = getAttributeValue(attributes, key);
  return typeof value === "string" && value ? value : null;
}

function valuesOrNull<T>(values: T[]): Array<T | null> {
  return values.length > 0 ? values : [null];
}

type CorrelatedApplicationRow = {
  model: string | null;
  chassisCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  bodyStyle: string | null;
  drivetrain: string | null;
  market: string | null;
};

type CorrelatedApplicationExpansion = {
  rows: CorrelatedApplicationRow[];
  needsCorrelationReview: boolean;
};

function valueForApplicationRow<T>(values: Array<T | null>, index: number): T | null {
  return values.length === 1 ? values[0] : (values[index] ?? null);
}

function hasAmbiguousApplicationCorrelation(application: VehicleApplication): boolean {
  return (
    [
      application.models,
      application.chassisCodes,
      application.yearRanges,
      application.engines,
      application.bodyStyles,
      application.drivetrains,
      application.markets,
    ].filter((values) => values.length > 1).length > 1
  );
}

/**
 * A normalized source application is the correlation boundary. We may safely
 * expand alternatives along one dimension, but two or more independently
 * repeated dimensions do not describe how their values pair. In that case we
 * retain only singleton facts and emit one review-only row instead of inventing
 * a Cartesian fitment.
 */
function expandCorrelatedApplication(
  application: VehicleApplication,
  fallbackEngine: string | null
): CorrelatedApplicationExpansion {
  const models = valuesOrNull(application.models);
  const chassisCodes = valuesOrNull(application.chassisCodes);
  const yearRanges: Array<{ from: number | null; to: number | null }> =
    application.yearRanges.length > 0 ? application.yearRanges : [{ from: null, to: null }];
  const engines = application.engines.length
    ? valuesOrNull(application.engines)
    : valuesOrNull(fallbackEngine ? [fallbackEngine] : []);
  const bodyStyles = valuesOrNull(application.bodyStyles);
  const drivetrains = valuesOrNull(application.drivetrains);
  const markets = valuesOrNull(application.markets);
  const dimensions = [models, chassisCodes, yearRanges, engines, bodyStyles, drivetrains, markets];
  const needsCorrelationReview = dimensions.filter((values) => values.length > 1).length > 1;

  if (needsCorrelationReview) {
    const yearRange = yearRanges.length === 1 ? yearRanges[0] : null;
    return {
      needsCorrelationReview: true,
      rows: [
        {
          model: models.length === 1 ? models[0] : null,
          chassisCode: chassisCodes.length === 1 ? chassisCodes[0] : null,
          yearFrom: yearRange?.from ?? null,
          yearTo: yearRange?.to ?? null,
          engine: engines.length === 1 ? engines[0] : null,
          bodyStyle: bodyStyles.length === 1 ? bodyStyles[0] : null,
          drivetrain: drivetrains.length === 1 ? drivetrains[0] : null,
          market: markets.length === 1 ? markets[0] : null,
        },
      ],
    };
  }

  const rowCount = Math.max(...dimensions.map((values) => values.length));
  return {
    needsCorrelationReview: false,
    rows: Array.from({ length: rowCount }, (_, index) => {
      const yearRange = valueForApplicationRow(yearRanges, index);
      return {
        model: valueForApplicationRow(models, index),
        chassisCode: valueForApplicationRow(chassisCodes, index),
        yearFrom: yearRange?.from ?? null,
        yearTo: yearRange?.to ?? null,
        engine: valueForApplicationRow(engines, index),
        bodyStyle: valueForApplicationRow(bodyStyles, index),
        drivetrain: valueForApplicationRow(drivetrains, index),
        market: valueForApplicationRow(markets, index),
      };
    }),
  };
}

function fitmentApplications(fitment: NormalizedFitment): VehicleApplication[] {
  if (fitment.applications.length > 0) return fitment.applications;
  if (!fitment.make || fitment.status === "universal") return [];
  return [
    {
      vehicleType: fitment.vehicleType === "motorcycle" ? "motorcycle" : "car",
      make: fitment.make,
      models: fitment.models,
      chassisCodes: fitment.chassisCodes,
      yearRanges: fitment.yearRanges,
      engines: [],
      bodyStyles: [],
      drivetrains: [],
      markets: [],
    },
  ];
}

type ApplicationOverlay = {
  variantId: string | null;
  attributes: ShopProductAttributeDraft[];
};

function buildApplicationEvidence(
  product: KnowledgeSourceProduct,
  applicationIdentity: Omit<
    ShopVehicleApplicationDraft,
    "applicationKey" | "evidenceKey" | "contentHash"
  >,
  fitment: NormalizedFitment,
  uncorrelatedSourceApplication?: VehicleApplication
): ShopKnowledgeEvidenceDraft {
  const source = sourceForFitment(fitment);
  const excerpt = JSON.stringify({
    make: applicationIdentity.make,
    model: applicationIdentity.model,
    chassisCode: applicationIdentity.chassisCode,
    yearFrom: applicationIdentity.yearFrom,
    yearTo: applicationIdentity.yearTo,
    engine: applicationIdentity.engine,
    opfGpf: applicationIdentity.opfGpf,
    ...(uncorrelatedSourceApplication ? { uncorrelatedSourceApplication } : {}),
  });
  const evidenceIdentity = {
    productId: product.id,
    variantId: applicationIdentity.variantId,
    fieldPath: `applications.${hashKnowledgeValue(applicationIdentity).slice(0, 24)}`,
    source,
    sourceField:
      source === "manager" || source === "manual_fitment"
        ? `metafield:${NORMALIZED_FITMENT_NAMESPACE}.${NORMALIZED_FITMENT_KEY}`
        : "aggregate",
    locale: "neutral" as const,
    excerpt,
  };
  return {
    evidenceKey: hashKnowledgeValue(evidenceIdentity),
    ...evidenceIdentity,
    sourceHash: hashKnowledgeValue(excerpt),
    confidence: confidenceForFitment(fitment),
    verifiedAt: fitment.verifiedAt ? new Date(fitment.verifiedAt) : null,
    verifiedBy: fitment.verifiedBy,
    contentHash: hashKnowledgeValue({
      ...evidenceIdentity,
      confidence: confidenceForFitment(fitment),
      verifiedAt: fitment.verifiedAt,
      verifiedBy: fitment.verifiedBy,
    }),
  };
}

function buildApplicationRecords(
  product: KnowledgeSourceProduct,
  fitment: NormalizedFitment,
  categoryGroup: ShopKnowledgeBuild["categoryGroup"],
  overlay: ApplicationOverlay
): {
  applications: ShopVehicleApplicationDraft[];
  evidence: ShopKnowledgeEvidenceDraft[];
} {
  const source = sourceForFitment(fitment);
  const sourcePriority = priorityForSource(source);
  const confidence = confidenceForFitment(fitment);
  // A verified vehicle application proves only fields carried by that fitment
  // source. Category-adapter/description attributes are separate evidence and
  // must never be promoted merely because the vehicle row was manager-verified.
  const mayUseUnverifiedOverlay = fitment.status !== "verified" && fitment.status !== "universal";
  const productKind = mayUseUnverifiedOverlay
    ? stringAttribute(overlay.attributes, "productKind")
    : null;
  const material = mayUseUnverifiedOverlay ? stringAttribute(overlay.attributes, "material") : null;
  const fuel = mayUseUnverifiedOverlay ? stringAttribute(overlay.attributes, "fuel") : null;
  const attributeEngine = mayUseUnverifiedOverlay
    ? stringAttribute(overlay.attributes, "engine")
    : null;
  const opfGpf =
    (mayUseUnverifiedOverlay
      ? (stringAttribute(overlay.attributes, "opfGpf") as KnowledgeOpfGpf | null)
      : null) ?? "unknown";
  const status: ShopVehicleApplicationDraft["fitmentStatus"] =
    fitment.status === "verified"
      ? "verified"
      : fitment.status === "needs_review"
        ? "needs_review"
        : "inferred";
  const drafts: ShopVehicleApplicationDraft[] = [];
  const evidence: ShopKnowledgeEvidenceDraft[] = [];

  if (fitment.status === "universal") {
    const identity = {
      productId: product.id,
      variantId: overlay.variantId,
      scope: product.scope,
      vehicleType: "universal" as const,
      make: null,
      model: null,
      generation: null,
      chassisCode: null,
      yearFrom: null,
      yearTo: null,
      engine: attributeEngine,
      fuel,
      bodyStyle: null,
      drivetrain: null,
      transmission: null,
      market: null,
      opfGpf,
      categoryGroup,
      productKind,
      material,
      isUniversal: true,
      fitmentStatus: "verified" as const,
      source,
      sourcePriority,
      confidence,
    };
    const itemEvidence = buildApplicationEvidence(product, identity, fitment);
    const applicationKey = hashKnowledgeValue(identity);
    drafts.push({
      applicationKey,
      ...identity,
      evidenceKey: itemEvidence.evidenceKey,
      contentHash: hashKnowledgeValue({ ...identity, evidenceKey: itemEvidence.evidenceKey }),
    });
    evidence.push(itemEvidence);
    return { applications: drafts, evidence };
  }

  for (const application of fitmentApplications(fitment)) {
    const expansion = expandCorrelatedApplication(application, attributeEngine);
    for (const row of expansion.rows) {
      const identity = {
        productId: product.id,
        variantId: overlay.variantId,
        scope: product.scope,
        vehicleType: application.vehicleType,
        make: application.make,
        model: row.model,
        generation: row.chassisCode,
        chassisCode: row.chassisCode,
        yearFrom: row.yearFrom,
        yearTo: row.yearTo,
        engine: row.engine,
        fuel,
        bodyStyle: row.bodyStyle,
        drivetrain: row.drivetrain,
        transmission: null,
        market: row.market,
        opfGpf,
        categoryGroup,
        productKind,
        material,
        isUniversal: false,
        fitmentStatus: expansion.needsCorrelationReview ? ("needs_review" as const) : status,
        source,
        sourcePriority,
        confidence: expansion.needsCorrelationReview ? ("unknown" as const) : confidence,
      };
      const itemEvidence = buildApplicationEvidence(
        product,
        identity,
        fitment,
        expansion.needsCorrelationReview ? application : undefined
      );
      const applicationKey = hashKnowledgeValue(identity);
      drafts.push({
        applicationKey,
        ...identity,
        evidenceKey: itemEvidence.evidenceKey,
        contentHash: hashKnowledgeValue({
          ...identity,
          evidenceKey: itemEvidence.evidenceKey,
        }),
      });
      evidence.push(itemEvidence);
    }
  }

  const uniqueApplications = new Map(
    drafts.map((application) => [application.applicationKey, application])
  );
  const evidenceByKey = new Map(evidence.map((item) => [item.evidenceKey, item]));
  return {
    applications: Array.from(uniqueApplications.values()),
    evidence: Array.from(evidenceByKey.values()),
  };
}

const KNOWLEDGE_CATEGORY_GROUP_IDS = new Set<ShopKnowledgeBuild["categoryGroup"]>([
  "chipTuning",
  "exhaust",
  "brakes",
  "suspension",
  "cooling",
  "performance",
  "motoCarbon",
  "carbonAero",
  "wheels",
  "lighting",
  "interior",
  "accessories",
  "merch",
  "other",
]);

function managerApplicationCategoryGroup(
  value: string | null,
  fallback: ShopKnowledgeBuild["categoryGroup"]
): ShopKnowledgeBuild["categoryGroup"] {
  return value && KNOWLEDGE_CATEGORY_GROUP_IDS.has(value as ShopKnowledgeBuild["categoryGroup"])
    ? (value as ShopKnowledgeBuild["categoryGroup"])
    : fallback;
}

function managerApplicationConfidence(
  application: KnowledgeManagerApplicationSource
): KnowledgeConfidence {
  if (application.verificationStatus === "VERIFIED" && application.confidence >= 0.99) {
    return "verified";
  }
  if (application.confidence >= 0.85) return "high";
  if (application.confidence >= 0.6) return "medium";
  if (application.confidence > 0) return "low";
  return "unknown";
}

function managerApplicationOpfGpf(value: string | null): KnowledgeOpfGpf {
  return value === "with" || value === "without" ? value : "unknown";
}

function hasCanonicalManagerApplicationProvenance(
  application: KnowledgeManagerApplicationSource
): boolean {
  return application.evidence.some(
    (evidence) =>
      evidence.fieldPath.startsWith("vehicleApplications.") &&
      evidence.extractorVersion?.startsWith("admin-") === true
  );
}

function buildCanonicalManagerApplicationRecords(
  product: KnowledgeSourceProduct,
  fallbackCategoryGroup: ShopKnowledgeBuild["categoryGroup"]
): {
  applications: ShopVehicleApplicationDraft[];
  evidence: ShopKnowledgeEvidenceDraft[];
} {
  const applications: ShopVehicleApplicationDraft[] = [];
  const evidence: ShopKnowledgeEvidenceDraft[] = [];

  for (const sourceApplication of product.managerApplications.filter(
    hasCanonicalManagerApplicationProvenance
  )) {
    const sourceEvidence = sourceApplication.evidence[0];
    const excerpt =
      sourceEvidence?.excerpt?.trim() ||
      JSON.stringify({
        variantId: sourceApplication.variantId,
        scope: sourceApplication.scope,
        make: sourceApplication.make,
        model: sourceApplication.model,
        generation: sourceApplication.generation,
        chassisCode: sourceApplication.chassisCode,
        yearFrom: sourceApplication.yearFrom,
        yearTo: sourceApplication.yearTo,
        engine: sourceApplication.engine,
        fuel: sourceApplication.fuel,
        transmission: sourceApplication.transmission,
        opfGpf: sourceApplication.opfGpf,
        productKind: sourceApplication.productKind,
        material: sourceApplication.material,
      });
    const confidence = managerApplicationConfidence(sourceApplication);
    const verifiedAt = sourceEvidence?.verifiedAt ?? sourceApplication.verifiedAt;
    const verifiedBy = sourceEvidence?.verifiedById ?? sourceApplication.verifiedById;
    const evidenceKey =
      sourceEvidence?.evidenceKey ??
      hashKnowledgeValue({
        productId: product.id,
        applicationKey: sourceApplication.applicationKey,
        source: "manager",
        excerpt,
      });
    const evidenceDraft: ShopKnowledgeEvidenceDraft = {
      evidenceKey,
      productId: product.id,
      variantId: sourceApplication.variantId,
      fieldPath:
        sourceEvidence?.fieldPath ?? `vehicleApplications.${sourceApplication.applicationKey}`,
      source: "manager",
      sourceField: "canonical_manager_application",
      locale: "neutral",
      excerpt,
      sourceHash: sourceEvidence?.sourceHash ?? hashKnowledgeValue(excerpt),
      confidence,
      verifiedAt,
      verifiedBy,
      sourceRef: sourceEvidence?.sourceRef,
      extractorVersion: sourceEvidence?.extractorVersion ?? "admin-v1",
      isManagerVerified:
        sourceEvidence?.isManagerVerified ?? sourceApplication.verificationStatus === "VERIFIED",
      contentHash: hashKnowledgeValue({
        evidenceKey,
        excerpt,
        sourceHash: sourceEvidence?.sourceHash,
        sourceRef: sourceEvidence?.sourceRef,
        verifiedAt,
        verifiedBy,
      }),
    };
    const identity = {
      productId: product.id,
      variantId: sourceApplication.variantId,
      scope: sourceApplication.scope === "moto" ? "moto" : "auto",
      vehicleType: sourceApplication.isUniversal
        ? ("universal" as const)
        : sourceApplication.scope === "moto"
          ? ("motorcycle" as const)
          : ("car" as const),
      make: sourceApplication.isUniversal ? null : sourceApplication.make,
      model: sourceApplication.isUniversal ? null : sourceApplication.model,
      generation: sourceApplication.isUniversal ? null : sourceApplication.generation,
      chassisCode: sourceApplication.isUniversal ? null : sourceApplication.chassisCode,
      yearFrom: sourceApplication.isUniversal ? null : sourceApplication.yearFrom,
      yearTo: sourceApplication.isUniversal ? null : sourceApplication.yearTo,
      engine: sourceApplication.isUniversal ? null : sourceApplication.engine,
      fuel: sourceApplication.isUniversal ? null : sourceApplication.fuel,
      bodyStyle: sourceApplication.isUniversal ? null : sourceApplication.bodyStyle,
      drivetrain: sourceApplication.isUniversal ? null : sourceApplication.drivetrain,
      transmission: sourceApplication.isUniversal ? null : sourceApplication.transmission,
      market: sourceApplication.isUniversal ? null : sourceApplication.market,
      opfGpf: managerApplicationOpfGpf(sourceApplication.opfGpf),
      categoryGroup: managerApplicationCategoryGroup(
        sourceApplication.categoryGroup,
        fallbackCategoryGroup
      ),
      productKind: sourceApplication.productKind,
      material: sourceApplication.material,
      isUniversal: sourceApplication.isUniversal,
      fitmentStatus:
        sourceApplication.verificationStatus === "VERIFIED"
          ? ("verified" as const)
          : ("needs_review" as const),
      source: "manager" as const,
      sourcePriority: 1,
      confidence,
    };
    applications.push({
      applicationKey: sourceApplication.applicationKey,
      ...identity,
      evidenceKey,
      contentHash: hashKnowledgeValue({ ...identity, evidenceKey }),
    });
    evidence.push(evidenceDraft);
  }

  return { applications, evidence };
}

function normalizedApplicationValue(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function compatibleApplicationValue(left: string | null, right: string | null): boolean {
  const normalizedLeft = normalizedApplicationValue(left);
  const normalizedRight = normalizedApplicationValue(right);
  return !normalizedLeft || !normalizedRight || normalizedLeft === normalizedRight;
}

function applicationYearsOverlap(
  manager: ShopVehicleApplicationDraft,
  lowerPriority: ShopVehicleApplicationDraft
): boolean {
  const managerFrom = manager.yearFrom ?? Number.NEGATIVE_INFINITY;
  const managerTo = manager.yearTo ?? Number.POSITIVE_INFINITY;
  const lowerFrom = lowerPriority.yearFrom ?? Number.NEGATIVE_INFINITY;
  const lowerTo = lowerPriority.yearTo ?? Number.POSITIVE_INFINITY;
  return managerFrom <= lowerTo && lowerFrom <= managerTo;
}

function managerApplicationOverrides(
  manager: ShopVehicleApplicationDraft,
  lowerPriority: ShopVehicleApplicationDraft
): boolean {
  if (manager.scope !== lowerPriority.scope) return false;
  if (
    manager.variantId &&
    lowerPriority.variantId &&
    manager.variantId !== lowerPriority.variantId
  ) {
    return false;
  }
  if (manager.isUniversal || lowerPriority.isUniversal) return true;
  if (!compatibleApplicationValue(manager.make, lowerPriority.make)) return false;
  if (!compatibleApplicationValue(manager.model, lowerPriority.model)) return false;
  const managerPlatform = manager.chassisCode ?? manager.generation;
  const lowerPlatform = lowerPriority.chassisCode ?? lowerPriority.generation;
  if (!compatibleApplicationValue(managerPlatform, lowerPlatform)) return false;
  return applicationYearsOverlap(manager, lowerPriority);
}

function mergeCanonicalManagerApplications(
  managerApplications: ShopVehicleApplicationDraft[],
  lowerPriorityApplications: ShopVehicleApplicationDraft[]
): ShopVehicleApplicationDraft[] {
  const survivingLowerPriority = lowerPriorityApplications.filter(
    (lowerPriority) =>
      !managerApplications.some((manager) => managerApplicationOverrides(manager, lowerPriority))
  );
  return Array.from(
    new Map(
      [...managerApplications, ...survivingLowerPriority].map((application) => [
        application.applicationKey,
        application,
      ])
    ).values()
  );
}

function variantOptionValues(
  product: KnowledgeSourceProduct,
  variant: KnowledgeSourceProduct["variants"][number]
): Record<string, string> {
  const optionsByPosition = new Map(
    product.options.map((option) => [option.position, option.name] as const)
  );
  return Object.fromEntries(
    [
      [optionsByPosition.get(1) ?? "option1", variant.option1Value],
      [optionsByPosition.get(2) ?? "option2", variant.option2Value],
      [optionsByPosition.get(3) ?? "option3", variant.option3Value],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildVariantRecords(
  product: KnowledgeSourceProduct,
  categoryGroup: ShopKnowledgeBuild["categoryGroup"]
): {
  variants: ShopVariantKnowledgeDraft[];
  evidence: ShopKnowledgeEvidenceDraft[];
} {
  const variants: ShopVariantKnowledgeDraft[] = [];
  const evidence: ShopKnowledgeEvidenceDraft[] = [];
  for (const variant of product.variants
    .slice()
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))) {
    const optionValues = variantOptionValues(product, variant);
    const searchText = buildShopSearchText([
      product.brand,
      product.sku,
      product.titleUa,
      product.titleEn,
      variant.sku,
      variant.title,
      ...Object.entries(optionValues).flat(),
    ]);
    const extraction = extractCategoryAttributesFromText(
      product.id,
      [variant.sku, variant.title, ...Object.entries(optionValues).flat()]
        .filter(Boolean)
        .join(" | "),
      categoryGroup,
      variant.id
    );
    variants.push({
      variantId: variant.id,
      productId: product.id,
      sku: variant.sku,
      title: variant.title,
      position: variant.position,
      optionValues,
      attributes: extraction.attributes,
      searchText,
      contentHash: hashKnowledgeValue({
        productId: product.id,
        variantId: variant.id,
        sku: variant.sku,
        title: variant.title,
        position: variant.position,
        optionValues,
        attributes: extraction.attributes.map((attribute) => attribute.contentHash),
        searchText,
      }),
    });
    evidence.push(...extraction.evidence);
  }
  return { variants, evidence };
}

function latestSourceUpdatedAt(product: KnowledgeSourceProduct): Date {
  const timestamps = [
    product.updatedAt,
    ...product.variants.map((variant) => variant.updatedAt),
    ...product.options.map((option) => option.updatedAt),
    ...product.metafields.map((metafield) => metafield.updatedAt),
    ...product.managerApplications.flatMap((application) => [
      application.updatedAt,
      ...application.evidence.map((evidence) => evidence.updatedAt),
    ]),
  ].map((value) => value.getTime());
  return new Date(Math.max(...timestamps));
}

function hasLocalizedDescription(product: KnowledgeSourceProduct, locale: "ua" | "en"): boolean {
  const values =
    locale === "ua"
      ? [product.shortDescUa, product.longDescUa, product.bodyHtmlUa]
      : [product.shortDescEn, product.longDescEn, product.bodyHtmlEn];
  return values.some((value) => Boolean(htmlToKnowledgeText(value)));
}

function calculateCompleteness(
  product: KnowledgeSourceProduct,
  applications: ShopVehicleApplicationDraft[],
  categoryGroup: ShopKnowledgeBuild["categoryGroup"]
): number {
  let score = 0;
  if (htmlToKnowledgeText(product.titleUa)) score += 10;
  if (htmlToKnowledgeText(product.titleEn)) score += 10;
  if (htmlToKnowledgeText(product.categoryUa)) score += 5;
  if (htmlToKnowledgeText(product.categoryEn)) score += 5;
  if (hasLocalizedDescription(product, "ua")) score += 15;
  if (hasLocalizedDescription(product, "en")) score += 15;
  if (product.brand) score += 5;
  if (product.sku || product.variants.some((variant) => variant.sku)) score += 5;
  if (applications.length > 0) score += 20;
  if (categoryGroup !== "other") score += 10;
  return score;
}

function buildQualityFlags(
  product: KnowledgeSourceProduct,
  fitment: NormalizedFitment,
  categoryGroup: ShopKnowledgeBuild["categoryGroup"],
  missingHardKeys: string[],
  applications: ShopVehicleApplicationDraft[],
  correlationNeedsReview: boolean
): string[] {
  const flags: string[] = [];
  if (!htmlToKnowledgeText(product.titleUa)) flags.push("missing_title_ua");
  if (!htmlToKnowledgeText(product.titleEn)) flags.push("missing_title_en");
  if (!hasLocalizedDescription(product, "ua")) flags.push("missing_description_ua");
  if (!hasLocalizedDescription(product, "en")) flags.push("missing_description_en");
  if (!product.brand) flags.push("missing_brand");
  if (!product.sku && !product.variants.some((variant) => variant.sku)) flags.push("missing_sku");
  if (
    fitment.status === "needs_review" ||
    applications.some((application) => application.fitmentStatus === "needs_review")
  ) {
    flags.push("fitment_needs_review");
  }
  if (correlationNeedsReview) {
    flags.push("fitment_correlation_needs_review");
  }
  if (!product.managerStrictBlock && applications.length === 0) {
    flags.push("missing_fitment");
  }
  if (product.managerStrictBlock) flags.push("blocked_strict:manager");
  if (categoryGroup === "other") flags.push("category_other");
  flags.push(...missingHardKeys.map((key) => `missing_hard_attribute:${key}`));
  return Array.from(new Set(flags)).sort();
}

function resolveMissingHardKeys(
  missingHardKeys: string[],
  attributes: ShopProductAttributeDraft[],
  variants: ShopVariantKnowledgeDraft[],
  applications: ShopVehicleApplicationDraft[]
): string[] {
  const variantAttributeKeys = new Set(
    variants.flatMap((variant) => variant.attributes.map((attribute) => attribute.key))
  );
  const applicationHasValue = (key: string) =>
    applications.some((application) => {
      switch (key) {
        case "make":
          return Boolean(application.make);
        case "model":
          return Boolean(application.model);
        case "generation":
          return Boolean(application.generation);
        case "chassisCode":
          return Boolean(application.chassisCode);
        case "yearFrom":
          return application.yearFrom !== null;
        case "engine":
          return Boolean(application.engine);
        case "market":
          return Boolean(application.market);
        case "bodyStyle":
          return Boolean(application.bodyStyle);
        case "drivetrain":
          return Boolean(application.drivetrain);
        case "transmission":
          return Boolean(application.transmission);
        case "fuel":
          return Boolean(application.fuel);
        case "opfGpf":
          return application.opfGpf !== "unknown";
        case "productKind":
          return Boolean(application.productKind);
        case "material":
          return Boolean(application.material);
        default:
          return false;
      }
    });
  return missingHardKeys.filter((key) => {
    if (attributes.some((attribute) => attribute.key === key)) return false;
    if (applicationHasValue(key)) return false;
    if (variantAttributeKeys.has(key)) return false;
    return true;
  });
}

export function buildShopKnowledgeV2(product: KnowledgeSourceProduct): ShopKnowledgeBuild {
  const categoryExtraction = extractCategoryAttributes(product);
  const fitment = resolveFitment(product);
  const variantBuild = buildVariantRecords(product, categoryExtraction.categoryGroup);
  const canonicalManagerBuild = buildCanonicalManagerApplicationRecords(
    product,
    categoryExtraction.categoryGroup
  );
  const baseApplicationBuild = buildApplicationRecords(
    product,
    fitment,
    categoryExtraction.categoryGroup,
    { variantId: null, attributes: categoryExtraction.attributes }
  );
  const variantApplicationBuilds = variantBuild.variants
    .filter((variant) =>
      variant.attributes.some((attribute) =>
        ["engine", "fuel", "material", "opfGpf", "productKind"].includes(attribute.key)
      )
    )
    .map((variant) =>
      buildApplicationRecords(product, fitment, categoryExtraction.categoryGroup, {
        variantId: variant.variantId,
        attributes: [...variant.attributes, ...categoryExtraction.attributes],
      })
    );
  const lowerPriorityApplications = [
    ...baseApplicationBuild.applications,
    ...variantApplicationBuilds.flatMap((item) => item.applications),
  ];
  const applications = product.managerStrictBlock
    ? []
    : mergeCanonicalManagerApplications(
        canonicalManagerBuild.applications,
        lowerPriorityApplications
      );
  const activeApplicationEvidenceKeys = new Set(
    applications.map((application) => application.evidenceKey)
  );
  const generatedApplicationEvidence = [
    ...baseApplicationBuild.evidence,
    ...variantApplicationBuilds.flatMap((item) => item.evidence),
  ].filter((item) => activeApplicationEvidenceKeys.has(item.evidenceKey));
  const survivingApplicationKeys = new Set(
    applications.map((application) => application.applicationKey)
  );
  const correlationNeedsReview =
    fitmentApplications(fitment).some(hasAmbiguousApplicationCorrelation) &&
    lowerPriorityApplications.some(
      (application) =>
        survivingApplicationKeys.has(application.applicationKey) &&
        application.fitmentStatus === "needs_review"
    );
  const chunks = buildKnowledgeChunks(product);
  const missingHardKeys = resolveMissingHardKeys(
    categoryExtraction.missingHardKeys,
    categoryExtraction.attributes,
    variantBuild.variants,
    applications
  );
  const qualityFlags = buildQualityFlags(
    product,
    fitment,
    categoryExtraction.categoryGroup,
    missingHardKeys,
    applications,
    correlationNeedsReview
  );
  const status =
    product.managerStrictBlock || !product.isPublished || product.status !== "ACTIVE"
      ? ("BLOCKED" as const)
      : qualityFlags.length > 0
        ? ("NEEDS_REVIEW" as const)
        : ("READY" as const);
  const searchText = buildShopSearchText([
    ...collectKnowledgeTextSources(product).map((source) => source.text),
    ...categoryExtraction.attributes.flatMap((attribute) => [
      attribute.key,
      Array.isArray(attribute.value) ? attribute.value.join(" ") : String(attribute.value),
    ]),
    ...applications.flatMap((application) => [
      application.make,
      application.model,
      application.generation,
      application.chassisCode,
      application.engine,
      application.fuel,
      application.transmission,
      application.market,
      application.opfGpf,
      application.productKind,
      application.material,
    ]),
  ]);
  const evidence = new Map(
    [
      ...categoryExtraction.evidence,
      ...variantBuild.evidence,
      ...canonicalManagerBuild.evidence,
      ...generatedApplicationEvidence,
    ].map((item) => [item.evidenceKey, item])
  );
  const sourceUpdatedAt = latestSourceUpdatedAt(product);
  const contentIdentity = {
    schemaVersion: SHOP_KNOWLEDGE_V2_SCHEMA_VERSION,
    extractorVersion: SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
    productId: product.id,
    categoryGroup: categoryExtraction.categoryGroup,
    status,
    completenessScore: calculateCompleteness(
      product,
      applications,
      categoryExtraction.categoryGroup
    ),
    qualityFlags,
    searchText,
    applications: applications.map((application) => application.contentHash).sort(),
    variants: variantBuild.variants.map((variant) => variant.contentHash).sort(),
    chunks: chunks.map((chunk) => chunk.contentHash).sort(),
    attributes: categoryExtraction.attributes.map((attribute) => attribute.contentHash).sort(),
    evidence: Array.from(evidence.values())
      .map((item) => item.contentHash)
      .sort(),
  };

  return {
    productId: product.id,
    schemaVersion: SHOP_KNOWLEDGE_V2_SCHEMA_VERSION,
    extractorVersion: SHOP_KNOWLEDGE_V2_EXTRACTOR_VERSION,
    sourceUpdatedAt,
    categoryGroup: categoryExtraction.categoryGroup,
    status,
    completenessScore: contentIdentity.completenessScore,
    qualityFlags,
    searchText,
    applications,
    variants: variantBuild.variants,
    chunks,
    attributes: categoryExtraction.attributes,
    evidence: Array.from(evidence.values()),
    contentHash: hashKnowledgeValue(contentIdentity),
  };
}
