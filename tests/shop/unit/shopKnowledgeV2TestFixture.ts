import type { KnowledgeSourceProduct } from "../../../src/lib/shopKnowledgeV2/types";

export function knowledgeSourceProduct(
  overrides: Partial<KnowledgeSourceProduct> = {}
): KnowledgeSourceProduct {
  const updatedAt = new Date("2026-07-17T10:00:00.000Z");
  return {
    id: "product-knowledge-v2",
    slug: "akrapovic-bmw-m3-f80-exhaust",
    sku: "AKR-BMW-M3-F80",
    scope: "auto",
    brand: "Akrapovic",
    vendor: "Akrapovic",
    productType: "Exhaust system",
    productCategory: "Vehicle Parts & Accessories",
    titleUa: "Титановий вихлоп Akrapovič для BMW M3 F80",
    titleEn: "Akrapovič titanium exhaust for BMW M3 F80",
    categoryUa: "Вихлопні системи",
    categoryEn: "Exhaust systems",
    shortDescUa: "Повна вихлопна система з клапанами.",
    shortDescEn: "Complete valved exhaust system.",
    longDescUa: "Для двигуна S55, європейський ринок.",
    longDescEn: "For the S55 engine and European market.",
    leadTimeUa: "Під замовлення",
    leadTimeEn: "On request",
    collectionUa: "Evolution Line",
    collectionEn: "Evolution Line",
    bodyHtmlUa: "<section><h2>Сумісність</h2><p>BMW M3 F80.</p></section>",
    bodyHtmlEn: "<section><h2>Fitment</h2><p>BMW M3 F80.</p></section>",
    seoTitleUa: "Вихлоп BMW M3 F80",
    seoTitleEn: "BMW M3 F80 exhaust",
    seoDescriptionUa: "Титановий вихлоп Akrapovič.",
    seoDescriptionEn: "Akrapovič titanium exhaust.",
    tags: ["BMW", "M3", "F80", "S55"],
    highlights: [
      { ua: "Титанова конструкція", en: "Titanium construction" },
      { ua: "Клапанне керування", en: "Valve control" },
    ],
    isPublished: true,
    status: "ACTIVE",
    updatedAt,
    variants: [
      {
        id: "variant-non-opf",
        title: "Non-OPF",
        sku: "AKR-BMW-M3-F80-NON-OPF",
        position: 1,
        option1Value: "Non-OPF",
        option2Value: "Titanium",
        option3Value: null,
        inventoryQty: 2,
        updatedAt,
      },
    ],
    options: [
      {
        id: "option-filter",
        name: "Filter",
        position: 1,
        values: ["OPF", "Non-OPF"],
        updatedAt,
      },
      {
        id: "option-material",
        name: "Material",
        position: 2,
        values: ["Titanium"],
        updatedAt,
      },
    ],
    metafields: [],
    managerApplications: [],
    managerStrictBlock: false,
    ...overrides,
  };
}

export function verifiedF80FitmentMetafield(updatedAt = new Date("2026-07-17T10:00:00.000Z")) {
  return {
    id: "fitment-metafield",
    namespace: "onecompany",
    key: "normalized_fitment",
    value: JSON.stringify({
      version: 2,
      status: "verified",
      vehicleType: "car",
      make: "BMW",
      models: ["M3"],
      chassisCodes: ["F80"],
      yearRanges: [{ from: 2014, to: 2020 }],
      applications: [
        {
          vehicleType: "car",
          make: "BMW",
          models: ["M3"],
          chassisCodes: ["F80"],
          yearRanges: [{ from: 2014, to: 2020 }],
          engines: ["S55"],
          bodyStyles: ["sedan"],
          drivetrains: ["RWD"],
          markets: ["EU"],
        },
      ],
      confidence: "high",
      source: "manual",
      verifiedAt: "2026-07-17T09:00:00.000Z",
      verifiedBy: "manager-1",
      note: null,
    }),
    valueType: "json",
    updatedAt,
  };
}

export function verifiedManagerF80Application(
  updatedAt = new Date("2026-07-17T10:30:00.000Z")
): KnowledgeSourceProduct["managerApplications"][number] {
  return {
    applicationKey: "canonical-manager-application-f80-non-opf",
    variantId: "variant-non-opf",
    scope: "auto",
    make: "BMW",
    model: "M3",
    generation: "F8x",
    chassisCode: "F80",
    yearFrom: 2014,
    yearTo: 2020,
    engine: "S55",
    fuel: "petrol",
    bodyStyle: "sedan",
    drivetrain: "RWD",
    transmission: "DCT",
    market: "EU",
    opfGpf: "without",
    categoryGroup: "exhaust",
    productKind: "system",
    material: "titanium",
    isUniversal: false,
    verificationStatus: "VERIFIED",
    confidence: 1,
    verifiedById: "manager-1",
    verifiedAt: new Date("2026-07-17T10:20:00.000Z"),
    updatedAt,
    evidence: [
      {
        evidenceKey: "canonical-manager-evidence-f80-non-opf",
        fieldPath: "vehicleApplications.canonical-manager-application-f80-non-opf",
        sourceRef: "manager:fitment-certificate-42",
        excerpt: "Manager verified BMW M3 F80 S55 DCT non-OPF titanium system.",
        sourceHash: "canonical-manager-source-hash",
        confidence: 1,
        extractorVersion: "admin-v1",
        isManagerVerified: true,
        verifiedById: "manager-1",
        verifiedAt: new Date("2026-07-17T10:20:00.000Z"),
        updatedAt,
      },
    ],
  };
}
