import { createHash } from "node:crypto";

export const SHOP_CATALOG_BASELINE_VERSION = 1 as const;

const RELATION_KEYS = new Set([
  "applications",
  "attributeValues",
  "bundle",
  "bundleComponentItems",
  "cartItems",
  "collections",
  "evidence",
  "knowledge",
  "knowledgeAttributeValues",
  "knowledgeChunks",
  "knowledgeEvidence",
  "knowledgeOutboxEvents",
  "knowledgeReviewTasks",
  "knowledgeRevisions",
  "media",
  "metafields",
  "options",
  "orderItems",
  "variantKnowledge",
  "variants",
  "vehicleApplications",
]);

const OPERATIONAL_KEYS = new Set([
  "airtableSyncedAt",
  "createdAt",
  "indexedAt",
  "statusChangedAt",
  "updatedAt",
]);

const PRICE_KEY = /^(?:compareAt|costPerItem|price)/i;
const LOCALE_KEY = /(?:Ua|En)$/;

type CanonicalScalar = boolean | number | string | null;
export interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}
export type CanonicalValue = CanonicalScalar | readonly CanonicalValue[] | CanonicalObject;

export type CatalogBaselineInput = Readonly<Record<string, unknown>>;

export interface CatalogBaselineCounts {
  readonly products: number;
  readonly productsWithSku: number;
  readonly variants: number;
  readonly variantsWithSku: number;
  readonly media: number;
  readonly priceValues: number;
  readonly collections: number;
  readonly tags: number;
  readonly options: number;
  readonly metafields: number;
  readonly applications: number;
  readonly evidence: number;
  readonly knowledge: number;
  readonly variantKnowledge: number;
  readonly variantApplications: number;
  readonly bundles: number;
  readonly bundleItems: number;
  readonly bundleComponentUsages: number;
  readonly productAttributeValues: number;
  readonly variantAttributeValues: number;
  readonly knowledgeChunks: number;
  readonly knowledgeRevisions: number;
  readonly knowledgeReviewTasks: number;
  readonly knowledgeOutboxEvents: number;
  readonly inventoryLevels: number;
  readonly cartReferences: number;
  readonly orderReferences: number;
}

export interface CatalogBaselineProductEntry {
  readonly productId: string;
  readonly slug: string | null;
  readonly sku: string | null;
  readonly hashes: Readonly<{
    scalars: string;
    locales: string;
    prices: string;
    tags: string;
    variants: string;
    media: string;
    collections: string;
    options: string;
    metafields: string;
    applications: string;
    evidence: string;
    knowledge: string;
    variantKnowledge: string;
    variantApplications: string;
    bundle: string;
    bundleComponentItems: string;
    attributeValues: string;
    knowledgeChunks: string;
    knowledgeRevisions: string;
    knowledgeReviewTasks: string;
    knowledgeOutboxEvents: string;
    inventoryLevels: string;
    dependencyReferences: string;
    content: string;
    full: string;
  }>;
  readonly counts: Readonly<Omit<CatalogBaselineCounts, "products" | "productsWithSku">>;
  readonly variantIdentities: readonly Readonly<{
    id: string | null;
    sku: string | null;
    hash: string;
  }>[];
  readonly dependencyReferences: Readonly<{
    bundleComponentProductIds: readonly string[];
    bundleComponentVariantIds: readonly string[];
    bundleUsageBundleIds: readonly string[];
    cartItems: readonly Readonly<{
      id: string;
      productId: string | null;
      variantId: string | null;
      productSlug: string | null;
    }>[];
    orderItems: readonly Readonly<{
      id: string;
      productId: string | null;
      variantId: string | null;
      productSlug: string | null;
    }>[];
  }>;
}

