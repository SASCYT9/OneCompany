import brandGuides from "@/data/operations/brand-guides.json";
import { prisma } from "@/lib/prisma";

type StructuredFormula = {
  enabled: boolean;
  version: string | null;
  markupBasisPoints?: number;
  requiredFields?: string[];
};

const structuredFormulas: Record<
  string,
  { retail: StructuredFormula; wholesale: StructuredFormula }
> = {
  "rw-carbon": {
    retail: {
      enabled: true,
      version: "rw-carbon-retail-v1",
      markupBasisPoints: 1500,
      requiredFields: ["internationalShippingMinor"],
    },
    wholesale: {
      enabled: false,
      version: null,
      requiredFields: ["wholesaleFormulaApproval"],
    },
  },
};

export function normalizeBrandKey(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getQuoteBrandKnowledge(brandKey: string) {
  const guide = brandGuides.brands.find(
    (candidate) => normalizeBrandKey(candidate.brand) === brandKey
  );
  if (!guide) return null;

  const logistics = await prisma.shopBrandLogistics.findFirst({
    where: {
      brandName: { equals: guide.brand, mode: "insensitive" },
      isActive: true,
    },
    include: { warehouse: true },
  });
  const formulas = structuredFormulas[brandKey] ?? {
    retail: { enabled: false, version: null },
    wholesale: { enabled: false, version: null },
  };

  return {
    brandKey,
    brand: guide.brand,
    formulaStatus: guide.formulaStatus,
    formulas: {
      retail: { enabled: formulas.retail.enabled, version: formulas.retail.version },
      wholesale: { enabled: formulas.wholesale.enabled, version: formulas.wholesale.version },
    },
    warehouse: logistics?.warehouse
      ? {
          code: logistics.warehouse.code,
          country: logistics.warehouse.country,
          city: logistics.warehouse.city,
          state: logistics.warehouse.state,
          postalCode: logistics.warehouse.postalCode,
          address: logistics.warehouse.address,
          address2: logistics.warehouse.address2,
        }
      : null,
  };
}

export async function listQuoteWarehouses() {
  return prisma.shopWarehouse.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      code: true,
      name: true,
      country: true,
      city: true,
      state: true,
      postalCode: true,
      address: true,
      address2: true,
    },
  });
}

export function calculateStructuredQuote(input: {
  brandKey: string;
  mode: "RETAIL" | "WHOLESALE";
  productPriceMinor: number;
  localShippingMinor: number;
  taxMinor: number;
  currency: string;
  internationalShippingMinor?: number;
}) {
  const mode = input.mode === "RETAIL" ? "retail" : "wholesale";
  const formula = structuredFormulas[input.brandKey]?.[mode];
  if (!formula?.enabled || !formula.version) {
    return {
      status: "NEEDS_INPUT" as const,
      missingFields: formula?.requiredFields ?? ["verifiedStructuredFormula"],
      currency: input.currency,
      formulaVersion: formula?.version ?? `${input.brandKey}-${mode}-unverified`,
    };
  }
  const missingFields = (formula.requiredFields ?? []).filter(
    (field) =>
      field === "internationalShippingMinor" && input.internationalShippingMinor === undefined
  );
  if (missingFields.length) {
    return {
      status: "NEEDS_INPUT" as const,
      missingFields,
      currency: input.currency,
      formulaVersion: formula.version,
    };
  }

  const markupMinor = Math.round(
    (input.productPriceMinor * (formula.markupBasisPoints ?? 0)) / 10_000
  );
  const internationalShippingMinor = input.internationalShippingMinor ?? 0;
  const components = {
    productPriceMinor: input.productPriceMinor,
    markupMinor,
    localShippingMinor: input.localShippingMinor,
    taxMinor: input.taxMinor,
    internationalShippingMinor,
  };
  return {
    status: "COMPLETED" as const,
    missingFields: [],
    finalMinor: Object.values(components).reduce((sum, value) => sum + value, 0),
    currency: input.currency,
    formulaVersion: formula.version,
    components,
  };
}
