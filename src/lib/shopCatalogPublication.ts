export const SHOP_CATALOG_CHANGE_DOMAINS = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "PRICE",
  "INVENTORY",
  "FITMENT",
  "TAXONOMY",
  "VISIBILITY",
  "SETTINGS",
] as const;

export type ShopCatalogChangeDomain = (typeof SHOP_CATALOG_CHANGE_DOMAINS)[number];

export const SHOP_CATALOG_PROJECTION_TARGETS = [
  "CONTENT",
  "SEARCH",
  "PRICE",
  "INVENTORY",
  "SETTINGS",
] as const;

export type ShopCatalogProjectionTarget = (typeof SHOP_CATALOG_PROJECTION_TARGETS)[number];

export const SHOP_CATALOG_PUBLICATION_ENTITY_TYPES = ["PRODUCT", "PRICE_BOOK", "SETTINGS"] as const;

export type ShopCatalogPublicationEntityType =
  (typeof SHOP_CATALOG_PUBLICATION_ENTITY_TYPES)[number];

export const SHOP_CATALOG_PDP_INVALIDATION_DOMAINS = [
  "CONTENT",
  "SEO",
  "MEDIA",
  "VISIBILITY",
] as const satisfies readonly ShopCatalogChangeDomain[];

export interface ShopCatalogPublicationInput {
  entityType: ShopCatalogPublicationEntityType;
  entityId: string;
  canonicalVersion: string;
  changeDomains: readonly ShopCatalogChangeDomain[];
  oldSlug?: string | null;
  newSlug?: string | null;
}

export interface ShopCatalogPublicationPlan {
  schemaVersion: 1;
  dedupeKey: string;
  entityType: ShopCatalogPublicationEntityType;
  entityId: string;
  canonicalVersion: string;
  changeDomains: ShopCatalogChangeDomain[];
  projectionTargets: ShopCatalogProjectionTarget[];
  productIds: string[];
  oldSlug: string | null;
  newSlug: string | null;
  slugKeys: string[];
  allowBroadInvalidation: false;
}

export type ShopCatalogProjectionEventDecision = "APPLY" | "SKIP_IDEMPOTENT" | "SKIP_STALE";

export type ShopCatalogPublicationStatus = "SAVED" | "PUBLISHING" | "PUBLISHED" | "FAILED";

export interface ShopCatalogProjectionPublicationState {
  target: ShopCatalogProjectionTarget;
  appliedVersion: string | null;
  /** A terminal/dead-lettered version, not a retryable attempt failure. */
  failedVersion?: string | null;
  processingVersion?: string | null;
}

const CHANGE_DOMAIN_ORDER = new Map<string, number>(
  SHOP_CATALOG_CHANGE_DOMAINS.map((domain, index) => [domain, index])
);

const PROJECTION_TARGET_ORDER = new Map<string, number>(
  SHOP_CATALOG_PROJECTION_TARGETS.map((target, index) => [target, index])
);

const CHANGE_DOMAIN_SET = new Set<string>(SHOP_CATALOG_CHANGE_DOMAINS);
const PROJECTION_TARGET_SET = new Set<string>(SHOP_CATALOG_PROJECTION_TARGETS);
const PUBLICATION_ENTITY_TYPE_SET = new Set<string>(SHOP_CATALOG_PUBLICATION_ENTITY_TYPES);
const PDP_INVALIDATION_DOMAIN_SET = new Set<string>(SHOP_CATALOG_PDP_INVALIDATION_DOMAINS);
const MAX_CATALOG_VERSION = BigInt("9223372036854775807");

const ALLOWED_CHANGE_DOMAINS_BY_ENTITY = {
  PRODUCT: new Set<ShopCatalogChangeDomain>(
    SHOP_CATALOG_CHANGE_DOMAINS.filter((domain) => domain !== "SETTINGS")
  ),
  PRICE_BOOK: new Set<ShopCatalogChangeDomain>(["PRICE", "SETTINGS"]),
  SETTINGS: new Set<ShopCatalogChangeDomain>(["SETTINGS"]),
} satisfies Record<ShopCatalogPublicationEntityType, ReadonlySet<ShopCatalogChangeDomain>>;

function normalizeNonEmpty(value: string) {
  return value.trim();
}