export interface ShopCatalogLossLedger {
  readonly version: typeof SHOP_CATALOG_BASELINE_VERSION;
  readonly fingerprint: string;
  readonly contentFingerprint: string;
  readonly identityFingerprint: string;
  readonly counts: Readonly<CatalogBaselineCounts>;
  readonly identityIssues: Readonly<{
    productsMissingSku: number;
    variantsMissingId: number;
    variantsMissingSku: number;
    duplicateVariantIds: readonly string[];
    duplicateProductSkus: readonly string[];
    duplicateVariantSkus: readonly string[];
  }>;
  readonly dependencyIssues: Readonly<{
    missingBundleComponentProductIds: readonly string[];
    missingBundleComponentVariantIds: readonly string[];
    unknownCartProductIds: readonly string[];
    unknownCartVariantIds: readonly string[];
    cartProductVariantMismatches: readonly string[];
    unknownOrderProductIds: readonly string[];
    unknownOrderVariantIds: readonly string[];
    orderProductVariantMismatches: readonly string[];
  }>;
  readonly products: readonly CatalogBaselineProductEntry[];
}

export interface CatalogBaselineDiff {
  readonly unchanged: boolean;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly addedProductIds: readonly string[];
  readonly removedProductIds: readonly string[];
  readonly changedProducts: readonly Readonly<{
    productId: string;
    changedSections: readonly string[];
  }>[];
  readonly countChanges: Readonly<Record<string, Readonly<{ before: number; after: number }>>>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeInternal(value: unknown, seen: Set<object>): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return { $number: "NaN" };
    if (value === Infinity) return { $number: "Infinity" };
    if (value === -Infinity) return { $number: "-Infinity" };
    if (Object.is(value, -0)) return { $number: "-0" };
    return value;
  }
  if (typeof value === "bigint") return { $bigint: value.toString() };
  if (typeof value === "undefined") return { $undefined: true };
  if (typeof value === "symbol" || typeof value === "function") {
    throw new TypeError(`Unsupported baseline value: ${typeof value}`);
  }
  if (value instanceof Date) return { $date: value.toISOString() };
  if (seen.has(value)) throw new TypeError("Catalog baseline input must not contain cycles");
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalizeInternal(item, seen));

    const serializable = value as { toJSON?: () => unknown };
    if (typeof serializable.toJSON === "function") {
      const jsonValue = serializable.toJSON();
      if (jsonValue !== value) return canonicalizeInternal(jsonValue, seen);
    }

    const record = value as Record<string, unknown>;
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(record).sort()) {
      result[key] = canonicalizeInternal(record[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function canonicalizeCatalogBaselineValue(value: unknown): CanonicalValue {
  return canonicalizeInternal(value, new Set());
}

export function stableCatalogBaselineJson(value: unknown): string {
  return JSON.stringify(canonicalizeCatalogBaselineValue(value));
}

export function hashCatalogBaselineValue(value: unknown): string {
  return createHash("sha256").update(stableCatalogBaselineJson(value)).digest("hex");
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sortByIdentity(records: readonly Record<string, unknown>[], keys: readonly string[]) {
  return [...records].sort((left, right) => {
    for (const key of keys) {
      const comparison = stableCatalogBaselineJson(left[key]).localeCompare(
        stableCatalogBaselineJson(right[key])
      );
      if (comparison !== 0) return comparison;
    }
    return stableCatalogBaselineJson(left).localeCompare(stableCatalogBaselineJson(right));
  });
}

function omitOperational(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitOperational);
  if (!isPlainRecord(value) || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !OPERATIONAL_KEYS.has(key))
      .map(([key, nested]) => [key, omitOperational(nested)])
  );
}

function project(record: Record<string, unknown>, predicate: (key: string) => boolean) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => predicate(key)));
}

function countPresentPrices(record: Record<string, unknown>): number {
  return Object.entries(record).filter(
    ([key, value]) => PRICE_KEY.test(key) && value !== null && value !== undefined
  ).length;
}

function nestedKnowledge(product: CatalogBaselineInput): Record<string, unknown> | null {
  return isPlainRecord(product.knowledge) ? product.knowledge : null;
}

function mergeRecordLists(...values: readonly unknown[]): Record<string, unknown>[] {
  const merged = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    for (const record of asRecords(value)) {
      const identity = stringOrNull(record.id) ?? stableCatalogBaselineJson(record);
      if (!merged.has(identity)) merged.set(identity, record);
    }
  }
  return [...merged.values()];
}

