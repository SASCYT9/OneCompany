import "server-only";

import { Prisma } from "@prisma/client";

import { buildShopAiCatalogQuery } from "@/lib/shopAiAssistantRanking";
import { getShopAiExactSkuLookupToken } from "@/lib/shopAiExactSku";
import type { ShopAiContext, ShopAiPlan, ShopAiProduct } from "@/lib/shopAiAssistantTypes";
import {
  hydrateShopAiKnowledgeCandidates,
  type ShopAiKnowledgeCandidate,
} from "@/lib/shopAiProductHydration";
import { cleanShopAiProductKind } from "@/lib/shopAiProductKind";
import {
  getMissingShopAiHardFacts,
  hasTrustedShopAiApplicationProvenance,
  isShopAiExactMatchEligible,
  resolveTrustedShopAiProductKind,
} from "@/lib/shopAiStrictValidation";
import {
  classifyShopAiStrictCanonicalRow,
  type ShopAiStrictCanonicalRow,
} from "@/lib/shopAiStrictCanonical";
import { prisma } from "@/lib/prisma";
import {
  isShopKnowledgeCatalogFingerprintCurrent,
  readShopKnowledgeCatalogState,
  requiresShopKnowledgeCatalogRuntimeGuard,
} from "@/lib/shopKnowledgeV2/catalogState";
import { normalizeShopSearchText } from "@/lib/shopSearch";

const MAX_RETRIEVED_CANDIDATES = 200;
const MAX_VALIDATED_CANDIDATES = 20;
type StrictKnowledgeRow = ShopAiStrictCanonicalRow & {
  slug: string;
  productSku: string | null;
  fitmentStatus: string;
  fitmentSource: string;
  applicationFuel: string | null;
  applicationBodyStyle: string | null;
  applicationDrivetrain: string | null;
  applicationTransmission: string | null;
  applicationMarket: string | null;
  applicationMaterial: string | null;
  applicationConfidence: number | null;
  exactVariantId: string | null;
  knowledgeFacts: Prisma.JsonValue;
  trustedMaterialEvidence: boolean;
  trustedOpfEvidence: boolean;
  trustedInstallationEvidence: boolean;
  trustedPowerGainEvidence: boolean;
  trustedProductKindEvidence: boolean;
  trustedApplicationEvidence: boolean;
  applicationProductKind: string | null;
  isExactSku: boolean;
  lexicalScore: number;
  eligibleCount: bigint | number;
};

export type ShopAiStrictRetrievalResult = {
  available: boolean;
  catalogFingerprint: string | null;
  products: ShopAiProduct[];
  exactCount: number;
  requiresVerificationCount: number;
  candidateCount: number;
  retrievalLatencyMs: number;
};

function normalizeOptional(value: string | null | undefined) {
  const normalized = normalizeShopSearchText(value ?? "");
  return normalized || null;
}

function toConfidence(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "unknown" as const;
  if (value >= 0.85) return "high" as const;
  if (value >= 0.6) return "medium" as const;
  return "low" as const;
}

function isMissingKnowledgeSchemaError(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "");
  return (
    code === "P2021" ||
    code === "P2010" ||
    code === "42P01" ||
    code === "42703" ||
    /ShopProductKnowledge|ShopVehicleApplication|column .* does not exist|does not exist/i.test(
      message
    )
  );
}