function parseCatalogVersion(version: string, field: string) {
  const normalized = version.trim();
  if (!/^(0|[1-9]\d{0,18})$/.test(normalized)) {
    throw new Error(`${field} must be a non-negative decimal integer string`);
  }
  const numeric = BigInt(normalized);
  if (numeric > MAX_CATALOG_VERSION) {
    throw new Error(`${field} must fit a signed PostgreSQL bigint`);
  }
  return { normalized, numeric };
}

function parsePositiveCatalogVersion(version: string, field: string) {
  const parsed = parseCatalogVersion(version, field);
  if (parsed.numeric === BigInt(0)) {
    throw new Error(`${field} must be greater than zero`);
  }
  return parsed;
}

function parseOptionalCatalogVersion(
  version: string | null | undefined,
  field: string
): ReturnType<typeof parseCatalogVersion> | null {
  return version === null || version === undefined ? null : parseCatalogVersion(version, field);
}

function normalizeSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export function normalizeShopCatalogChangeDomains(
  domains: readonly ShopCatalogChangeDomain[]
): ShopCatalogChangeDomain[] {
  const unique = new Set<ShopCatalogChangeDomain>();
  for (const domain of domains) {
    if (!CHANGE_DOMAIN_SET.has(domain)) {
      throw new Error(`Unsupported catalog change domain: ${String(domain)}`);
    }
    unique.add(domain);
  }
  if (!unique.size) {
    throw new Error("At least one catalog change domain is required");
  }
  return [...unique].sort(
    (left, right) =>
      (CHANGE_DOMAIN_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (CHANGE_DOMAIN_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

function projectionTargetsFor(domains: readonly ShopCatalogChangeDomain[]) {
  const targets = new Set<ShopCatalogProjectionTarget>();
  for (const domain of domains) {
    if (["CONTENT", "SEO", "MEDIA", "VISIBILITY"].includes(domain)) {
      targets.add("CONTENT");
    }
    if (["CONTENT", "SEO", "MEDIA", "FITMENT", "TAXONOMY", "VISIBILITY"].includes(domain)) {
      targets.add("SEARCH");
    }
    if (domain === "PRICE") targets.add("PRICE");
    if (domain === "INVENTORY") targets.add("INVENTORY");
    if (domain === "SETTINGS") targets.add("SETTINGS");
  }
  return [...targets].sort(
    (left, right) =>
      (PROJECTION_TARGET_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (PROJECTION_TARGET_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

function normalizeProjectionTargets(
  targets: readonly ShopCatalogProjectionTarget[]
): ShopCatalogProjectionTarget[] {
  const unique = new Set<ShopCatalogProjectionTarget>();
  for (const target of targets) {
    if (!PROJECTION_TARGET_SET.has(target)) {
      throw new Error(`Unsupported catalog projection target: ${String(target)}`);
    }
    unique.add(target);
  }
  if (!unique.size) {
    throw new Error("At least one catalog projection target is required");
  }
  return [...unique].sort(
    (left, right) =>
      (PROJECTION_TARGET_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (PROJECTION_TARGET_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
  );
}

export function buildShopCatalogPublicationPlan(
  input: ShopCatalogPublicationInput
): ShopCatalogPublicationPlan {
  if (!PUBLICATION_ENTITY_TYPE_SET.has(input.entityType)) {
    throw new Error(`Unsupported catalog publication entity type: ${String(input.entityType)}`);
  }

  const entityId = normalizeNonEmpty(input.entityId);
  if (!entityId) throw new Error("Catalog publication entityId is required");

  const { normalized: canonicalVersion } = parsePositiveCatalogVersion(
    input.canonicalVersion,
    "canonicalVersion"
  );

  const changeDomains = normalizeShopCatalogChangeDomains(input.changeDomains);
  const allowedDomains = ALLOWED_CHANGE_DOMAINS_BY_ENTITY[input.entityType];
  const invalidDomain = changeDomains.find((domain) => !allowedDomains.has(domain));
  if (invalidDomain) {
    throw new Error(`${input.entityType} publication events cannot carry ${invalidDomain} changes`);
  }

  const oldSlug = normalizeSlug(input.oldSlug);
  const newSlug = normalizeSlug(input.newSlug);
  const suppliedSlugKeys = [oldSlug, newSlug].filter((slug): slug is string => Boolean(slug));
  const requiresPdpInvalidation = changeDomains.some((domain) =>
    PDP_INVALIDATION_DOMAIN_SET.has(domain)
  );
  const slugKeys = requiresPdpInvalidation ? [...new Set(suppliedSlugKeys)] : [];

  if (input.entityType === "PRODUCT" && requiresPdpInvalidation && !slugKeys.length) {
    throw new Error("Product PDP publication events require an oldSlug or newSlug");
  }
  if (
    input.entityType === "PRODUCT" &&
    !requiresPdpInvalidation &&
    oldSlug &&
    newSlug &&
    oldSlug !== newSlug
  ) {
    throw new Error("Slug changes require a content, SEO, media, or visibility change domain");
  }
  if (input.entityType !== "PRODUCT" && suppliedSlugKeys.length) {
    throw new Error("Only product publication events may carry slug keys");
  }

  return {
    schemaVersion: 1,
    dedupeKey: ["SHOP_CATALOG", "1", input.entityType, entityId, canonicalVersion].join(":"),
    entityType: input.entityType,
    entityId,
    canonicalVersion,
    changeDomains,
    projectionTargets: projectionTargetsFor(changeDomains),
    productIds: input.entityType === "PRODUCT" ? [entityId] : [],
    oldSlug: requiresPdpInvalidation ? oldSlug : null,
    newSlug: requiresPdpInvalidation ? newSlug : null,
    slugKeys,
    allowBroadInvalidation: false,
  };
}

export function decideShopCatalogProjectionEvent(
  eventVersion: string,
  currentProjectionVersion: string | null
): ShopCatalogProjectionEventDecision {
  const event = parsePositiveCatalogVersion(eventVersion, "eventVersion");
  if (currentProjectionVersion === null) return "APPLY";

  const current = parseCatalogVersion(currentProjectionVersion, "currentProjectionVersion");
  if (event.numeric < current.numeric) return "SKIP_STALE";
  if (event.numeric === current.numeric) return "SKIP_IDEMPOTENT";
  return "APPLY";
}

/**
 * Resolves publication from each required projection independently. A product is
 * published only when every target required by its change domains has caught up.
 */
export function resolveShopCatalogPublicationStatus(input: {
  canonicalVersion: string;
  requiredTargets: readonly ShopCatalogProjectionTarget[];
  targetStates: readonly ShopCatalogProjectionPublicationState[];
}): ShopCatalogPublicationStatus {
  const canonical = parsePositiveCatalogVersion(input.canonicalVersion, "canonicalVersion");
  const requiredTargets = normalizeProjectionTargets(input.requiredTargets);
  const statesByTarget = new Map<
    ShopCatalogProjectionTarget,
    {
      applied: ReturnType<typeof parseCatalogVersion> | null;
      failed: ReturnType<typeof parseCatalogVersion> | null;
      processing: ReturnType<typeof parseCatalogVersion> | null;
    }
  >();

  for (const state of input.targetStates) {
    if (!PROJECTION_TARGET_SET.has(state.target)) {
      throw new Error(`Unsupported catalog projection target: ${String(state.target)}`);
    }
    if (statesByTarget.has(state.target)) {
      throw new Error(`Duplicate publication state for projection target: ${state.target}`);
    }

    const applied = parseOptionalCatalogVersion(
      state.appliedVersion,
      `${state.target}.appliedVersion`
    );
    const failed = parseOptionalCatalogVersion(
      state.failedVersion,
      `${state.target}.failedVersion`
    );
    const processing = parseOptionalCatalogVersion(
      state.processingVersion,
      `${state.target}.processingVersion`
    );

    for (const [field, version] of [
      ["appliedVersion", applied],
      ["failedVersion", failed],
      ["processingVersion", processing],
    ] as const) {
      if (version && version.numeric > canonical.numeric) {
        throw new Error(`${state.target}.${field} cannot be newer than canonicalVersion`);
      }
    }

    statesByTarget.set(state.target, { applied, failed, processing });
  }

  const requiredStates = requiredTargets.map((target) => statesByTarget.get(target));
  if (requiredStates.every((state) => state?.applied?.numeric === canonical.numeric)) {
    return "PUBLISHED";
  }
  if (requiredStates.some((state) => state?.failed?.numeric === canonical.numeric)) {
    return "FAILED";
  }
  if (requiredStates.some((state) => state?.processing?.numeric === canonical.numeric)) {
    return "PUBLISHING";
  }
  return "SAVED";
}