function relationRecords(product: CatalogBaselineInput, key: string): Record<string, unknown>[] {
  const knowledge = nestedKnowledge(product);
  if (key === "applications") {
    const variantApplications = asRecords(product.variantKnowledge).flatMap((variant) =>
      asRecords(variant.applications)
    );
    return mergeRecordLists(
      product.applications,
      product.vehicleApplications,
      knowledge?.vehicleApplications,
      variantApplications
    );
  }
  if (key === "evidence") {
    const variantEvidence = asRecords(product.variantKnowledge).flatMap((variant) =>
      asRecords(variant.evidence)
    );
    return mergeRecordLists(
      product.evidence,
      product.knowledgeEvidence,
      knowledge?.evidence,
      variantEvidence
    );
  }
  if (key === "variantKnowledge") {
    return mergeRecordLists(product.variantKnowledge, knowledge?.variantKnowledge);
  }
  if (key === "attributeValues") {
    const variantAttributes = asRecords(product.variantKnowledge).flatMap((variant) =>
      asRecords(variant.attributeValues)
    );
    return mergeRecordLists(
      product.attributeValues,
      product.knowledgeAttributeValues,
      knowledge?.attributeValues,
      variantAttributes
    );
  }
  if (key === "knowledgeChunks") {
    const variantChunks = asRecords(product.variantKnowledge).flatMap((variant) =>
      asRecords(variant.chunks)
    );
    return mergeRecordLists(product.knowledgeChunks, knowledge?.chunks, variantChunks);
  }
  if (key === "knowledgeRevisions") {
    return mergeRecordLists(product.knowledgeRevisions, knowledge?.revisions);
  }
  if (key === "knowledgeReviewTasks") {
    const variantTasks = asRecords(product.variants).flatMap((variant) =>
      asRecords(variant.knowledgeReviewTasks)
    );
    const applicationTasks = asRecords(product.vehicleApplications).flatMap((application) =>
      asRecords(application.reviewTasks)
    );
    const attributeTasks = asRecords(product.knowledgeAttributeValues).flatMap((attribute) =>
      asRecords(attribute.reviewTasks)
    );
    return mergeRecordLists(
      product.knowledgeReviewTasks,
      knowledge?.reviewTasks,
      variantTasks,
      applicationTasks,
      attributeTasks
    );
  }
  if (key === "knowledgeOutboxEvents") {
    return mergeRecordLists(product.knowledgeOutboxEvents, knowledge?.outboxEvents);
  }
  return asRecords(product[key]);
}

function omitRecordKeys(record: Record<string, unknown>, keys: ReadonlySet<string>) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));
}

const VARIANT_RELATION_KEYS = new Set([
  "bundleComponentItems",
  "cartItems",
  "inventoryLevels",
  "knowledge",
  "knowledgeAttributeValues",
  "knowledgeReviewTasks",
  "vehicleApplications",
]);
const VARIANT_KNOWLEDGE_RELATION_KEYS = new Set([
  "applications",
  "attributeValues",
  "chunks",
  "evidence",
]);
const APPLICATION_RELATION_KEYS = new Set([
  "evidence",
  "knowledge",
  "product",
  "reviewTasks",
  "variant",
  "variantKnowledge",
  "vehicleGeneration",
]);
const ATTRIBUTE_VALUE_RELATION_KEYS = new Set([
  "evidence",
  "knowledge",
  "product",
  "reviewTasks",
  "variant",
  "variantKnowledge",
]);
const BUNDLE_ITEM_RELATION_KEYS = new Set(["bundle", "componentProduct", "componentVariant"]);

function referenceFields(value: unknown, keys: readonly string[]) {
  if (!isPlainRecord(value)) return null;
  return Object.fromEntries(keys.map((key) => [key, value[key] ?? null]));
}

function normalizeBundleItem(record: Record<string, unknown>) {
  return {
    ...omitRecordKeys(record, BUNDLE_ITEM_RELATION_KEYS),
    componentProductRef: referenceFields(record.componentProduct, ["id", "slug", "sku"]),
    componentVariantRef: referenceFields(record.componentVariant, ["id", "productId", "sku"]),
    bundleRef: referenceFields(record.bundle, ["id", "productId"]),
  };
}