export async function resolveCanonicalShopAiExactSku(message: string): Promise<{
  available: boolean;
  matched: boolean;
}> {
  const exactSkuQuery = getShopAiExactSkuLookupToken(message);
  if (!exactSkuQuery) return { available: true, matched: false };

  try {
    const rows = await prisma.$queryRaw<Array<{ matched: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM "ShopProduct" p
        JOIN "ShopProductKnowledge" k
          ON k."productId" = p."id"
        WHERE p."isPublished" = true
          AND p."status"::text = 'ACTIVE'
          AND k."status"::text IN ('READY', 'NEEDS_REVIEW')
          AND k."schemaVersion" >= 2
          AND k."activeRevision" > 0
          AND NOT (
            'v2_backfill_required' = ANY(COALESCE(k."qualityFlags", ARRAY[]::TEXT[]))
          )
          AND (
            lower(regexp_replace(COALESCE(p."sku", ''), '[^a-zA-Z0-9]+', '', 'g')) =
              ${exactSkuQuery}
            OR EXISTS (
              SELECT 1
              FROM "ShopVariantKnowledge" variant
              WHERE variant."knowledgeId" = k."id"
                AND variant."isActive" = true
                AND variant."revision" = k."activeRevision"
                AND variant."schemaVersion" >= 2
                AND variant."status"::text IN ('READY', 'NEEDS_REVIEW')
                AND lower(
                  regexp_replace(COALESCE(variant."sku", ''), '[^a-zA-Z0-9]+', '', 'g')
                ) = ${exactSkuQuery}
            )
          )
      ) AS "matched"
    `);
    return { available: true, matched: rows[0]?.matched === true };
  } catch (error) {
    if (!isMissingKnowledgeSchemaError(error)) throw error;
    return { available: false, matched: false };
  }
}

function trustedApplication(row: StrictKnowledgeRow) {
  return hasTrustedShopAiApplicationProvenance(row);
}

function missingHardKnowledgeFacts(row: StrictKnowledgeRow, plan: ShopAiPlan) {
  const missing = getMissingShopAiHardFacts(row.qualityFlags ?? []);
  if (
    plan.productKind &&
    plan.productKind !== "any" &&
    !(
      row.trustedProductKindEvidence ||
      (trustedApplication(row) && Boolean(row.applicationProductKind))
    )
  ) {
    missing.push("productKindEvidence");
  }
  if (plan.powerGainHp && !row.trustedPowerGainEvidence) {
    missing.push("powerGainEvidence");
  }
  return Array.from(new Set(missing));
}

function hasVehicleConstraints(plan: ShopAiPlan) {
  return Boolean(
    plan.vehicle.make ||
      plan.vehicle.model ||
      plan.vehicle.chassis ||
      plan.vehicle.year ||
      plan.vehicle.engine ||
      plan.vehicle.fuel ||
      plan.vehicle.bodyStyle ||
      plan.vehicle.drivetrain ||
      plan.vehicle.transmission ||
      plan.vehicle.market ||
      plan.opfGpf
  );
}

function applicationConfirmsRequestedFacts(row: StrictKnowledgeRow, plan: ShopAiPlan) {
  if (row.applicationUniversal) return true;
  if (plan.vehicle.make && !row.applicationMake) return false;
  if (plan.vehicle.model && !row.applicationModel) return false;
  if (plan.vehicle.chassis && !row.applicationChassis) return false;
  if (plan.vehicle.year && row.applicationYearFrom === null) return false;
  if (plan.vehicle.engine && !row.applicationEngine) return false;
  if (plan.vehicle.fuel && !row.applicationFuel) return false;
  if (plan.vehicle.bodyStyle && !row.applicationBodyStyle) return false;
  if (plan.vehicle.drivetrain && !row.applicationDrivetrain) return false;
  if (plan.vehicle.transmission && !row.applicationTransmission) return false;
  if (plan.vehicle.market && !row.applicationMarket) return false;
  if (plan.opfGpf && !row.applicationOpfGpf) return false;
  return true;
}

function missingApplicationFacts(row: StrictKnowledgeRow, plan: ShopAiPlan) {
  const missingHardFacts = missingHardKnowledgeFacts(row, plan);
  if (!hasVehicleConstraints(plan)) return missingHardFacts;
  if (!row.applicationId) return Array.from(new Set(["fitment", ...missingHardFacts]));
  const missing: string[] = [];
  if (!row.applicationUniversal) {
    if (plan.vehicle.make && !row.applicationMake) missing.push("make");
    if (plan.vehicle.model && !row.applicationModel) missing.push("model");
    if (plan.vehicle.chassis && !row.applicationChassis) missing.push("chassis");
    if (plan.vehicle.year && row.applicationYearFrom === null) missing.push("year");
    if (plan.vehicle.engine && !row.applicationEngine) missing.push("engine");
    if (plan.vehicle.fuel && !row.applicationFuel) missing.push("fuel");
    if (plan.vehicle.bodyStyle && !row.applicationBodyStyle) missing.push("body_style");
    if (plan.vehicle.drivetrain && !row.applicationDrivetrain) missing.push("drivetrain");
    if (plan.vehicle.transmission && !row.applicationTransmission) {
      missing.push("transmission");
    }
    if (plan.vehicle.market && !row.applicationMarket) missing.push("market");
    if (plan.opfGpf && !row.applicationOpfGpf) missing.push("opf_gpf");
  }
  if (!trustedApplication(row)) missing.push("verified_fitment");
  missing.push(...missingHardFacts);
  return Array.from(new Set(missing));
}

function getKnowledgeFacts(
  value: Prisma.JsonValue,
  row: StrictKnowledgeRow
): ShopAiProduct["facts"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, Prisma.JsonValue>;
  const applicationIsTrusted = trustedApplication(row);
  const productKind = resolveTrustedShopAiProductKind({
    ...row,
    knowledgeProductKind: typeof source.productKind === "string" ? source.productKind : null,
  });
  const opfGpf =
    applicationIsTrusted && row.applicationOpfGpf
      ? row.applicationOpfGpf
      : row.trustedOpfEvidence
        ? String(source.opfGpf ?? "")
        : "";
  const material =
    applicationIsTrusted && row.applicationMaterial
      ? row.applicationMaterial
      : row.trustedMaterialEvidence
        ? String(source.material ?? "")
        : "";
  const installationType = String(source.installationType ?? "");
  const powerGainHp = Number(source.powerGainHp);
  return {
    productKind: productKind.verified
      ? (cleanShopAiProductKind(productKind.value) ?? undefined)
      : undefined,
    productKindVerified: productKind.verified,
    opfGpf: opfGpf === "with" || opfGpf === "without" ? (opfGpf as "with" | "without") : null,
    opfGpfVerified:
      (applicationIsTrusted && Boolean(row.applicationOpfGpf)) || row.trustedOpfEvidence,
    material: ["titanium", "stainless_steel", "carbon", "mixed"].includes(material)
      ? (material as NonNullable<ShopAiProduct["facts"]>["material"])
      : null,
    materialVerified:
      (applicationIsTrusted && Boolean(row.applicationMaterial)) || row.trustedMaterialEvidence,
    installationType:
      row.trustedInstallationEvidence &&
      ["direct_fit", "welding_required", "professional_installation"].includes(installationType)
        ? (installationType as NonNullable<ShopAiProduct["facts"]>["installationType"])
        : null,
    installationTypeVerified: row.trustedInstallationEvidence,
    powerGainHp: row.trustedPowerGainEvidence && Number.isFinite(powerGainHp) ? powerGainHp : null,
    powerGainVerified: row.trustedPowerGainEvidence,
  };
}

function toCandidate(
  row: StrictKnowledgeRow,
  plan: ShopAiPlan,
  context: ShopAiContext,
  identityMatchOnly = false
): ShopAiKnowledgeCandidate {
  const vehicleConstrained = hasVehicleConstraints(plan);
  const runtimeMissingHardFacts = missingHardKnowledgeFacts(row, plan);
  const exact =
    runtimeMissingHardFacts.length === 0 &&
    isShopAiExactMatchEligible({
      exactSkuWithoutVehicle: row.isExactSku && !vehicleConstrained,
      merchWithoutVehicle: !vehicleConstrained && plan.category === "merch",
      hasApplication: Boolean(row.applicationId),
      trustedApplication: trustedApplication(row),
      applicationConfirmsRequestedFacts: applicationConfirmsRequestedFacts(row, plan),
      qualityFlags: row.qualityFlags ?? [],
    });
  const missingFacts = exact ? [] : missingApplicationFacts(row, plan);
  const matchReason =
    context.locale === "ua"
      ? exact
        ? row.isExactSku
          ? "Точний збіг за артикулом"
          : "Сумісність підтверджена перевіреним джерелом"
        : "Категорія й тип деталі збігаються, але сумісність потребує перевірки"
      : exact
        ? row.isExactSku
          ? "Exact SKU match"
          : "Fitment confirmed by verified evidence"
        : "Category and product type match, but fitment needs verification";

  return {
    productId: row.productId,
    slug: row.slug,
    variantId: row.exactVariantId ?? row.applicationVariantId,
    matchStatus: exact ? "exact" : "requires_verification",
    matchBasis: identityMatchOnly ? "identity" : "fitment",
    matchReason,
    missingFacts,
    matchedApplicationId: identityMatchOnly ? null : row.applicationId,
    identityMatchOnly,
    facts: getKnowledgeFacts(row.knowledgeFacts, row),
    fitmentStatus:
      row.fitmentStatus === "verified" ||
      row.fitmentStatus === "universal" ||
      row.fitmentStatus === "inferred" ||
      row.fitmentStatus === "needs_review"
        ? row.fitmentStatus
        : "needs_review",
    fitmentSource:
      row.fitmentSource === "manual" ||
      row.fitmentSource === "import" ||
      row.fitmentSource === "automatic"
        ? row.fitmentSource
        : "automatic",
    application:
      !identityMatchOnly && row.applicationId
        ? {
            make: row.applicationMake,
            models: row.applicationModel ? [row.applicationModel] : [],
            chassisCodes: row.applicationChassis ? [row.applicationChassis] : [],
            yearFrom: row.applicationYearFrom,
            yearTo: row.applicationYearTo,
            confidence: toConfidence(row.applicationConfidence),
          }
        : null,
  };
}

function productPrice(product: ShopAiProduct, context: ShopAiContext) {
  if (context.currency === "EUR") return Number(product.priceSet?.eur ?? product.price ?? 0);
  if (context.currency === "UAH") return Number(product.priceSet?.uah ?? product.price ?? 0);
  return Number(product.priceSet?.usd ?? product.price ?? 0);
}

function matchesBudget(product: ShopAiProduct, plan: ShopAiPlan, context: ShopAiContext) {
  if (plan.minPrice === null && plan.maxPrice === null) return true;
  const price = productPrice(product, context);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (plan.minPrice !== null && price < plan.minPrice) return false;
  if (plan.maxPrice !== null && price > plan.maxPrice) return false;
  return true;
}

function equalsNormalized(column: Prisma.Sql, value: string | null) {
  if (!value) return Prisma.empty;
  return Prisma.sql`
    (${column} IS NULL OR lower(trim(${column})) = lower(trim(${value})))
  `;
}

function presentAndEqualsNormalized(column: Prisma.Sql, value: string | null) {
  if (!value) return Prisma.empty;
  return Prisma.sql`
    (${column} IS NOT NULL AND lower(trim(${column})) = lower(trim(${value})))
  `;
}

export async function retrieveShopAiCandidatesStrict(input: {
  plan: ShopAiPlan;
  message: string;
  context: ShopAiContext;
  excludedProductIds?: string[];
  exactSkuOnly?: boolean;
}): Promise<ShopAiStrictRetrievalResult> {
  const startedAt = performance.now();
  const make = normalizeOptional(input.plan.vehicle.make);
  const model = normalizeOptional(input.plan.vehicle.model);
  const chassis = normalizeOptional(input.plan.vehicle.chassis);
  const engine = normalizeOptional(input.plan.vehicle.engine);
  const opfGpf = normalizeOptional(input.plan.opfGpf);
  const productKind =
    input.plan.productKind && input.plan.productKind !== "any" ? input.plan.productKind : null;
  const query = normalizeShopSearchText(buildShopAiCatalogQuery(input.plan));
  const exactSkuQuery = getShopAiExactSkuLookupToken(input.message) ?? "";
  const applicationClauses = [
    equalsNormalized(Prisma.sql`a."make"`, make),
    equalsNormalized(Prisma.sql`a."model"`, model),
    equalsNormalized(Prisma.sql`a."chassisCode"`, chassis),
    equalsNormalized(Prisma.sql`a."engine"`, engine),
    equalsNormalized(Prisma.sql`a."fuel"`, normalizeOptional(input.plan.vehicle.fuel)),
    equalsNormalized(Prisma.sql`a."bodyStyle"`, normalizeOptional(input.plan.vehicle.bodyStyle)),
    equalsNormalized(Prisma.sql`a."drivetrain"`, normalizeOptional(input.plan.vehicle.drivetrain)),
    equalsNormalized(
      Prisma.sql`a."transmission"`,
      normalizeOptional(input.plan.vehicle.transmission)
    ),
    equalsNormalized(Prisma.sql`a."market"`, normalizeOptional(input.plan.vehicle.market)),
    equalsNormalized(Prisma.sql`a."opfGpf"`, opfGpf),
    input.plan.vehicle.year
      ? Prisma.sql`
          (a."yearFrom" IS NULL OR a."yearFrom" <= ${input.plan.vehicle.year})
          AND (a."yearTo" IS NULL OR a."yearTo" >= ${input.plan.vehicle.year})
        `
      : Prisma.empty,
  ].filter((clause) => clause !== Prisma.empty);
  const exactApplicationClauses = [
    presentAndEqualsNormalized(Prisma.sql`a."make"`, make),
    presentAndEqualsNormalized(Prisma.sql`a."model"`, model),
    presentAndEqualsNormalized(Prisma.sql`a."chassisCode"`, chassis),
    presentAndEqualsNormalized(Prisma.sql`a."engine"`, engine),
    presentAndEqualsNormalized(Prisma.sql`a."fuel"`, normalizeOptional(input.plan.vehicle.fuel)),
    presentAndEqualsNormalized(
      Prisma.sql`a."bodyStyle"`,
      normalizeOptional(input.plan.vehicle.bodyStyle)
    ),
    presentAndEqualsNormalized(
      Prisma.sql`a."drivetrain"`,
      normalizeOptional(input.plan.vehicle.drivetrain)
    ),
    presentAndEqualsNormalized(
      Prisma.sql`a."transmission"`,
      normalizeOptional(input.plan.vehicle.transmission)
    ),
    presentAndEqualsNormalized(
      Prisma.sql`a."market"`,
      normalizeOptional(input.plan.vehicle.market)
    ),
    presentAndEqualsNormalized(Prisma.sql`a."opfGpf"`, opfGpf),
    input.plan.vehicle.year
      ? Prisma.sql`
          a."yearFrom" IS NOT NULL
          AND a."yearFrom" <= ${input.plan.vehicle.year}
          AND (a."yearTo" IS NULL OR a."yearTo" >= ${input.plan.vehicle.year})
        `
      : Prisma.empty,
  ].filter((clause) => clause !== Prisma.empty);
  const hasVehicle = hasVehicleConstraints(input.plan);
  const excluded = (input.excludedProductIds ?? []).filter(Boolean).slice(0, 100);
  const catalogState = await readShopKnowledgeCatalogState(prisma);
  if (
    requiresShopKnowledgeCatalogRuntimeGuard(process.env) &&
    !isShopKnowledgeCatalogFingerprintCurrent({
      actual: catalogState.fingerprint,
      expected: process.env.SHOP_AI_V2_CATALOG_FINGERPRINT,
    })
  ) {
    return {
      available: false,
      catalogFingerprint: catalogState.fingerprint,
      products: [],
      exactCount: 0,
      requiresVerificationCount: 0,
      candidateCount: 0,
      retrievalLatencyMs: Math.round(performance.now() - startedAt),
    };
  }

  try {
    const rows = await prisma.$queryRaw<StrictKnowledgeRow[]>(Prisma.sql`
      WITH eligible AS (
        SELECT
          p."id" AS "productId",
          p."slug" AS "slug",
          p."sku" AS "productSku",
          k."categoryGroup" AS "categoryGroup",
          k."fitmentStatus" AS "fitmentStatus",
          k."fitmentSource" AS "fitmentSource",
          k."facts" AS "knowledgeFacts",
          k."qualityFlags" AS "qualityFlags",
          k."makes" AS "knowledgeMakes",
          k."models" AS "knowledgeModels",
          k."chassisCodes" AS "knowledgeChassisCodes",
          k."yearRanges" AS "knowledgeYearRanges",
          k."engines" AS "knowledgeEngines",
          CASE
            WHEN COALESCE(trusted_evidence."opfGpf", false)
            THEN COALESCE(k."opfGpf", k."facts"->>'opfGpf')
            ELSE NULL
          END AS "knowledgeOpfGpf",
          matched."id" AS "applicationId",
          matched."make" AS "applicationMake",
          matched."model" AS "applicationModel",
          matched."chassisCode" AS "applicationChassis",
          matched."yearFrom" AS "applicationYearFrom",
          matched."yearTo" AS "applicationYearTo",
          matched."engine" AS "applicationEngine",
          matched."fuel" AS "applicationFuel",
          matched."bodyStyle" AS "applicationBodyStyle",
          matched."drivetrain" AS "applicationDrivetrain",
          matched."transmission" AS "applicationTransmission",
          matched."market" AS "applicationMarket",
          matched."material" AS "applicationMaterial",
          matched."opfGpf" AS "applicationOpfGpf",
          matched."verificationStatus"::text AS "applicationVerificationStatus",
          matched."source"::text AS "applicationSource",
          matched."confidence" AS "applicationConfidence",
          matched."isUniversal" AS "applicationUniversal",
          matched."variantId" AS "applicationVariantId",
          COALESCE(trusted_evidence."material", false) AS "trustedMaterialEvidence",
          COALESCE(trusted_evidence."opfGpf", false) AS "trustedOpfEvidence",
          COALESCE(trusted_evidence."installationType", false) AS "trustedInstallationEvidence",
          COALESCE(trusted_evidence."powerGainHp", false) AS "trustedPowerGainEvidence",
          COALESCE(trusted_evidence."productKind", false) AS "trustedProductKindEvidence",
          COALESCE(matched."hasTrustedProvenance", false) AS "trustedApplicationEvidence",
          exact_variant."variantId" AS "exactVariantId",
          matched."productKind" AS "applicationProductKind",
          CASE
            WHEN COALESCE(matched."hasTrustedProvenance", false)
              AND matched."productKind" IS NOT NULL
            THEN matched."productKind"
            WHEN COALESCE(trusted_evidence."productKind", false)
            THEN k."facts"->>'productKind'
            ELSE NULL
          END AS "productKind",
          (
            lower(regexp_replace(COALESCE(p."sku", ''), '[^a-zA-Z0-9]+', '', 'g')) =
            ${exactSkuQuery}
            OR exact_variant."variantId" IS NOT NULL
          ) AS "isExactSku",
          EXISTS (
            SELECT 1
            FROM "ShopVehicleApplication" any_application
            WHERE any_application."knowledgeId" = k."id"
              AND any_application."isActive" = true
              AND any_application."revision" = k."activeRevision"
          ) AS "hasApplications",
          (
            CASE
              WHEN lower(regexp_replace(COALESCE(p."sku", ''), '\\s+', '', 'g')) =
                   lower(${exactSkuQuery}) THEN 1000
              ELSE 0
            END
            + CASE
                WHEN ${query} <> ''
                THEN ts_rank_cd(
                  to_tsvector('simple', COALESCE(k."searchText", '')),
                  plainto_tsquery('simple', ${query})
                ) * 100
                ELSE 0
              END
            + CASE
                WHEN ${query} <> '' AND lower(k."searchText") LIKE ${`%${query}%`}
                THEN 25
                ELSE 0
              END
            + COALESCE((
                SELECT MAX(
                  ts_rank_cd(
                    to_tsvector('simple', chunk."content"),
                    plainto_tsquery('simple', ${query})
                  )
                ) * 20
                FROM "ShopKnowledgeChunk" chunk
                WHERE chunk."knowledgeId" = k."id"
                  AND chunk."isActive" = true
                  AND chunk."revision" = k."activeRevision"
                  AND chunk."locale" IN (${input.context.locale}, 'en')
                  AND ${query} <> ''
              ), 0)
          )::double precision AS "lexicalScore"
        FROM "ShopProduct" p
        JOIN "ShopProductKnowledge" k
          ON k."productId" = p."id"
        LEFT JOIN LATERAL (
          SELECT
            BOOL_OR(
              definition."key" = 'material'
              AND attribute."normalizedValue" = lower(COALESCE(k."facts"->>'material', ''))
            ) AS "material",
            BOOL_OR(
              definition."key" = 'opfGpf'
              AND attribute."normalizedValue" = lower(COALESCE(k."facts"->>'opfGpf', ''))
            ) AS "opfGpf",
            BOOL_OR(
              definition."key" = 'installationType'
              AND attribute."normalizedValue" =
                lower(COALESCE(k."facts"->>'installationType', ''))
            ) AS "installationType",
            BOOL_OR(
              definition."key" = 'powerGainHp'
              AND attribute."normalizedValue" =
                lower(COALESCE(k."facts"->>'powerGainHp', ''))
            ) AS "powerGainHp",
            BOOL_OR(
              definition."key" = 'productKind'
              AND attribute."normalizedValue" =
                lower(COALESCE(k."facts"->>'productKind', ''))
            ) AS "productKind"
          FROM "ShopKnowledgeEvidence" evidence
          JOIN "ShopProductAttributeValue" attribute
            ON attribute."id" = evidence."attributeValueId"
           AND attribute."knowledgeId" = k."id"
           AND attribute."revision" = k."activeRevision"
           AND attribute."isActive" = true
           AND attribute."variantId" IS NULL
          JOIN "ShopProductAttributeDefinition" definition
            ON definition."id" = attribute."definitionId"
           AND definition."isActive" = true
          WHERE evidence."knowledgeId" = k."id"
            AND evidence."isActive" = true
            AND evidence."revision" = k."activeRevision"
            AND (
              evidence."isManagerVerified" = true
              OR evidence."source"::text IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
            )
        ) trusted_evidence ON true
        LEFT JOIN LATERAL (
          SELECT sku_variant."variantId"
          FROM "ShopVariantKnowledge" sku_variant
          WHERE sku_variant."knowledgeId" = k."id"
            AND sku_variant."isActive" = true
            AND sku_variant."revision" = k."activeRevision"
            AND sku_variant."schemaVersion" >= 2
            AND sku_variant."status"::text IN ('READY', 'NEEDS_REVIEW')
            AND lower(
              regexp_replace(COALESCE(sku_variant."sku", ''), '[^a-zA-Z0-9]+', '', 'g')
            ) = ${exactSkuQuery}
          ORDER BY sku_variant."updatedAt" DESC
          LIMIT 1
        ) exact_variant ON true
        LEFT JOIN LATERAL (
          SELECT
            a.*,
            (
              a."verificationStatus"::text = 'VERIFIED'
              AND CASE
                WHEN a."source"::text = 'MANAGER' THEN EXISTS (
                  SELECT 1
                  FROM "ShopKnowledgeEvidence" application_evidence
                  WHERE application_evidence."vehicleApplicationId" = a."id"
                    AND application_evidence."knowledgeId" = k."id"
                    AND application_evidence."revision" = k."activeRevision"
                    AND application_evidence."isActive" = true
                    AND application_evidence."source"::text = 'MANAGER'
                    AND application_evidence."isManagerVerified" = true
                    AND application_evidence."verifiedById" IS NOT NULL
                    AND application_evidence."verifiedAt" IS NOT NULL
                    AND application_evidence."fieldPath" LIKE 'vehicleApplications.%'
                    AND application_evidence."extractorVersion" LIKE 'admin-%'
                )
                WHEN a."source"::text = 'MANUAL_OVERRIDE' THEN EXISTS (
                  SELECT 1
                  FROM "ShopKnowledgeEvidence" application_evidence
                  WHERE application_evidence."vehicleApplicationId" = a."id"
                    AND application_evidence."knowledgeId" = k."id"
                    AND application_evidence."revision" = k."activeRevision"
                    AND application_evidence."isActive" = true
                    AND application_evidence."source"::text = 'MANUAL_OVERRIDE'
                    AND application_evidence."verifiedById" IS NOT NULL
                    AND application_evidence."verifiedAt" IS NOT NULL
                )
                WHEN a."source"::text = 'SUPPLIER' THEN EXISTS (
                  SELECT 1
                  FROM "ShopKnowledgeEvidence" application_evidence
                  WHERE application_evidence."vehicleApplicationId" = a."id"
                    AND application_evidence."knowledgeId" = k."id"
                    AND application_evidence."revision" = k."activeRevision"
                    AND application_evidence."isActive" = true
                    AND application_evidence."source"::text = 'SUPPLIER'
                )
                ELSE false
              END
            ) AS "hasTrustedProvenance"
          FROM "ShopVehicleApplication" a
          WHERE a."knowledgeId" = k."id"
            AND a."isActive" = true
            AND a."revision" = k."activeRevision"
            AND a."verificationStatus"::text <> 'BLOCKED'
            AND (
              exact_variant."variantId" IS NULL
              OR a."variantId" IS NULL
              OR a."variantId" = exact_variant."variantId"
            )
            ${input.context.scope ? Prisma.sql`AND a."scope" = ${input.context.scope}` : Prisma.empty}
            ${
              applicationClauses.length
                ? Prisma.sql`AND (a."isUniversal" = true OR (${Prisma.join(
                    applicationClauses,
                    " AND "
                  )}))`
                : Prisma.empty
            }
          ORDER BY
            "hasTrustedProvenance" DESC,
            ${
              exactApplicationClauses.length
                ? Prisma.sql`(a."isUniversal" = true OR (${Prisma.join(
                    exactApplicationClauses,
                    " AND "
                  )})) DESC,`
                : Prisma.empty
            }
            a."confidence" DESC,
            a."updatedAt" DESC
          LIMIT 1
        ) matched ON true
        WHERE p."isPublished" = true
          AND p."status"::text = 'ACTIVE'
          AND k."status"::text IN ('READY', 'NEEDS_REVIEW')
          AND k."schemaVersion" >= 2
          AND k."activeRevision" > 0
          AND NOT (
            'v2_backfill_required' = ANY(COALESCE(k."qualityFlags", ARRAY[]::TEXT[]))
          )
          ${
            input.exactSkuOnly
              ? Prisma.sql`
                  AND (
                    lower(
                      regexp_replace(COALESCE(p."sku", ''), '[^a-zA-Z0-9]+', '', 'g')
                    ) = ${exactSkuQuery}
                    OR exact_variant."variantId" IS NOT NULL
                  )
                `
              : Prisma.empty
          }
          ${input.context.scope ? Prisma.sql`AND p."scope" = ${input.context.scope}` : Prisma.empty}
          ${
            input.plan.brandOnly && input.plan.brand
              ? Prisma.sql`AND lower(trim(COALESCE(p."brand", ''))) = lower(trim(${input.plan.brand}))`
              : Prisma.empty
          }
          ${input.plan.stockOnly ? Prisma.sql`AND p."stock" = 'inStock'` : Prisma.empty}
          ${
            input.plan.category
              ? Prisma.sql`AND k."categoryGroup" = ${input.plan.category}`
              : Prisma.empty
          }
          ${
            productKind
              ? Prisma.sql`
                  AND (
                    (
                      COALESCE(matched."hasTrustedProvenance", false)
                      AND matched."productKind" = ${productKind}
                    )
                    OR (
                      COALESCE(trusted_evidence."productKind", false)
                      AND k."facts"->>'productKind' = ${productKind}
                    )
                  )
                `
              : Prisma.empty
          }
          ${
            excluded.length
              ? Prisma.sql`AND p."id" NOT IN (${Prisma.join(excluded)})`
              : Prisma.empty
          }
          ${
            hasVehicle
              ? Prisma.sql`
                  AND (
                    matched."id" IS NOT NULL
                    OR NOT EXISTS (
                      SELECT 1
                      FROM "ShopVehicleApplication" known_application
                      WHERE known_application."knowledgeId" = k."id"
                        AND known_application."isActive" = true
                        AND known_application."revision" = k."activeRevision"
                    )
                  )
                `
              : Prisma.empty
          }
      ),
      ranked AS (
        SELECT
          eligible.*,
          COUNT(*) OVER () AS "eligibleCount"
        FROM eligible
        ORDER BY
          "isExactSku" DESC,
          (
            "trustedApplicationEvidence" = true
            AND "applicationVerificationStatus" = 'VERIFIED'
            AND "applicationSource" IN ('MANAGER', 'MANUAL_OVERRIDE', 'SUPPLIER')
          ) DESC,
          "lexicalScore" DESC,
          "productId" ASC
        LIMIT ${MAX_RETRIEVED_CANDIDATES}
      )
      SELECT * FROM ranked
    `);

    const validatedRows = rows
      .filter((row) => classifyShopAiStrictCanonicalRow(row, input.plan, input.context) !== null)
      .slice(0, MAX_VALIDATED_CANDIDATES);
    const candidates = validatedRows.map((row) =>
      toCandidate(row, input.plan, input.context, Boolean(input.exactSkuOnly))
    );
    const hydrated = await hydrateShopAiKnowledgeCandidates(candidates, input.context);
    const products = hydrated.filter((product) =>
      matchesBudget(product, input.plan, input.context)
    );
    return {
      available: true,
      catalogFingerprint: catalogState.fingerprint,
      products,
      exactCount: products.filter((product) => product.matchStatus === "exact").length,
      requiresVerificationCount: products.filter(
        (product) => product.matchStatus === "requires_verification"
      ).length,
      candidateCount: Number(rows[0]?.eligibleCount ?? 0),
      retrievalLatencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    if (!isMissingKnowledgeSchemaError(error)) throw error;
    return {
      available: false,
      catalogFingerprint: catalogState.fingerprint,
      products: [],
      exactCount: 0,
      requiresVerificationCount: 0,
      candidateCount: 0,
      retrievalLatencyMs: Math.round(performance.now() - startedAt),
    };
  }
}