function normalizeDependencyReferences(values: readonly Record<string, unknown>[], label: string) {
  const references = new Map<
    string,
    { id: string; productId: string | null; variantId: string | null; productSlug: string | null }
  >();
  for (const value of values) {
    const id = stringOrNull(value.id);
    if (!id) throw new TypeError(`${label} dependency reference must have a stable id`);
    const reference = {
      id,
      productId: stringOrNull(value.productId),
      variantId: stringOrNull(value.variantId),
      productSlug: stringOrNull(value.productSlug),
    };
    const existing = references.get(id);
    if (existing && stableCatalogBaselineJson(existing) !== stableCatalogBaselineJson(reference)) {
      throw new TypeError(`Conflicting ${label} dependency reference: ${id}`);
    }
    references.set(id, reference);
  }
  return [...references.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeProduct(product: CatalogBaselineInput) {
  const scalars = Object.fromEntries(
    Object.entries(product).filter(([key]) => !RELATION_KEYS.has(key))
  );
  const rawVariants = relationRecords(product, "variants");
  const inventoryLevels = sortByIdentity(
    rawVariants.flatMap((variant) => asRecords(variant.inventoryLevels)),
    ["variantId", "locationId", "id"]
  );
  const variants = sortByIdentity(
    rawVariants.map((variant) => omitRecordKeys(variant, VARIANT_RELATION_KEYS)),
    ["id", "position", "sku"]
  );
  const media = sortByIdentity(relationRecords(product, "media"), ["position", "id", "src"]);
  const collections = sortByIdentity(relationRecords(product, "collections"), [
    "collectionId",
    "sortOrder",
    "id",
  ]);
  const options = sortByIdentity(relationRecords(product, "options"), ["position", "id", "name"]);
  const metafields = sortByIdentity(relationRecords(product, "metafields"), [
    "namespace",
    "key",
    "id",
  ]);
  const applications = sortByIdentity(
    relationRecords(product, "applications").map((application) =>
      omitRecordKeys(application, APPLICATION_RELATION_KEYS)
    ),
    ["applicationKey", "revision", "id"]
  );
  const variantApplications = applications.filter(
    (application) =>
      stringOrNull(application.variantId) !== null ||
      stringOrNull(application.variantKnowledgeId) !== null
  );
  const evidence = sortByIdentity(relationRecords(product, "evidence"), [
    "evidenceKey",
    "revision",
    "id",
  ]);
  const variantKnowledge = sortByIdentity(
    relationRecords(product, "variantKnowledge").map((record) =>
      omitRecordKeys(record, VARIANT_KNOWLEDGE_RELATION_KEYS)
    ),
    ["variantId", "revision", "id"]
  );
  const attributeValues = sortByIdentity(
    relationRecords(product, "attributeValues").map((attribute) =>
      omitRecordKeys(attribute, ATTRIBUTE_VALUE_RELATION_KEYS)
    ),
    ["valueKey", "revision", "id"]
  );
  const knowledgeChunks = sortByIdentity(relationRecords(product, "knowledgeChunks"), [
    "chunkKey",
    "revision",
    "id",
  ]);
  const knowledgeRevisions = sortByIdentity(relationRecords(product, "knowledgeRevisions"), [
    "revision",
    "id",
  ]);
  const knowledgeReviewTasks = sortByIdentity(relationRecords(product, "knowledgeReviewTasks"), [
    "id",
  ]);
  const knowledgeOutboxEvents = sortByIdentity(relationRecords(product, "knowledgeOutboxEvents"), [
    "dedupeKey",
    "id",
  ]);
  const bundleRecord = isPlainRecord(product.bundle) ? product.bundle : null;
  const bundleItems = sortByIdentity(asRecords(bundleRecord?.items).map(normalizeBundleItem), [
    "position",
    "id",
  ]);
  const bundle = bundleRecord
    ? {
        ...omitRecordKeys(bundleRecord, new Set(["items", "product"])),
        items: bundleItems,
      }
    : null;
  const bundleComponentItems = sortByIdentity(
    relationRecords(product, "bundleComponentItems").map(normalizeBundleItem),
    ["bundleId", "position", "id"]
  );
  const knowledge = nestedKnowledge(product);
  const knowledgeWithoutRelations = knowledge
    ? Object.fromEntries(
        Object.entries(knowledge).filter(
          ([key]) =>
            ![
              "attributeValues",
              "chunks",
              "evidence",
              "outboxEvents",
              "reviewTasks",
              "revisions",
              "variantKnowledge",
              "vehicleApplications",
            ].includes(key)
        )
      )
    : null;
  const tags = Array.isArray(scalars.tags)
    ? [...scalars.tags].sort((left, right) =>
        stableCatalogBaselineJson(left).localeCompare(stableCatalogBaselineJson(right))
      )
    : [];
  if (Array.isArray(scalars.tags)) scalars.tags = tags;
  const prices = {
    product: project(scalars, (key) => PRICE_KEY.test(key)),
    variants: variants.map((variant) => ({
      id: variant.id ?? null,
      sku: variant.sku ?? null,
      prices: project(variant, (key) => PRICE_KEY.test(key)),
    })),
  };
  const locales = project(scalars, (key) => LOCALE_KEY.test(key));
  const cartReferences = normalizeDependencyReferences(
    mergeRecordLists(
      product.cartItems,
      rawVariants.flatMap((variant) => asRecords(variant.cartItems))
    ),
    "cart"
  );
  const orderReferences = normalizeDependencyReferences(
    mergeRecordLists(
      product.orderItems,
      rawVariants.flatMap((variant) => asRecords(variant.orderItems))
    ),
    "order"
  );
  const dependencyReferences = {
    bundleComponentProductIds: [...bundleItems, ...bundleComponentItems]
      .map((item) => stringOrNull(item.componentProductId))
      .filter((value): value is string => value !== null)
      .sort(),
    bundleComponentVariantIds: [...bundleItems, ...bundleComponentItems]
      .map((item) => stringOrNull(item.componentVariantId))
      .filter((value): value is string => value !== null)
      .sort(),
    bundleUsageBundleIds: bundleComponentItems
      .map((item) => stringOrNull(item.bundleId))
      .filter((value): value is string => value !== null)
      .sort(),
    cartItems: cartReferences,
    orderItems: orderReferences,
  };
  const full = {
    scalars,
    variants,
    media,
    collections,
    options,
    metafields,
    applications,
    evidence,
    knowledge: knowledgeWithoutRelations,
    variantKnowledge,
    variantApplications,
    bundle,
    bundleComponentItems,
    attributeValues,
    knowledgeChunks,
    knowledgeRevisions,
    knowledgeReviewTasks,
    knowledgeOutboxEvents,
    inventoryLevels,
    dependencyReferences,
  };
  return {
    scalars,
    variants,
    media,
    collections,
    options,
    metafields,
    applications,
    evidence,
    knowledge: knowledgeWithoutRelations,
    variantKnowledge,
    variantApplications,
    bundle,
    bundleItems,
    bundleComponentItems,
    attributeValues,
    knowledgeChunks,
    knowledgeRevisions,
    knowledgeReviewTasks,
    knowledgeOutboxEvents,
    inventoryLevels,
    dependencyReferences,
    tags,
    prices,
    locales,
    full,
  };
}

function duplicateNonNull(values: readonly (string | null)[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

export function buildShopCatalogBaselineProductEntry(
  product: CatalogBaselineInput
): CatalogBaselineProductEntry {
  const productId = stringOrNull(product.id);
  if (!productId) throw new TypeError("Every catalog baseline product must have a stable id");
  const normalized = normalizeProduct(product);
  const variantIdentities = normalized.variants.map((variant) => ({
    id: stringOrNull(variant.id),
    sku: stringOrNull(variant.sku),
    hash: hashCatalogBaselineValue({ id: variant.id ?? null, sku: variant.sku ?? null }),
  }));
  const priceValues =
    countPresentPrices(normalized.scalars) +
    normalized.variants.reduce((sum, variant) => sum + countPresentPrices(variant), 0);
  const hashes = {
    scalars: hashCatalogBaselineValue(normalized.scalars),
    locales: hashCatalogBaselineValue(normalized.locales),
    prices: hashCatalogBaselineValue(normalized.prices),
    tags: hashCatalogBaselineValue(normalized.tags),
    variants: hashCatalogBaselineValue(normalized.variants),
    media: hashCatalogBaselineValue(normalized.media),
    collections: hashCatalogBaselineValue(normalized.collections),
    options: hashCatalogBaselineValue(normalized.options),
    metafields: hashCatalogBaselineValue(normalized.metafields),
    applications: hashCatalogBaselineValue(normalized.applications),
    evidence: hashCatalogBaselineValue(normalized.evidence),
    knowledge: hashCatalogBaselineValue(normalized.knowledge),
    variantKnowledge: hashCatalogBaselineValue(normalized.variantKnowledge),
    variantApplications: hashCatalogBaselineValue(normalized.variantApplications),
    bundle: hashCatalogBaselineValue(normalized.bundle),
    bundleComponentItems: hashCatalogBaselineValue(normalized.bundleComponentItems),
    attributeValues: hashCatalogBaselineValue(normalized.attributeValues),
    knowledgeChunks: hashCatalogBaselineValue(normalized.knowledgeChunks),
    knowledgeRevisions: hashCatalogBaselineValue(normalized.knowledgeRevisions),
    knowledgeReviewTasks: hashCatalogBaselineValue(normalized.knowledgeReviewTasks),
    knowledgeOutboxEvents: hashCatalogBaselineValue(normalized.knowledgeOutboxEvents),
    inventoryLevels: hashCatalogBaselineValue(normalized.inventoryLevels),
    dependencyReferences: hashCatalogBaselineValue(normalized.dependencyReferences),
    content: hashCatalogBaselineValue(omitOperational(normalized.full)),
    full: hashCatalogBaselineValue(normalized.full),
  };
  return deepFreeze({
    productId,
    slug: stringOrNull(product.slug),
    sku: stringOrNull(product.sku),
    hashes,
    counts: {
      variants: normalized.variants.length,
      variantsWithSku: variantIdentities.filter(({ sku }) => sku !== null).length,
      media: normalized.media.length,
      priceValues,
      collections: normalized.collections.length,
      tags: normalized.tags.length,
      options: normalized.options.length,
      metafields: normalized.metafields.length,
      applications: normalized.applications.length,
      evidence: normalized.evidence.length,
      knowledge: normalized.knowledge ? 1 : 0,
      variantKnowledge: normalized.variantKnowledge.length,
      variantApplications: normalized.variantApplications.length,
      bundles: normalized.bundle ? 1 : 0,
      bundleItems: normalized.bundleItems.length,
      bundleComponentUsages: normalized.bundleComponentItems.length,
      productAttributeValues: normalized.attributeValues.filter(
        (attribute) => stringOrNull(attribute.variantId) === null
      ).length,
      variantAttributeValues: normalized.attributeValues.filter(
        (attribute) => stringOrNull(attribute.variantId) !== null
      ).length,
      knowledgeChunks: normalized.knowledgeChunks.length,
      knowledgeRevisions: normalized.knowledgeRevisions.length,
      knowledgeReviewTasks: normalized.knowledgeReviewTasks.length,
      knowledgeOutboxEvents: normalized.knowledgeOutboxEvents.length,
      inventoryLevels: normalized.inventoryLevels.length,
      cartReferences: normalized.dependencyReferences.cartItems.length,
      orderReferences: normalized.dependencyReferences.orderItems.length,
    },
    variantIdentities,
    dependencyReferences: normalized.dependencyReferences,
  });
}

export function buildShopCatalogLossLedgerFromEntries(
  entries: readonly CatalogBaselineProductEntry[]
): ShopCatalogLossLedger {
  const products = [...entries].sort((left, right) =>
    left.productId.localeCompare(right.productId)
  );
  for (let index = 1; index < products.length; index += 1) {
    if (products[index - 1].productId === products[index].productId) {
      throw new TypeError(`Duplicate catalog product id: ${products[index].productId}`);
    }
  }
  const countKeys = [
    "variants",
    "variantsWithSku",
    "media",
    "priceValues",
    "collections",
    "tags",
    "options",
    "metafields",
    "applications",
    "evidence",
    "knowledge",
    "variantKnowledge",
    "variantApplications",
    "bundles",
    "bundleItems",
    "bundleComponentUsages",
    "productAttributeValues",
    "variantAttributeValues",
    "knowledgeChunks",
    "knowledgeRevisions",
    "knowledgeReviewTasks",
    "knowledgeOutboxEvents",
    "inventoryLevels",
    "cartReferences",
    "orderReferences",
  ] as const;
  const counts = {
    products: products.length,
    productsWithSku: products.filter(({ sku }) => sku !== null).length,
    ...Object.fromEntries(
      countKeys.map((key) => [key, products.reduce((sum, product) => sum + product.counts[key], 0)])
    ),
  } as unknown as CatalogBaselineCounts;
  const variantIdentities = products.flatMap((product) => product.variantIdentities);
  const knownProductIds = new Set(products.map((product) => product.productId));
  const knownVariantIds = new Set(
    variantIdentities.map(({ id }) => id).filter((id): id is string => id !== null)
  );
  const variantOwners = new Map<string, string>();
  for (const product of products) {
    for (const variant of product.variantIdentities) {
      if (variant.id) variantOwners.set(variant.id, product.productId);
    }
  }
  const missingDependencyIds = (
    values: readonly (string | null)[],
    knownIds: ReadonlySet<string>
  ) => [...new Set(values.filter((id): id is string => id !== null && !knownIds.has(id)))].sort();
  const identityProjection = products.map((product) => ({
    id: product.productId,
    sku: product.sku,
    variants: product.variantIdentities.map(({ id, sku }) => ({ id, sku })),
  }));
  const ledger = {
    version: SHOP_CATALOG_BASELINE_VERSION,
    fingerprint: hashCatalogBaselineValue(
      products.map(({ productId, hashes }) => ({ productId, hash: hashes.full }))
    ),
    contentFingerprint: hashCatalogBaselineValue(
      products.map(({ productId, hashes }) => ({ productId, hash: hashes.content }))
    ),
    identityFingerprint: hashCatalogBaselineValue(identityProjection),
    counts,
    identityIssues: {
      productsMissingSku: products.length - counts.productsWithSku,
      variantsMissingId: variantIdentities.filter(({ id }) => id === null).length,
      variantsMissingSku: variantIdentities.filter(({ sku }) => sku === null).length,
      duplicateVariantIds: duplicateNonNull(variantIdentities.map(({ id }) => id)),
      duplicateProductSkus: duplicateNonNull(products.map(({ sku }) => sku)),
      duplicateVariantSkus: duplicateNonNull(variantIdentities.map(({ sku }) => sku)),
    },
    dependencyIssues: {
      missingBundleComponentProductIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.bundleComponentProductIds.map((id) => id)
        ),
        knownProductIds
      ),
      missingBundleComponentVariantIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.bundleComponentVariantIds.map((id) => id)
        ),
        knownVariantIds
      ),
      unknownCartProductIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.cartItems.map(({ productId }) => productId)
        ),
        knownProductIds
      ),
      unknownCartVariantIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.cartItems.map(({ variantId }) => variantId)
        ),
        knownVariantIds
      ),
      cartProductVariantMismatches: products
        .flatMap(({ dependencyReferences }) => dependencyReferences.cartItems)
        .filter(
          ({ productId, variantId }) =>
            productId !== null &&
            variantId !== null &&
            variantOwners.has(variantId) &&
            variantOwners.get(variantId) !== productId
        )
        .map(({ id }) => id)
        .sort(),
      unknownOrderProductIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.orderItems.map(({ productId }) => productId)
        ),
        knownProductIds
      ),
      unknownOrderVariantIds: missingDependencyIds(
        products.flatMap(({ dependencyReferences }) =>
          dependencyReferences.orderItems.map(({ variantId }) => variantId)
        ),
        knownVariantIds
      ),
      orderProductVariantMismatches: products
        .flatMap(({ dependencyReferences }) => dependencyReferences.orderItems)
        .filter(
          ({ productId, variantId }) =>
            productId !== null &&
            variantId !== null &&
            variantOwners.has(variantId) &&
            variantOwners.get(variantId) !== productId
        )
        .map(({ id }) => id)
        .sort(),
    },
    products,
  } satisfies ShopCatalogLossLedger;
  return deepFreeze(ledger);
}

export function buildShopCatalogLossLedger(
  productsInput: readonly CatalogBaselineInput[]
): ShopCatalogLossLedger {
  return buildShopCatalogLossLedgerFromEntries(
    productsInput.map(buildShopCatalogBaselineProductEntry)
  );
}

export function compareShopCatalogLossLedgers(
  before: ShopCatalogLossLedger,
  after: ShopCatalogLossLedger
): CatalogBaselineDiff {
  const beforeProducts = new Map(before.products.map((product) => [product.productId, product]));
  const afterProducts = new Map(after.products.map((product) => [product.productId, product]));
  const addedProductIds = [...afterProducts.keys()].filter((id) => !beforeProducts.has(id)).sort();
  const removedProductIds = [...beforeProducts.keys()]
    .filter((id) => !afterProducts.has(id))
    .sort();
  const changedProducts = [...beforeProducts.keys()]
    .filter((id) => afterProducts.has(id))
    .flatMap((productId) => {
      const previous = beforeProducts.get(productId)!;
      const next = afterProducts.get(productId)!;
      const changedSections = Object.keys(previous.hashes).filter(
        (key) =>
          previous.hashes[key as keyof typeof previous.hashes] !==
          next.hashes[key as keyof typeof next.hashes]
      );
      return changedSections.length > 0 ? [{ productId, changedSections }] : [];
    })
    .sort((left, right) => left.productId.localeCompare(right.productId));
  const countChanges = Object.fromEntries(
    Object.keys(before.counts)
      .filter(
        (key) =>
          before.counts[key as keyof CatalogBaselineCounts] !==
          after.counts[key as keyof CatalogBaselineCounts]
      )
      .map((key) => [
        key,
        {
          before: before.counts[key as keyof CatalogBaselineCounts],
          after: after.counts[key as keyof CatalogBaselineCounts],
        },
      ])
  );
  return deepFreeze({
    unchanged: before.fingerprint === after.fingerprint,
    beforeFingerprint: before.fingerprint,
    afterFingerprint: after.fingerprint,
    addedProductIds,
    removedProductIds,
    changedProducts,
    countChanges,
  });
}

export interface CatalogSnapshotManifest {
  readonly version: unknown;
  readonly generatedAt?: unknown;
  readonly count: unknown;
  readonly activeDatabaseCount?: unknown;
  readonly stores: unknown;
  readonly slugToStore?: unknown;
}

export function fingerprintCatalogSnapshotMetadata(value: unknown) {
  if (!isPlainRecord(value)) throw new TypeError("Snapshot manifest must be a JSON object");
  const manifest = value as unknown as CatalogSnapshotManifest;
  if (!Number.isSafeInteger(manifest.count) || Number(manifest.count) < 0) {
    throw new TypeError("Snapshot manifest count must be a non-negative integer");
  }
  if (!isPlainRecord(manifest.stores))
    throw new TypeError("Snapshot manifest stores must be an object");
  const stores = Object.entries(manifest.stores)
    .map(([store, metadata]) => {
      if (!isPlainRecord(metadata))
        throw new TypeError(`Invalid snapshot metadata for store ${store}`);
      const file = metadata.file;
      const count = metadata.count;
      if (typeof file !== "string" || !/^[^/\\]+\.json$/.test(file)) {
        throw new TypeError(`Unsafe snapshot shard file for store ${store}`);
      }
      if (!Number.isSafeInteger(count) || Number(count) < 0) {
        throw new TypeError(`Invalid snapshot shard count for store ${store}`);
      }
      return { store, file, count: Number(count) };
    })
    .sort((left, right) => left.store.localeCompare(right.store));
  const shardTotal = stores.reduce((sum, store) => sum + store.count, 0);
  if (shardTotal !== Number(manifest.count)) {
    throw new TypeError(
      `Snapshot shard total ${shardTotal} does not match count ${manifest.count}`
    );
  }
  const slugToStore = isPlainRecord(manifest.slugToStore) ? manifest.slugToStore : {};
  if (
    Object.keys(slugToStore).length > 0 &&
    Object.keys(slugToStore).length !== Number(manifest.count)
  ) {
    throw new TypeError("Snapshot slugToStore size does not match count");
  }
  const metadata = {
    version: manifest.version,
    count: Number(manifest.count),
    activeDatabaseCount:
      typeof manifest.activeDatabaseCount === "number" ? manifest.activeDatabaseCount : null,
    stores,
    slugToStore,
  };
  return deepFreeze({
    fingerprint: hashCatalogBaselineValue(metadata),
    count: Number(manifest.count),
    stores,
    slugCount: Object.keys(slugToStore).length,
  });
}
